# PLAN — 결정 대기 7건 근본해결 (2026-09-19)

## 1. 사용자 요구사항 (원문)

> 결정이 필요한 항목 전건 근본해결책 방향으로 /braintrust -> 권고방향에 맞게 /sh-dev-loop --tdd --auto 진행.
> 이후 재판단

대상 7건(라운드6 종료 시 사용자 결정 대기로 남긴 목록):

1. 파서 모드 섹션 스코프 + 재매칭 (LLM 캐시 전량 무효 여부)
2. 디스코드 이상 관측 방송 건수 감소가 의도인지
3. LoL 방법론 어댑터 매핑표 유지 여부
4. 라인 선택 시 아이템 제외
5. 기타 변경 블록이 라인 필터와 무관
6. 죽은 링크 `/methodology/#discord`
7. LLM 원인 문장 길이·완곡 종결 제약

## 2. 확정 제약·거부 사항

- 상시: 파괴적 수정·기본 시스템의 목표/틀 수정 지양. 불가피하면 사용자 확인.
- `harvest.py`·`telemetry.py` 무수정 · `data/raw/*`·`.env`·API 키·웹훅 URL 커밋 금지 · `any` 금지 ·
  미구현은 `throw new Error("TODO(...)")` · 브라우저에서 Riot/Claude API 직접 호출 금지 ·
  `git add -A` 금지(`mobile-check.png`·`todo-preview.png` 영구 제외) · SCOPE §3 고정값 선행 갱신 없이 변경 금지.
- **이번 라운드 신규 거부**(근거 `BRAINTRUST-root-fix-2026-09-19.md` §0-1·§5):
  - **노트 재파싱 금지.** 라이엇이 26.18 페이지를 수정해 재파싱 시 노트 19건이 영구 소실된다. 원본 HTML
    아카이브가 없어 복원 불가. 저장된 JSON에 필드만 더하는 마이그레이션으로 간다.
  - **`PatchNoteItem.section`·노트 id 변경 금지.** id에 section이 들어가 두 델타 파일의 `matchedNoteIds`가
    댕글링되고 LLM 캐시 388건이 전량 무효가 된다.
  - **`toCandidateView`·후보 풀·프롬프트 문구·`PROMPT_VERSION`·`DEFAULT_MAX_DELTAS` 변경 금지**(이번 라운드).
    넷 다 캐시를 깨 유료 전량 재호출을 일으킨다. 26.19 신규 실행에 묶는다.
  - **`--no-llm` 재매칭 금지.** 기존 LLM 원인 문장 233건이 소멸한다.
  - `MatchStatus` 열거·`EFFECT_SIZE_FLOORS`·`verdict.ts` 판정 규칙·`pubg-delta.ts`·`next.config.ts` 무수정.
  - 방법론의 `id="discord"` 섹션을 **되살리지 않는다**(2026-09-14 사용자 지시로 제거된 것이다). 링크의
    프래그먼트만 뗀다.

## 3. SubTask 목록 (라우팅: 전량 `[S]` 인라인 — 파일이 서로 물려 독립 4개 미만)

| # | SubTask | 대상 파일 |
|---|---|---|
| S1 | **[TDD]** 모드 스코프 공용 술어 신설 — `NoteModeScope` 타입, 섹션 앵커 → 스코프 변환, `isCoreNote` | `src/pipeline/shared/mode-scope.ts`(신규) + 테스트 |
| S2 | **[TDD]** `PatchNoteItem.modeScope`(필수) 추가 + 파서가 채운다 + 파싱 직후 "모드 앵커 ↔ 스코프" 교차 단언 | `src/pipeline/types.ts`, `src/pipeline/match/patchnotes-parser.ts` |
| S3 | **[TDD]** 결정론 매칭 게이트 — `core` 노트만 챔피언·아이템 버킷 | `src/pipeline/match/entity-match.ts` |
| S4 | **[TDD]** LLM 인용 교정 — 비-core 인용 기각(원인·요약) + 길이·완곡 종결 위반 집계를 `meta`에 | `src/pipeline/match/llm-match.ts` |
| S5 | **[TDD]** 노트 마이그레이션 진입점(재파싱 없이 필드만 추가, 멱등) | `scripts/run-migrate-notes.ts`(신규) + 테스트 |
| S6 | **[TDD]** 검출기 2종 — 커밋된 노트 불변식(`champion\|item ∧ core ⇒ anchorKind="entity"`), 내부 링크 프래그먼트 존재 | `src/pipeline/match/__tests__/notes-invariants.test.ts`, `src/app/__tests__/link-fragments.test.ts`(신규) |
| S7 | 표시층 판정 키 일원화 — `excluded-notes`의 앵커 정규식을 S1 술어에 위임, `display-normalize`를 멱등 가드로 문서화 | `src/pipeline/shared/excluded-notes.ts`, `display-normalize.ts` |
| S8 | 결정 6건 화면 반영 — 디스코드 문구 거짓 수정 · 어댑터 표 약속 문구 · 라인 선택 시 아이템 안내 · 기타 변경 캡션/빈 상태 · 죽은 프래그먼트 제거 | `DiscordPanel.tsx`, `adapterMatrixData.ts`, `FilterBar`/`DeltaTable`, `ReleaseNoteStream.tsx`, `item/[id]/page.tsx` |
| S9 | 데이터 재생성 — 마이그레이션 → 두 쌍 재매칭 → `meta.llm.calls === 0` 확인 → 전후 비교 기록 | `data/aggregated/notes/*.json`, `deltas/*.json` |
| S10 | 문서 기준선 갱신 — UX-BRIEF 표시층 우회 문단, `data/aggregated/README.md` 노트 스키마 | `docs/design/UX-BRIEF.md`, `data/aggregated/README.md` |

## 3-1. 추가 요구사항 (2026-09-19 세션 중 사용자 추가, 원문)

> **[배틀그라운드]**
> - 근거가 전혀 사용자가 알아볼 수 없게되어있어. (위 1번이미지 참조. 사용자는 자연어로 근거를 제공받아야함. (또는 링크))
> - 대조표, 방법론 메뉴를 클릭해도 안들어가지는 버그가 추가발견.
>
> **[리그오브레전드]**
> - 기타변경 항목 > 신규스킨 이미지 등 회귀발생 (안보임), 각 섹션간 분리 모호 (label 및 각 영역간 분리가 명확하지않음), (2번이미지 참조) 동일한 항목에 대한 수정내용들이 여러행으로 별도행처럼 표기됨 -> 통합진행
> - 대조표 > 패치노트 항목의 유익한 관측없는 대상 등 클릭시 표시되는 카사딘 — 유의한 관측이 없어 이 표에 행이 없습니다 >> 시각적으로 전혀 보이질않음. toast로 변경
> - 추정원인 LLM > 패치노트에서 이 변화를 설명할 조항을 찾지 못했습니다, 원인후보 없음 항목이 대다수인거같은데 LLM 판정기준이 어떻게되고 어떤 기준으로 분석하여 판정하는지?

| # | SubTask | 대상 |
|---|---|---|
| S11 | PUBG 상세의 "원천" 블록을 자연어 근거로 — 집계 파일 경로·매치 UUID 나열은 사람이 읽을 근거가 아니다 | `src/app/pubg/weapon/[key]/page.tsx`, `map/[key]/page.tsx` |
| S12 | PUBG 대조표·방법론 메뉴 클릭 불가 버그 진단·수정 | PUBG 헤더/내비 |
| S13 | 홈 기타 변경 — 신규 스킨 이미지 회귀 복구 · 섹션 간 분리(라벨·경계) 명확화 · 같은 항목의 여러 줄을 한 행으로 통합 | `MiscChangesSection`, `miscSections.ts` |
| S14 | 대조표에서 "표에 행이 없습니다" 안내를 toast로 | `CompareExplorer.tsx` |
| S15 | LLM 판정 기준을 방법론에 명시(무엇을 후보로 주고 무엇을 기각하는지) + 사용자 질문 답변 | `src/app/methodology/page.tsx` |

## 4. 수용 기준

- `git diff data/aggregated/notes`가 `modeScope` 추가 줄 외 **0줄**.
- 재매칭 후 `meta.llm.calls === 0`(캐시 100% 적중) — 아니면 중단.
- 재매칭 후 델타의 `matchedNoteIds`가 모드 노트를 가리키는 참조 **0건**(현재 739·845건).
- `causes[].candidateNoteId`·`llm.summaryCites`가 모드 노트를 인용한 채 `verified:true`인 행 **0건**
  (현재 282·34건).
- 렌더 텍스트가 재생성 전후로 동일(표시층이 이미 같은 말을 하고 있었으므로) — 다르면 사유를 기록.
- `bash verify.sh --full` PASS.

## 4-1. 수용 기준 실측 결과 (2026-09-19)

| 기준 | 목표 | 실측 |
|---|---|---|
| `notes` diff가 `modeScope` 추가뿐 | 0 | **0** — 구조 비교로 세 파일 전부 modeScope 외 차이 0건 |
| 재매칭 LLM 호출 | 0 | 26.17→26.18 **0콜**(캐시 110 적중) · 26.16→26.17 **45콜**(아래 사유) |
| 델타가 모드 노트를 가리키는 참조 | 0 | **0** (이전 739 · 845건) |
| 모드 노트를 인용한 `verified` 원인 | 0 | **0** (이전 282 · 34건) |
| 모드 노트를 인용한 `summaryVerified` 요약 | 0 | **0** (이전 87 · 8건) |
| 댕글링 `matchedNoteIds` | 0 | **0** |

**26.16→26.17에서 45콜이 발생한 이유**(사전 예측과 다른 지점이라 기록한다): 캐시가 깨진 것이 아니라
**LLM 대상 델타 집합이 바뀌었다.** 모드 게이트가 서면서 `announced-inconsistent` 208건 중 122건이
그 상태에서 빠졌고, 대상 선정(상태 우선순위 → |Δ| 상위 120)이 다시 계산되면서 새 델타 45건이
추론 대상이 됐다. 캐시 적중은 75건이었다. 실지출은 캐시 읽기 923k · 출력 20.7k 토큰(약 $1 규모)이고
상한(130콜) 안에서 끝났다. 즉 "$0"은 **판정이 바뀌지 않은 델타**에 대해 성립했고, 판정이 바뀐
델타는 새 추론이 필요했다 — 이건 낭비가 아니라 수정의 결과다.

**상태 분포 변화**

| 쌍 | 공지-불일치 | 공지-일치 | 미공지 | 간접 영향 |
|---|---|---|---|---|
| 26.16→26.17 (전) | 208 | 34 | 10 | 26 |
| 26.16→26.17 (후) | **86** | 30 | 18 | 19 |
| 26.17→26.18 (전) | 64 | 32 | 34 | 15 |
| 26.17→26.18 (후) | 60 | 27 | 38 | 12 |

26.16→26.17의 공지 판정 122건이 다른 게임 모드의 노트 위에 서 있었다는 뜻이다.

## 5. 설계 명세 경로

- 적대검토 종합: `docs/plan/BRAINTRUST-root-fix-2026-09-19.md`
- 화면 기준선: `docs/design/UX-BRIEF.md` · `docs/design/prototype/*.html` · `docs/design/DESIGN-TOKENS.md`
