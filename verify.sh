#!/bin/bash
# ================================================================
# verify.sh — 코드 변경 자동 검증 파이프라인
# patchgap | Claude Code 워크플로우
#
# 생태계: Node.js (TypeScript)
# 구조: SINGLE (단일 패키지, npm)
#
# 사용법:
#   bash verify.sh              # 변경 파일 감지 + 전체 검증
#   bash verify.sh --ts-only    # TypeScript 타입 체크만 실행
#   bash verify.sh --no-build   # 빌드만 건너뜀 — SubTask 단위 fast gate (F-NEW-26)
#   bash verify.sh --ai         # Claude AI 분석 포함 (claude CLI 필요)
#   bash verify.sh --staged     # staged 파일만 검사
#   bash verify.sh --full       # 변경 감지 없이 전체 파일 검사
# ================================================================
set -euo pipefail

# ─── 옵션 파싱 ─────────────────────────────────────────────────
LINT_ONLY=false
AI_MODE=false
STAGED_ONLY=false
FULL_SCAN=false
TS_ONLY=false
NO_BUILD=false

for arg in "$@"; do
  case $arg in
    --lint-only) LINT_ONLY=true ;;
    --ai)        AI_MODE=true ;;
    --staged)    STAGED_ONLY=true ;;
    --full)      FULL_SCAN=true ;;
    --ts-only)   TS_ONLY=true ;;
    --no-build)  NO_BUILD=true ;;
  esac
done

# ─── 컬러 출력 함수 ────────────────────────────────────────────
pass()    { echo -e "\033[0;32m  ✔ $*\033[0m"; }
fail()    { echo -e "\033[0;31m  ✘ $*\033[0m"; }
info()    { echo -e "\033[0;36m  ℹ $*\033[0m"; }
warn()    { echo -e "\033[0;33m  ⚠ $*\033[0m"; }
header()  { echo -e "\n\033[1;34m▶ $*\033[0m"; }
section() { echo -e "\n\033[1;35m╔══ $* ══╗\033[0m"; }

# ─── 행(hang) 가드 러너 ────────────────────────────────────────
# 실측 근거(F-NEW-33): `OUT=$(명령)` 캡처는 명령이 정상 종료해도 고아 자식이 stdout을 물면
# 셸이 무기한 블록된다. timeout만 덧씌우는 것도 이 케이스엔 무효. --foreground도 금지.
VERIFY_LOG_DIR="${TMPDIR:-/tmp}/verify-$(basename "$PWD")-$$"
mkdir -p "$VERIFY_LOG_DIR"
HANG_DETECTED=false

VERIFY_TIMEOUT_TSC=${VERIFY_TIMEOUT_TSC:-120}
VERIFY_TIMEOUT_LINT=${VERIFY_TIMEOUT_LINT:-120}
VERIFY_TIMEOUT_TEST=${VERIFY_TIMEOUT_TEST:-240}
VERIFY_TIMEOUT_BUILD=${VERIFY_TIMEOUT_BUILD:-600}

run_guarded() {
  local secs="$1" logname="$2"; shift 2
  local log="$VERIFY_LOG_DIR/$logname" rc=0 wd=""
  ( sleep $(( secs * 2 / 3 )); ps -ef --forest > "$VERIFY_LOG_DIR/freeze-$logname" 2>/dev/null ) >/dev/null 2>&1 &
  wd=$!
  timeout --kill-after=15 "$secs" "$@" > "$log" 2>&1 || rc=$?
  kill "$wd" 2>/dev/null || true
  wait "$wd" 2>/dev/null || true
  if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
    HANG_DETECTED=true
    fail "행(hang) 감지: '$*' 이 ${secs}초 내 미종료 (exit $rc)"
    {
      echo "=== 명령: $* (상한 ${secs}s, exit $rc)"
      echo "=== 동결 시점 프로세스 트리 (그룹 킬 이전) ==="
      cat "$VERIFY_LOG_DIR/freeze-$logname" 2>/dev/null || echo "(스냅샷 없음 — 상한의 2/3 이전에 종료)"
      echo "=== 그룹 킬 생존자 ==="
      ps -ef --forest 2>/dev/null | grep -E 'esbuild|vite|vitest|jest|tsserver|next' | grep -v grep || echo "(없음)"
      echo "=== 로그 마지막 50줄 (동결 직전 출력) ==="
      tail -50 "$log" 2>/dev/null
    } > "$VERIFY_LOG_DIR/forensic-$logname" 2>&1
    warn "포렌식 덤프: $VERIFY_LOG_DIR/forensic-$logname"
  fi
  return "$rc"
}

FAIL_COUNT=0

# ─── 변경 파일 감지 ────────────────────────────────────────────
header "변경 파일 감지"
ALL_CHANGED=""

if [ "$FULL_SCAN" = true ]; then
  info "전체 스캔 모드"
elif [ "$STAGED_ONLY" = true ]; then
  ALL_CHANGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
  info "Staged 파일만"
else
  UNSTAGED=$(git diff --name-only --diff-filter=ACM 2>/dev/null || true)
  STAGED_F=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
  ALL_CHANGED=$(printf '%s\n%s' "$UNSTAGED" "$STAGED_F" | sort -u | grep -v '^$' || true)
  info "staged + unstaged 전체"
fi

# .css 포함 — 디자인 토큰 하드코딩 검사(§6 src/**/*.{ts,tsx,css}) 대상. any/console.log 규칙은
# css에 매치될 일이 없으므로 무해하다. find -regex 대체는 최장 우선(tsx/jsx/css > ts/js)으로 둔다.
FILE_EXTENSIONS='\.(tsx|jsx|css|ts|js)$'

if [ "$FULL_SCAN" = true ]; then
  TARGET_FILES=$(find . -type d \( -name node_modules -o -name .next -o -name out -o -name .git \) -prune -o \
      -type f -regextype posix-extended -regex '.*\.(tsx|jsx|css|ts|js)$' -print 2>/dev/null || true)
else
  TARGET_FILES=$(printf '%s\n' "$ALL_CHANGED" | grep -E "$FILE_EXTENSIONS" || true)
fi

TARGET_COUNT=$(printf '%s\n' "$TARGET_FILES" | grep -c . || true)
TARGET_COUNT=${TARGET_COUNT:-0}
info "Spec 검사 대상: ${TARGET_COUNT}개 파일"

# ─── Spec 검사 (정적 규칙) ─────────────────────────────────────
header "Spec 검사"

# 토큰 Ground Truth 하드코딩 검사용 사전 가드
DESIGN_TOKENS_GT=false
[ -f docs/design/DESIGN-TOKENS.md ] && DESIGN_TOKENS_GT=true

if [ -n "$TARGET_FILES" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ -f "$file" ] || continue

    # 1) any 타입 금지 (TypeScript 공통, 항상 포함)
    if grep -nE ': any([^a-zA-Z_]|$)' "$file" 2>/dev/null | grep -v '^[0-9]*:[[:space:]]*//' | grep -q .; then
      fail "[any 타입] unknown 또는 명시 타입으로 교체 필요: $file"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    # 2) Tailwind v4 — tailwind.config.* 재도입 금지 (CSS-first @theme만 허용)
    if grep -nE "require\('tailwindcss'\)|tailwind\.config" "$file" 2>/dev/null \
        | grep -v '^[0-9]*:[[:space:]]*//' | grep -q .; then
      fail "[Tailwind v4] tailwind.config 감지 — @theme(globals.css) 방식만 허용: $file"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    # 3) console.log — scripts/ 는 파이프라인 CLI 출력이라 예외, 그 외는 경고
    # (--full 스캔은 find가 "./scripts/..." 형태로 내놓으므로 선행 "./"도 함께 매칭한다)
    case "$file" in
      scripts/*|./scripts/*) ;;
      *)
        if grep -nE 'console\.log\(' "$file" 2>/dev/null | grep -v '^[0-9]*:[[:space:]]*//' | grep -q .; then
          warn "[console.log] scripts/ 밖의 console.log — 로거로 교체 검토: $file"
        fi
        ;;
    esac

    # 4b) PUBG 무기 키 정준화 우회 금지 — pubg-weapon-key.ts가 유일한 정규화 소유자다
    # (PLAN-pubg-normalization-2026-09-17.md ST-5). attacks∩damageHits가 원래 0이었던
    # 이유가 두 네임스페이스를 직접 문자열 비교로 결합하려던 시도였다 — 소비 계층에
    # startsWith/정규식/등가비교/includes로 같은 짓을 다시 하면 재발한다. 등가·includes는
    # 2026-09-17 acceptance-critic 2차 재검증이 지적한 우회 경로(원 규칙은 startsWith·정규식
    # 리터럴만 잡았다) — 세 파일 다 이 시점엔 원시 리터럴 비교가 0건이라 안전하게 추가했다.
    case "$file" in
      */pubg-weapons.ts|*/pubg-delta.ts|*/pubg-accuracy.ts)
        if grep -nE '\.startsWith\((\x27|")(Weap|Item_Weapon_)|/(\^Weap|Item_Weapon_)|(===|==)[[:space:]]*(\x27|")(Weap|Item_Weapon_)|\.includes\((\x27|")(Weap|Item_Weapon_)' "$file" 2>/dev/null \
            | grep -v '^[0-9]*:[[:space:]]*//' | grep -q .; then
          fail "[PUBG 정규화 우회] 원시 무기 키 직접 비교 — canonicalWeaponKey/weaponKind(pubg-weapon-key.ts) 경유 필요: $file"
          FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        ;;
    esac

    # 4c) 외부 링크 새 창 단일 소유 — ExternalLink.tsx만 target="_blank"를 만든다
    # (2026-09-20). 라운드6에서 "패치노트 원문은 새 창으로"를 네 군데에 손으로 붙였는데 같은
    # 화면의 형제 패널(CausesPanel) 하나가 빠져 사용자가 같은 요구를 두 번 말해야 했다 —
    # 규칙이 복제돼 있으면 반드시 하나가 빠진다. 소유자를 하나로 두고 그 밖을 여기서 막는다.
    case "$file" in
      */ExternalLink.tsx|*/__tests__/*) ;;
      *.tsx)
        if grep -nE 'target=(\x27|")_blank(\x27|")' "$file" 2>/dev/null \
            | grep -v '^[0-9]*:[[:space:]]*//' | grep -q .; then
          fail "[외부 링크] 새 창 링크는 ExternalLink(components/ExternalLink.tsx) 경유 필요: $file"
          FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        ;;
    esac

    # 4) 디자인 토큰 Ground Truth 하드코딩 검사 (docs/design/DESIGN-TOKENS.md 존재 시)
    if [ "$DESIGN_TOKENS_GT" = true ]; then
      case "$file" in
        *globals.css|*tokens.css|*index.css|*theme.css|*variables.css) ;;
        *tokens.ts|*theme.ts|*tokens.js|*theme.js|*/design-tokens/*|*/design-system/*) ;;
        *)
          if grep -nE '#[0-9a-fA-F]{3,8}\b' "$file" 2>/dev/null \
              | grep -v 'design-lint-ignore' | grep -v '^[0-9]*:[[:space:]]*//' | grep -q .; then
            warn "[디자인 토큰] 하드코딩 색 — var(--*)/Tailwind 토큰 유틸로 교체 (정당하면 design-lint-ignore): $file"
          fi
          if grep -nE '\[(#[0-9a-fA-F]{3,8}|[0-9]+(px|rem))\]' "$file" 2>/dev/null \
              | grep -v 'design-lint-ignore' | grep -q .; then
            warn "[디자인 토큰] Tailwind arbitrary 값이 토큰을 우회: $file"
          fi
          ;;
      esac
    fi
  done <<< "$TARGET_FILES"
  [ "$FAIL_COUNT" -eq 0 ] && pass "Spec 검사 통과 (fail 0)"
else
  info "Spec 검사 대상 없음"
fi

# ─── TypeScript 타입 체크 ──────────────────────────────────────
header "TypeScript 타입 체크"
TS_EXIT=0
run_guarded "$VERIFY_TIMEOUT_TSC" tsc.log npx tsc --noEmit || TS_EXIT=$?
TS_ERRORS=$(grep -c ' error TS' "$VERIFY_LOG_DIR/tsc.log" || true)
TS_ERRORS=${TS_ERRORS:-0}
if [ "$TS_EXIT" -eq 124 ] || [ "$TS_EXIT" -eq 137 ]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
elif [ "${TS_ERRORS}" -gt 0 ]; then
  fail "TypeScript 오류 ${TS_ERRORS}건"
  grep ' error TS' "$VERIFY_LOG_DIR/tsc.log" | head -20
  FAIL_COUNT=$((FAIL_COUNT + TS_ERRORS))
else
  pass "TypeScript 타입 체크 통과"
fi

# ─── ESLint ────────────────────────────────────────────────────
if [ "$TS_ONLY" = false ]; then
  header "ESLint 정적 분석"
  ESLINT_EXIT=0
  run_guarded "$VERIFY_TIMEOUT_LINT" eslint.log npm run lint -- --max-warnings 0 || ESLINT_EXIT=$?
  if [ "$ESLINT_EXIT" -ne 0 ]; then
    tail -30 "$VERIFY_LOG_DIR/eslint.log"
    fail "ESLint 경고 또는 오류 발견"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    pass "ESLint 통과"
  fi
fi

# ─── 단위 테스트 (런타임 자가감지) ─────────────────────────────
if [ "$TS_ONLY" = false ]; then
  header "단위 테스트"

  UNIT_TEST_FILES=$(find . -type d -name node_modules -prune -o \
      -type f \( -name '*.test.ts' -o -name '*.test.tsx' \
                 -o -name '*.test.js' -o -name '*.test.jsx' \
                 -o -name '*.spec.ts' -o -name '*.spec.tsx' \) -print 2>/dev/null \
    | grep -vE '(^|/)(e2e|tests/e2e)/|\.e2e\.' | head -1 || true)

  UNIT_RUNNER=""
  grep -qE '"vitest"' package.json 2>/dev/null && UNIT_RUNNER="vitest" || true
  grep -qE '"jest"'   package.json 2>/dev/null && UNIT_RUNNER="jest"   || true

  if [ -z "$UNIT_TEST_FILES" ]; then
    info "단위 테스트 없음 — 건너뜀 (E2E는 별도 레이어에서 검증)"
  elif [ -z "$UNIT_RUNNER" ]; then
    fail "단위 테스트 파일이 존재하나 러너(vitest/jest) 미설치"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  elif ! grep -qE '"test"[[:space:]]*:' package.json 2>/dev/null; then
    fail "단위 테스트 파일이 존재하나 package.json에 \"test\" 스크립트 없음"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    TEST_EXIT=0
    run_guarded "$VERIFY_TIMEOUT_TEST" unittest.log npm run test || TEST_EXIT=$?
    if [ "$TEST_EXIT" -ne 0 ]; then
      fail "단위 테스트 실패 ($UNIT_RUNNER)"
      tail -30 "$VERIFY_LOG_DIR/unittest.log"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    else
      pass "단위 테스트 통과 ($UNIT_RUNNER)"
    fi
  fi
fi

# ─── 빌드 검증 ─────────────────────────────────────────────────
if [ "$TS_ONLY" = false ] && [ "$NO_BUILD" = false ]; then
  header "빌드 검증"
  BUILD_EXIT=0
  run_guarded "$VERIFY_TIMEOUT_BUILD" build.log npm run build || BUILD_EXIT=$?
  if [ "$BUILD_EXIT" -ne 0 ]; then
    fail "빌드 실패"
    tail -30 "$VERIFY_LOG_DIR/build.log"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    pass "빌드 성공"
  fi
elif [ "$NO_BUILD" = true ] && [ "$TS_ONLY" = false ]; then
  info "빌드 건너뜀 (--no-build) — 풀 빌드는 COMPLETE/ship 게이트에서 실행"
fi

# ─── 디자인 게이트 (design-lint) ──────────────────────────────
DESIGN_LINT="$HOME/.claude/skills/design-lint/scripts/design-lint.mjs"
DESIGN_TARGETS=$(ls docs/design/prototype/*.html 2>/dev/null || true)

if [ -n "$DESIGN_TARGETS" ] && [ -f "$DESIGN_LINT" ] && command -v node >/dev/null 2>&1; then
  header "디자인 게이트 (design-lint)"
  DL_ARGS=""
  [ -f docs/design/DESIGN-TOKENS.md ] && DL_ARGS="--tokens docs/design/DESIGN-TOKENS.md"
  DL_EXIT=0
  # shellcheck disable=SC2086
  run_guarded 60 design-lint.log node "$DESIGN_LINT" $DESIGN_TARGETS $DL_ARGS --gate || DL_EXIT=$?
  if [ "$DL_EXIT" -eq 0 ]; then
    pass "design-lint 통과"
  else
    tail -30 "$VERIFY_LOG_DIR/design-lint.log"
    fail "design-lint error 발견 — $VERIFY_LOG_DIR/design-lint.log 확인"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  [ -f docs/design/DESIGN-TOKENS.md ] || warn "DESIGN-TOKENS.md 없음 — 토큰 위생 검사 스킵(/init-design 권장)"
else
  [ -n "$DESIGN_TARGETS" ] && warn "design-lint 스킵 — node 또는 스킬 스크립트 없음"
fi

# ─── Claude AI 분석 ────────────────────────────────────────────
if [ "$AI_MODE" = true ]; then
  header "Claude AI 코드 분석"
  if ! command -v claude &>/dev/null; then
    warn "claude CLI 없음 — AI 분석 건너뜀"
  else
    DIFF_OUTPUT=$(git diff HEAD 2>/dev/null | head -400 || true)
    CLAUDE_PROMPT="다음은 patchgap 코드 변경사항입니다.

## 프로젝트 규칙 (CLAUDE.md 요약)
런타임 외부 API 호출 0 · 사전 인덱싱(수집→집계→매칭→빌드) · 모든 판정문 원천 링크 ·
무근거 문장 회색 · any 타입 금지 · 디자인 토큰(docs/design/DESIGN-TOKENS.md) 하드코딩 금지

## 변경사항 (git diff HEAD)
${DIFF_OUTPUT}

## 분석 요청
1. 규칙 위반 항목 (파일명·줄번호 포함)
2. 설계 이탈 또는 사이드이펙트 위험
3. 최종 판정: ✅ 안전 / ⚠️ 주의 필요 / ❌ 수정 필요"

    echo "$CLAUDE_PROMPT" | claude --print 2>/dev/null || warn "Claude AI 분석 실패"
  fi
fi

# ─── 최종 결과 ────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "${TOTAL_FAIL:-${FAIL_COUNT:-0}}" -eq 0 ]; then
  echo -e "\033[0;32m  ✅ 모든 검증 통과\033[0m"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  [ "${HANG_DETECTED:-false}" = false ] && rm -rf "${VERIFY_LOG_DIR:?}" || true
  exit 0
else
  echo -e "\033[0;31m  ❌ 총 ${TOTAL_FAIL:-${FAIL_COUNT:-0}}건 문제 발견 — 수정 후 재실행\033[0m"
  if [ "${HANG_DETECTED:-false}" = true ]; then
    echo -e "\033[0;33m  ⚠ 행(hang) 발생 — 포렌식 덤프: $VERIFY_LOG_DIR/forensic-*\033[0m"
    echo -e "\033[0;33m    (원인 판정 전까지 재실행보다 덤프 확인이 우선)\033[0m"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
