# PLAN — 해커톤 채점 라운드1 보완 (2026-09-18)
생성: 2026-09-18 · 소스: 세션 대화 + `docs/plan/SCORECARD-hackathon-2026-09-18.md` §3 · 기준 커밋 `8e44b4b`

## 1. 요구사항 (사용자 원문)
> 이번 제출하는 해커톤의 채점 기준, 채점 표 등 정보 확인 (타 해커톤 정보도 일부 참고 리서치)하고 다음과 같이 진행해줘.
> 1. 위에서 파악된 채점기준과 UI/UX까지 생각해서 채점표 작성 --> 현재 시스템 실동작 검토 후 채점진행 (채점항목은 사용자 기준으로 한눈에 어떤시스템인지 확인되는지, 시스템목적에 맞게 가시성 좋게 표현, 배치되어있는지, 결함데이터는없는지, 불필요한 데이터로 인해서 사용자에게 혼동을 가중하지는 않는지, AI스러운 문구 (불필요한 서술체, 과도한 설명, ..등)와 디자인은 없는지, ...등 기준으로 채점)
> 2. 채점표에 따라 현재 시스템의 보완해야할 사항, 추가/제거해야할 항목 추출하여 /sh-dev-loop --tdd --auto 이후 /verify-impl 및 보완까지 진행
> 3. 보완한 시스템 배포 /ship 진행 후 배포된 시스템 기준으로 다시 채점실행
> 4. 총점 90점 이상 나올때까지 위 과정 반복
> 5. 최종결과 아티팩트로 작성해서 채점표와 채점항목들, 보완사항들 한눈에 알아볼 수 있도록 작성진행
> 특히 이번에 수정한 LLM으로 간접 Gap 내용 표기 부분 확실하게 수정되어 이전처럼 대부분의 대이터가 미파악으로 표현되는 현상이 해소되었는지 등 중점적으로 확인해보며 위 요청사항 진행해
>
> 이때 파괴적인 수정사항이나 기본 시스템의 목표, 틀을 수정하는 행위는 최대한 지양하고, 불가피한상황이면 나한테 확인 후 confirm받고 진행해

### 사용자 확정 (2026-09-18, AskUserQuestion)
- **M1 = "Opus + low는 회색"**: 2단 LLM 모델 `claude-sonnet-5` → `claude-opus-5`, `confidence`를 렌더에서 분리(low 신뢰도 추정은 회색 '가능성' 문장). SCOPE §3·CLAUDE.md 스택 표 선행 갱신.
- **M2 = "분리 표기"**: `announced-inconsistent` 중 비유의(q≥α) 행은 회색 "공지 · 관측 미확인", 방향 반대만 빨간 "공지-불일치". 내부 상태값·판정 엔진 불변, 화면 라벨·색·대조표 칩·방법론 정의문만.
- **M3 = advisor 권장안 따름** → advisor(Plan/opus) 권장 **A안(3티어)**: "UX-BRIEF 01 수용 기준 '상단 캡처가 패치노트 요약 사이트로 읽히면 실패' — 첫 행 치장은 그 실패 자체. 숨기지 않고 아래로 내릴 뿐, 티어 안에서는 노트 순서 유지". 반대 근거(코치 동선)는 정렬 고지 1줄로 상쇄.

## 2. 제약
- MatchStatus 7종·판정 엔진·EFFECT_SIZE_FLOORS·수집기·parser 구조 불변. 승인 시안(9/10·9/15) 레이아웃 불변.
- `data/raw/*` 커밋 금지 · `any` 금지 · SCOPE §3 외 신규 의존 금지.
- 외부 API 호출은 빌드 이전 스크립트에서만. LLM 재실행은 로컬(`.env`)에서 수행하고 산출물(`data/aggregated/deltas/*.json`·`data/cache/llm/*`)을 커밋.

## 3. SubTask (전량 [S] 인라인 — 공유 파일(ReleaseNoteRow·logic·format·StatusBadge) 다수라 worktree 병렬 부적합)

| ID | 태그 | 내용 | 파일 | 채점 항목 |
|---|---|---|---|---|
| ST-1 | — | SCOPE §3 LLM 행·§예산 + CLAUDE.md 스택 표: 2단 간접추론 모델 Opus 5, 상한 120 | docs/scope/SCOPE-patchgap-2026-09-05.md · CLAUDE.md | (M1 전제) |
| ST-2 | [TDD] | `resolveGapCause`에 confidence 분리: verified & confidence≥medium → `verified`(본문색 "추정 원인:"), verified & low → 신규 mode `weak`(회색 "가능성:"). CausesPanel도 신뢰도 표기(검증 ✓ → "신뢰도 높음/보통/낮음") | src/components/home/logic.ts · ReleaseNoteRow.tsx · src/components/item/CausesPanel.tsx · __tests__/logic.test.ts | D2 D3 |
| ST-3 | — | llm-match: `LLM_MODEL="claude-opus-5"`, `PROMPT_VERSION="v3"`, 규칙 추가(사용자용 문장 — "제공된/후보 목록" 언급 금지, 비율은 %·%p, 영문 키 병기 금지, 한 문장 80자 안팎). `run-match` `--llm-max` 기본 120. 재실행 26.17→26.18 · 26.16→26.17 → deltas·캐시 커밋 | src/pipeline/match/llm-match.ts · scripts/run-match.ts · data/aggregated/deltas/*.json · data/cache/llm/* | D3 D4 |
| ST-4 | [TDD] | M2 표시 분리: `displayStatus(record, qAlpha)` 순수 함수(→ `{key:"announced-unobserved"}` 표시 전용 키) · StatusBadge/statusLabel에 표시 키 추가(muted) · NoteNavigator·DeltaTable이 표시 키 사용 · 대조표 칩 "공지-불일치"=유의 반대만, 신규 칩 "공지 · 관측 미확인" · 방법론 정의표 행 분리 | src/pipeline/shared/status-order.ts(또는 significance) · src/lib/format.ts · StatusBadge.tsx · compare/logic.ts · NoteNavigator.tsx · DeltaTable.tsx · methodology/StatusDefinitionTable.tsx · 테스트 | A4 |
| ST-5 | [TDD] | 방법론 STEP4 "유의 변화" = 홈과 같은 술어(`isSignificantDelta`, meta.qAlpha) | src/app/methodology/page.tsx · (헬퍼) src/components/home/logic.ts | B2 |
| ST-6 | [TDD] | 파서: before===after 항목 제거(로그) → notes 26.17·26.18 재생성 | src/pipeline/match/patchnotes-parser.ts · 테스트 · data/aggregated/notes/*.json | B2 |
| ST-7 | — | 문구 정리: eyebrow "우선 N ·" 접두 제거(item·methodology×2·CompareExplorer) · `JUDGMENT_ENGINE_NOTE`·PUBG 실연결 문장 존댓말+사실/제안 구분(어댑터표 PUBG 열 제안 셀 "(설계)" 표기) · PubgFooter 날짜 로그 제거 · item "일별 추이" 고지 제거 · 파이프라인 STEP1 "GitHub Actions cron 자동 수집" 명시 | 해당 파일들 | E3 C2 C3 |
| ST-8 | [TDD] | 홈 "패치 내용" 탭 3티어 정렬(advisor 권장 A안, 2026-09-18): ①관측 불일치 보유 → ②관측 일치 보유 → ③관측 변화 없음 → ④치장. 티어 안에서는 노트 순서 유지. 탭 상단 정렬 고지 1줄("관측이 있는 항목 먼저"). 관측·치장 판정은 스트림에서 1회 계산해 행에 내림. 문구 압축: "효과크기 바닥을 넘는 관측 변화 없음"→"관측 변화 없음 · 바닥 미달", Gap "설명 후보 없음 — 패치노트에서 이 변화를 설명할 조항을 찾지 못했습니다"→"설명 후보 없음 — 노트에 원인 조항 없음"(접두 "설명 후보 없음"은 기존 테스트 계약 유지) | releaseStream.ts(티어 함수) · ReleaseNoteStream.tsx · ReleaseNoteRow.tsx · 테스트 | E2 A2 |
| ST-9 | [TDD] | 대조표 기본 정렬 `priority`(STATUS_SORT_PRIORITY → \|Δ\|) 신설·기본값 | compare/logic.ts · CompareExplorer.tsx · 테스트 | E4 A3 |
| ST-10 | — | 히어로: eyebrow "패치노트가 말한 것 vs 통계가 말하는 것" · h1 · 숫자 span 공백 제거 · 부제를 사용자 언어로 | HeroSummary.tsx | A1 E1 |
| ST-11 | — | PUBG 5라우트 `<main>` 랜드마크 · 본문 링크 `underline` · 히어로 제목 `break-keep` | src/app/pubg/**/page.tsx · PubgPageHeader | E5 B4 |

## 4. 제외 합의
- X1 F9(상세 "원천 매치" 공백): 9/11 확정 옵션 B 레이아웃(좌우 하단 정렬) 재논의 필요 → 이번 라운드 제외.
- X2 PUBG `--danger` 대비(Lighthouse 1건): 상태색 4종은 승인 시안 고정값 → 제외.
- X3 `indirect-effect` 재분류 임계(medium) 불변 — 판정은 바꾸지 않는다(LLM-AB §2-2 D안 기각).

## 5. 완료 조건
1. `verify.sh --full` PASS 2. 26.17→26.18 Gap 행 원인 보유 ≥60%(D3 6점 구간) 3. LLM 요약문 중 "제공된/후보 목록"·소수점 원값 0건 4. 홈 403 = 방법론 STEP4 5. 대조표 첫 행이 Gap/불일치 6. 프로덕션 텍스트에 "우선 N ·"·"적었다"·"발송 2026" 0건 7. 노트 65%⇒65% 0건 8. PUBG Lighthouse a11y ≥ 95.

## 6. 라운드 3 (2026-09-18, 라운드2 92/100 이후 소규모 보완 — SCORECARD §3 G1~G3)
| ID | 태그 | 내용 | 파일 |
|---|---|---|---|
| G1 | [TDD] | 노트→델타 역색인 last-wins → best-row(보고 가능 → 상태 우선순위 → \|Δ\|). 홈 카드·3티어 정렬이 같은 사전을 봄 | src/components/home/noteDeltaIndex.ts(신규) · src/app/page.tsx · src/components/home/releaseStream.ts |
| G2 | — | 대조표 라인 태그 `whitespace-nowrap` | src/components/compare/DeltaTable.tsx |
| G3 | — | LoL 히어로 h1 `break-keep` | src/components/home/HeroSummary.tsx |
