# PLAN — 최종 채점 보완 7건 (2026-09-19)

기준선: 독립 채점 2인(데이터·코드 축 / 화면 축), 대상 `feature/silver_sh @ b24d22b`,
종합 95.4/100(라운드6 98 · 라운드7 92.7). 채점표는 `RUBRIC-user-review-round6-2026-09-18.md`
· `RUBRIC-root-fix-2026-09-19.md`. 점수표 아티팩트: https://claude.ai/artifact/Nghvd8zJ73woWKocLaNLEW

## 1. 사용자 요구사항 원문

> 전건 보완 /sh-dev-loop --tdd --auto 이후 재 판정 진행

직전 지시(이 라운드의 상위 제약):

> 확인필요내용이 무슨내용인지 모르겟고, 이월은없어야해.. 9월24일 뭔지알겟는데 내 최종목표는
> 9월20일이야.최대한 이월없이 전체대상 완료해야해...
> 9월24일이된다해서 엄청난게 변하는게아니잖아...그냥 데이터만 신규패치로 갱신되는거잖아....
> 제발그만좀 발목잡혀라..

## 2. 보완 대상 7건 (채점자 원문의 "보완" 칸)

| # | 채점 ID | 심각도 | 결함 | 기대 상태(채점자 원문) |
|---|---|---|---|---|
| ① | R7 K2-1 | 高 −4 | PUBG 근거 문장이 판정 사유와 어긋남. 바닥 미달 21종이 "95% 신뢰구간이 […]로 0을 포함해"라고 말하나 CI가 0을 포함하지 않음(AK47 [+3.3%, +5.8%]) | 판정 사유별 분기 — 바닥 미달이면 "상대 변화 +4.5%가 효과크기 바닥 N% 미만이라 판정하지 않습니다". CI 0 포함 문장은 CI가 실제로 0을 포함할 때만 |
| ② | R7 K1-7 · K4-4 | 中 −2 | v5 원인 문장 11건이 명사형으로 끝나 합쇼체와 혼입("…밀린 영향." "…파이크로 이동.") | 종결 검사를 프롬프트 규칙 또는 재요청 조건에 추가 → 명사형 0 |
| ③ | R7 K2-7 | 中 −1 | 방법론 실측 28+81=109≠110(`champion:Syndra:TOP:pickRate`가 어느 통에도 없음) + 신뢰도 분포 단위 미명시 | "검증 미통과 1건" 셈에 포함 + 신뢰도 분포에 단위 명시 |
| ④ | R7 K1-4 | 低 −1 | 홈에서 라인 선택 시 아이템이 말없이 사라짐(대조표엔 캡션 있음) | 홈 스트림에도 "아이템은 라인별 집계가 없어 제외" 1줄 |
| ⑤ | R7 K2-5 | 低 −1 | 오리아나 스킨/크로마/예정 3행에 같은 스플래시(Orianna_40) 3회 | 같은 스킨은 스플래시 1회 + 줄 통합 |
| ⑥ | R6 K4-4 | 低 −1 | PUBG "유의한 변화 없음" vs LoL "유의한 관측 없음" 혼용(17 라우트) | 한 어휘로 통일 |
| ⑦ | R6 K2-4 | 低 −1 | 노이즈 상태 상세 라우트 1,870건이 링크 없이 빌드됨 | `generateStaticParams`에서 노이즈 상태 제외(직접 URL 진입 시 404) |

## 3. 확정 제약 (불변)

- **판정 엔진 불변**: `MatchStatus` 열거 · `EFFECT_SIZE_FLOORS` · `verdict.ts` 판정 규칙 ·
  `pubg-delta.ts` `classify()` 무수정. 이번 보완은 전부 **표시·산문·집계 계층**이다.
- **`PROMPT_VERSION`을 올리지 않는다**(②의 설계 결정, §4 참고).
- `git add -A` 금지 — `mobile-check.png`·`todo-preview.png`는 모든 커밋에서 영구 제외.
- `harvest.py`/`telemetry.py` 무수정 · `data/raw/*`·`.env` 커밋 금지 · `any` 금지.

## 4. 설계 결정 (구현 전에 고정)

### ①의 분기는 status가 아니라 **인용하는 수치**에서 나온다

현재 코드는 `!isReportable(status)`로 한 덩어리를 묶어 "CI가 0을 포함해"라고 말한다. 그 묶음에는
성질이 다른 둘이 들어 있다 — `no-change`(CI가 0을 포함, 17종)와 `below-threshold`(CI는 0을
포함하지 않으나 |상대 변화|가 효과크기 바닥 미만, 21종). 그래서 문장을 **status로 고르지 않고
`relCi`가 실제로 0을 포함하는지로** 고른다. 같은 종류의 거짓이 다시 생기지 않는 유일한 방법은
문장이 인용하는 바로 그 수치로 문장을 결정하는 것이다.

`below-threshold` 문장은 바닥 값을 함께 말한다(`deltas.meta.effectFloor` = 0.132). 값을 화면이
이미 방법론에서 말하고 있으므로 새 개념이 아니다.

### ②는 프롬프트가 아니라 **호출부와 캐시**에서 닫는다

프롬프트에 규칙을 더하려면 `PROMPT_VERSION`을 올려야 하고, 그러면 캐시 236건이 전량 무효가 되어
**지금 통과하고 있는 문장까지 전부 다시 굴린다**(새 위반이 다른 자리에 생길 수 있다). 결함은
230건 중 13건이므로 그 13건만 고치는 것이 옳다.

그래서 ㉮ 위생 집계에 `causeNounEnding`을 더하고 ㉯ 재요청 조건을 길이에서 **문장 위생 전반**으로
넓히고 ㉰ **캐시 적중에도 위반 검사를 적용해** 위반이면 1회 재요청하고 결과를 같은 키에 되쓴다.
㉰가 없으면 이미 캐시된 11건은 영원히 고쳐지지 않는다(재생성해도 캐시를 그대로 읽는다).
길이 재요청이 이미 같은 방식으로 v5 키에 되쓰고 있으므로 새 규약이 아니다.

### ⑦의 제외는 "목록"이 아니라 "라우트 생성"에서 한다

노이즈 상태 행은 화면 어디에서도 링크되지 않지만 정적 파일로는 존재한다. `isNoiseStatus`를
`generateStaticParams`에서 걸러 파일 자체가 생기지 않게 한다 — 링크를 지우는 것과 파일을 없애는
것은 다르고, 채점자가 지적한 것은 후자다. 빌드 라우트 2,089 → 약 219로 줄어든다.

## 5. SubTask 목록 (라우팅: 전량 `[S]` — 파일이 서로 물리고 독립 4개 미만)

| # | SubTask | 대상 파일 | TDD |
|---|---|---|---|
| ST-1 | PUBG 근거 문장 분기를 인용 수치에서 도출 | `src/components/pubg/evidenceProse.ts` · `src/app/pubg/weapon/[key]/page.tsx` | `[TDD]` |
| ST-2 | 문장 위생에 명사형 종결 추가 + 재요청 조건 확대 + 캐시 적중 재요청 | `src/pipeline/match/llm-match.ts` | `[TDD]` |
| ST-3 | 방법론 LLM 수치 셈 정합 + 단위 명시 | `src/components/methodology/llmStats.ts` · `src/app/methodology/page.tsx` | `[TDD]` |
| ST-4 | 홈 라인 필터 아이템 제외 고지 | `src/components/home/ReleaseNoteStream.tsx` | — (UI) |
| ST-5 | 기타 변경 스킨 스플래시 중복 제거 | `src/components/home/MiscChangesSection.tsx` | `[TDD]` |
| ST-6 | PUBG 판정 부재 어휘를 LoL과 통일 | `src/app/pubg/weapon/[key]/page.tsx` | — (문자열) |
| ST-7 | 노이즈 상태 상세 라우트 생성 제외 | `src/app/item/[id]/page.tsx` | `[TDD]` |
| ST-8 | 보완 반영 후 두 쌍 재매칭(캐시 적중 + 위반분만 재요청) | `data/aggregated/deltas/*.json` | — (데이터) |

## 6. 수용 기준

| ID | 기준 | 측정 |
|---|---|---|
| A1 | PUBG 47종 전수에서 "0을 포함" 문장은 CI가 실제로 0을 포함하는 행에만 | `out/pubg/weapon/*/index.html` 전수 대조 |
| A2 | 검증 통과 원인의 명사형 종결 0건(두 쌍) | `meta.llm.prose.causeNounEnding` |
| A3 | 방법론 셈이 닫힌다(못 찾음 + 검증 통과 + 검증 미통과 = 시도) | `computeLlmCauseStats` 항등식 테스트 |
| A4 | 홈에서 라인 선택 시 아이템 제외 고지 1줄 | 실렌더 |
| A5 | 같은 `src` 스플래시가 한 엔티티 묶음에서 2회 이상 나오지 않음 | 단위 테스트 + 실렌더 |
| A6 | "유의한 변화 없음" 0건 | 소스·빌드 grep |
| A7 | 노이즈 상태 상세 라우트 0건 | `out/item/` 개수 · 인바운드 링크 전수 200 |
| A8 | `verify.sh --full` 통과 · 판정 산출물 불변식 유지 | 게이트 |

## 7. UI 설계 명세

기존 화면 수정뿐이라 `/frontend-design` 호출 없음(분기 A — 전부 매칭). Ground Truth:
`docs/design/DESIGN-TOKENS.md` · `docs/design/UX-BRIEF.md` · `docs/design/prototype/01-briefing-home.html`.
④의 캡션은 대조표의 기존 문장(`CompareExplorer.tsx:136`)과 같은 어휘·같은 `text-muted` 층위를 쓴다.
