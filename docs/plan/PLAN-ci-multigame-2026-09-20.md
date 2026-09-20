# PLAN — TFT·PUBG 정기 수집 CI 배선 (2026-09-20)

## 1. 요구사항 (사용자 원문)

> "TFT PUBG 둘다 진행 /sh-dev-loop --tdd --auto"

직전 맥락에서 사용자가 반려한 내 판단도 요구사항의 일부다:

> "TFT·PUBG 알림도 당연히해야지;;; 지금 안할이유가있어? 뭐 받아야해?"

— 내가 "9/24 이후에 붙이자"고 한 것은 비용을 미룬 것이지 품질 논거가 아니었다
([[feedback_no_deferral_to_data_refresh]]와 같은 계열). 알림 자체는 그 지적을 받아 세 게임
전부 구현·실전송(204)을 마쳤고(PR #39), 이 PLAN은 **남은 절반인 "수집"**을 다룬다.

## 2. 확정 제약

- 판정 엔진·`MatchStatus`·`EFFECT_SIZE_FLOORS` 기존 값·`verdict.ts`·`pubg-delta.ts classify()` **무수정**
- 기존 LoL/PUBG/TFT 판정 산출물·LLM 캐시 불변
- **`collect.yml`의 LoL 동작 회귀 금지** — 9/24 무인 실행이 예선 심사 기간(9/21~10/5) 안에 있고,
  사이트 다운은 대회 자격요건 위반이다
- SCOPE §3 스택 고정(TypeScript 5 / Node 22 / `tsx`), 신규 의존성 임의 추가 금지
- `any` 금지 · 미구현은 `throw new Error("TODO(...)")` · 디자인 토큰 Ground Truth 준수
- `git add -A` 금지 — `mobile-check.png`·`todo-preview.png`·`docs/submission/screenshots/**`·
  `tft-*.png`·`scratch.md.precompact-backup-*`·`*.notify.json` 영구 제외
- `--no-verify` 금지 · `.env`·API 키·웹훅 URL 커밋 금지

## 3. 판정 ①~⑥ (근거 포함)

### ① TFT는 **별도 워크플로**(`collect-tft.yml`). 확정.

지배적 근거는 패치 축 차이가 아니라 **폭발 반경**이다. `collect.yml`의 9/24 실행은 심사 기간 중
무인으로 돌고, 그 잡의 `Commit + push` 스텝이 `data/aggregated`를 직접 쓴다. 새 파일은 그 경로에
**위험을 0으로** 둔다. 패치 축 차이(26.x vs 18.x)는 `determine` 스텝을 공유할 수 없다는 부차 근거다.

**단, 리밋은 키 단위로 공유된다.** `src/pipeline/collect/tft-client.ts` 헤더 실측 기록:
> "여기 붙인 20/1s ∧ 100/120s는 `riot-client.ts`(LoL)와 **같은 예산을 나눠 쓴다**. 두 파이프라인을
> 동시에 돌리면 합계가 리밋을 넘어 양쪽 모두 429를 맞는다. … **순차 실행이 전제다.**"

그리고 **18.3 예상일이 2026-09-24**로 LoL 26.19와 **같은 날**이다(18.1 8/25 → 18.2 9/9, 간격 15일).
따라서 새 워크플로는 `collect.yml:83`과 **문자 그대로 같은** concurrency 그룹을 써야 한다:

```yaml
concurrency:
  group: patchgap-collect      # collect.yml:83과 1글자도 달라선 안 된다
  cancel-in-progress: false
```

오타 한 글자면 두 워크플로가 독립 그룹이 되어 같은 날 동시 실행 → 양쪽 429. **VERIFY-SPEC의
검사 항목으로 박는다.**

### ② TFT 패치 캘린더 = **수기 상수**(LoL `PATCH_CALENDAR`와 같은 패턴). 이번 라운드 확정.

이미 존재한다 — `scripts/run-tft-collect.ts:25` `TFT_PATCH_WINDOWS`. 다만 **스크립트 안에** 있어
워크플로의 `determine` 스텝이 읽을 수 없다. `src/pipeline/collect/`로 승격한다(LoL은
`src/pipeline/collect/patch-calendar.ts`에 있다 — 같은 자리).

노트 인덱스 크롤링으로 자동 발견하는 것이 궁극적 해법이나 **이번 라운드 범위 밖**이다.

### ③ PUBG 수집은 **TS로 이식한다**. 범위 = harvest + telemetry reduce 양쪽.

`docs/plan/provenance/2026-09-16-pubg-harvest/README.md`가 스스로 승격 조건을 적어 뒀고, **그 조건이
이미 충족됐다**:
> "**승격 계획**: PUBG 탭을 실제로 출하하기로 하면 `src/pipeline/collect/pubg/`에 TypeScript로
> 재구현한다(`collect/*`만 외부 I/O를 한다는 디렉토리 규칙 준수). 그때 이 디렉토리는 삭제한다."

PUBG 탭은 출하됐다(`/pubg/` 라이브). Python을 CI에 그대로 얹는 것은 SCOPE §3 스택 이탈이므로
이식이 유일한 경로다.

**두 파일의 검증 가능성이 정반대다:**

| | 오프라인 검증 | 근거 |
|---|---|---|
| `telemetry.py` (reduce-on-ingest) | **가능** | `data/raw/pubg/matches` 549MB + `telemetry-reduced/` **7,217건**이 로컬에 있다. 같은 입력을 새 TS로 돌려 기존 산출물과 diff하면 그게 회귀 하네스다. API 예산 0 |
| `harvest.py` (라이브 수집) | **불가** | 실호출 필요 |

### ④ PUBG 비교 창은 **CLI 인자로 파라미터화**한다.

`scripts/run-pubg-aggregate.ts:34` `WINDOW_BEFORE`/`WINDOW_AFTER`가 42.3/43.1 날짜로 하드코딩돼
있다. 패치쌍과 요일정렬 창을 인자로 받되, **기본값은 현행 상수를 유지**해 기존 산출물 재생성이
바이트 동일하게 나오는지 확인할 수 있게 한다.

### ⑤ 프리플라이트 — 401과 403을 **구분**한다.

|  | 뜻 | 사용자 조치 |
|---|---|---|
| **401** | 개발 키 만료(24h) | 키 재발급 |
| **403** | TFT 제품 미승인 | Riot 심사 대기 — 사람이 할 일 없음 |

둘 다 수집을 진행할 수 없으나 조치가 다르므로 메시지를 갈라야 한다(2026-09-20 실측으로 이미
구분된 신호임을 확인했다 — 같은 키가 LoL 200 / TFT 403).

**심사 기간 중 빨간 실패 알림이 반복되는 것도 비용**이므로, 프리플라이트가 401/403을 만나면
잡을 **실패시키지 않고** `::warning::` + `should_run=false`로 깨끗이 종료한다. 진짜 오류(5xx·네트워크)는
그대로 실패시킨다 — 조용히 삼키면 "돌고 있다"는 착각을 만든다.

### ⑥ 재전송 방지 — 두 층.

- **PUBG**: `loadGameSource`에 패치쌍 불일치 가드가 이미 있다(PR #39). 산출물이 `deltas.json`
  하나라 인자가 어긋나면 낡은 브리핑이 나가는데, 그 경우 전송 전에 죽는다.
- **TFT**: 산출물이 `deltas-{from}-{to}.json`이라 파일명 자체가 패치쌍을 들고 있다. 중복 실행
  가드는 LoL과 같은 방식(산출물 존재 확인)으로 `determine`에 둔다.

**⚠️ 여기에 조용한 함정이 하나 있다.** `TFT_PATCH_WINDOWS`의 18.2는 `endMs: null`(=지금 라이브)이다.
18.3이 나왔는데 이 상수를 아무도 안 고치면:

1. `determine`이 18.2를 여전히 라이브로 본다
2. 중복 가드가 "`deltas-18.1-18.2.json` 이미 있음" → `should_run=false`
3. 워크플로가 **초록불로 스킵**된다 — 영원히. 사람은 정기 수집이 도는 줄 안다

LoL도 같은 성질이지만(캘린더에 없는 주는 no-op), 심사 기간 중 TFT는 신호가 필요하다.
**라이브 창의 `endMs`가 null인데 그 산출물이 이미 있으면 `::warning::`을 낸다** — "캘린더가
낡았다, 다음 패치를 추가하라"는 뜻이다.

## 4. 실행 순서 — TFT 먼저, 별도 커밋

두 절반의 **시계가 다르다**:

| | 다음 패치 | 예선(9/21~10/5) 내 발화 |
|---|---|---|
| TFT 18.3 | **≈9/24** (18.1→18.2 간격 15일) | **있다 — 이번 주** |
| PUBG 43.2 | ≈10/8 (43.1 9/9 + 실측 주기 27~35일) | **없다** |

따라서 TFT CI(ST1~ST4)를 먼저 완결·커밋하고 그 다음 PUBG 이식(ST5~ST9)에 들어간다. 이식이
길어져도 18.3은 이미 덮인다.

## 5. SubTask

```
[Task] TFT·PUBG 정기 수집 CI 배선          라우팅: 전량 [S]

── Phase A · TFT (선행 커밋) ─────────────────────────────────
  ST1 [TDD] TFT 패치 캘린더 승격 + 라이브/스테일 판정
            → src/pipeline/collect/tft-patch-calendar.ts (신규)
            → scripts/run-tft-collect.ts (re-export로 호환 유지)
  ST2 [TDD] 키 프리플라이트 분류 (401 ≠ 403 ≠ 진짜 오류)
            → src/pipeline/collect/tft-preflight.ts (신규)
  ST3       워크플로 신규 — concurrency 그룹 공유·프리플라이트 게이트
            → .github/workflows/collect-tft.yml (신규)
  ST4       npm scripts 정리 + determine 스텝이 쓸 진입점
            → package.json · scripts/tft-determine.ts (신규)

── Phase B · PUBG (후행 커밋) ────────────────────────────────
  ST5 [TDD] telemetry reduce TS 이식 — 기존 7,217건 산출물 대조 회귀
            → src/pipeline/collect/pubg/reduce.ts (신규)
  ST6 [TDD] matchId 파싱·패치 라벨링 이식 (README 함정 #1)
            → src/pipeline/collect/pubg/match-id.ts (신규)
  ST7       harvest I/O 계층 + 진입점
            → src/pipeline/collect/pubg/harvest.ts · scripts/run-pubg-collect.ts (신규)
  ST8 [TDD] 집계 비교 창 파라미터화 (기본값 = 현행 상수)
            → scripts/run-pubg-aggregate.ts
  ST9       PUBG 패치 캘린더 + 워크플로
            → src/pipeline/collect/pubg/patch-calendar.ts · .github/workflows/collect-pubg.yml
```

### `[TDD]` 태그 근거 (3-AND)

ST1·ST2·ST5·ST6·ST8은 (a) 결정론 로직 + 명확한 I/O 계약 (b) vitest 존재 (c) 비자명 — 셋 다
충족. ST3·ST4·ST7·ST9는 YAML·I/O 계층이라 **단위 러너로 판정할 수 없어** 절대제외.

### 라우팅 — 전량 `[S]` (독립 후보 5개지만 병렬 불가)

독립 후보는 5개(ST1·ST2·ST5·ST6·ST8)로 임계값 4를 넘지만, **worktree 격리가 검증을 깨뜨린다**:
ST5의 회귀 하네스가 `data/raw/pubg/`를 읽는데 그 경로는 gitignore(`/data/raw/*`, `.gitignore:47`)라
**worktree에 존재하지 않는다**. 하네스 없는 이식은 이 SubTask의 유일한 안전망을 잃는 것이므로
`[S]`로 간다. Phase A→B 순서 제약(§4)도 같은 방향이다.

## 6. 검증 계획 — YAML은 `verify.sh`가 못 본다

`verify.sh --full`이 통과해도 **워크플로가 실제로 도는지는 아무것도 말해주지 않는다**. 따라서
신규 워크플로 둘 다 `workflow_dispatch`를 갖추고, **실제 dispatch 실행을 VERIFY에 포함한다**
(사용자에게 넘기는 후속 과제로 두지 않는다 — `--auto`에는 그것을 잡을 확인 게이트가 없다).

## 7. 제외 합의 (이번 라운드에 하지 않는 것)

- TFT 노트 인덱스 크롤링 자동 패치 발견 (③ — 수기 상수로 간다)
- PUBG 패치노트 파서 (현행 수기 입력 유지 — 노트 5항목 규모라 파서 ROI가 아직 없다)
- 랜딩 카드 레이아웃 변경 (게임 4개째를 붙일 때 같이 — 심사 기간 중 무이득 변경 회피)
- `docs/plan/provenance/2026-09-16-pubg-harvest/` 삭제 (README의 승격 계획은 삭제를 말하지만,
  이식본이 실호출로 검증되기 전에는 원본을 지우지 않는다)
