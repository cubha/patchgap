# PLAN — TFT 어댑터 (3번째 게임) · 2026-09-20

소스: 사용자 지시("추가구현대상으로 저장해둬" → "TFT 추가구현 /plan 진행").
실측 근거: `memory/reference_game_adapter_candidates.md`(2026-09-20 실호출).
**상태: 백로그 — 착수 승인 전.** 해커톤 출품은 9/20 제출 완료, 이 작업은 그 이후 대상이다.

---

## 0. 먼저 알아야 할 것 — "어댑터"는 아직 코드가 아니다

계획을 세우기 전에 기존 확장 계약을 코드로 확인했고, **전제 하나가 사실과 달랐다**.

```
grep "interface NoteSource|interface MatchSource|interface AssetSource"  → 0건
```

방법론/랜딩의 어댑터 매핑표가 말하는 `NoteSource.fetch()` · `MatchSource.collect()` ·
`Metric.adoption` · `AssetSource.icon()`은 **개념 이름**이고 TypeScript 인터페이스로 존재하지 않는다.
PUBG는 그 인터페이스를 구현한 게 아니라 **병렬 트랙 29파일**로 붙었다(`git log --diff-filter=A` 전수):

```
scripts/run-pubg-aggregate.ts · run-pubg-assets.ts
src/app/pubg/{page,compare,methodology,weapon/[key],map/[key]}
src/components/pubg/{PubgBriefingTabs,PubgCompareTable,PubgWeaponGrid,PubgDetailSplash,shared,evidenceProse}
src/lib/{pubgData,pubgRoutes}
src/pipeline/aggregate/{pubg-weapons,pubg-maps,pubg-accuracy,pubg-weapon-key}
src/pipeline/match/pubg-delta · src/pipeline/shared/pubg-status · src/pipeline/pubg/asset-path
(+ 테스트 7)
```

그리고 매핑표의 마지막 행 **"판정 엔진 — 게임 무관 · BH-FDR q<0.10 · Newcombe CI · 표본 게이트 ·
짝짓기 · LLM 2단 인용검증"** 은 PUBG에 대해서는 **참이 아니다**:

| 판정 엔진 구성요소 | LoL | PUBG 실제 |
|---|---|---|
| CI | `newcombeDiffInterval` | **자체 로그비 SE** (`pubg-delta.ts:89` `Math.sqrt((1-pBefore)/before + …)`) |
| 다중검정 | BH-FDR `q` | **없음** (행에 `q` 필드 자체가 없다) |
| 효과크기 바닥 | `EFFECT_SIZE_FLOORS` | **게임 데이터에서 유도** (미언급 무기 분포를 귀무분포로) |
| LLM 인용검증 | `llm-match.ts` | **없음** (`evidenceProse.ts` 결정론 문장) |
| 공유되는 것 | — | **`MatchStatus` 타입 하나뿐** (`import type`) |

PUBG가 바닥을 따로 유도한 것은 **옳은 결정이고 근거도 파일에 적혀 있다**(LoL 바닥 8개는 픽/밴
제로섬 구조에서 나온 값이라 픽업 점유율에 쓸 근거가 0). 문제는 결정이 아니라 **화면이 하는 주장**이다.

> **이 계획의 가장 큰 값은 여기에 있다**: TFT는 **판정 엔진을 실제로 재사용할 수 있는 첫 게임**이다.
> PUBG가 못 한 이유는 지표가 "전체 픽업 중 점유율"(거대 n의 비율)이라 LoL 바닥과 축이 달라서인데,
> **TFT의 top4 비율과 유닛 등장률은 둘 다 매치 단위 이항 비율**이다 — Wilson/Newcombe/BH-FDR과
> `EFFECT_SIZE_FLOORS`(절대 %p 바닥)가 설계된 바로 그 모양이다.
> TFT를 아래 **트랙 A**로 붙이면 "판정 엔진은 게임을 모른다"가 **처음으로 사실이 된다.**

---

## 1. 요구사항 (사용자 원문)

> "추가로 어댑터 붙일 수 있을만한 게임이 있을지 위내용과 별개로 리서치 진행해줘. riot이나 pubg
> 게임이면 더좋고. (이미 developer계정있으니까)"
>
> "오캐이. 위내용은 우선 추가구현대상으로 저장해둬."
>
> "병렬로 추가게임구현계획 확인하고 TFT 추가구현 /plan 진행해서 메모리갱신해"

## 2. 확정 사실 (재조사 금지 — 2026-09-20 실호출)

- **패치노트는 LoL과 같은 CMS**: `teamfighttactics.leagueoflegends.com/ko-kr/news/game-updates/teamfight-tactics-patch-18-2`
  (`-notes` 접미 **없음**, `leagueoflegends.com` 도메인은 404). `#patch-notes-container` ·
  `header.header-primary`+`h2[id]` · `h4.change-detail-title` · `blockquote.blockquote context` ·
  `hr.divider` · `⇒` 364개(`<span class="change-indicator">`).
- **엔티티 계층만 다르다**: `h3.change-title` 0건. 엔티티는 **중첩 `<li>`의 머리**다 —
  `<li>검은 가시:<ul><li>체력: 175/300/550 ⇒ 175/350/600</li>…</ul></li>`.
  「소규모 변경 사항」은 엔티티가 줄 앞머리 토큰("카밀 스킬 피해량: …").
  h2 = 체계 · 대규모 변경 사항 · 소규모 변경 사항 · 버그 수정 / h4 = 특성 · 유닛 · 증강 · 수호령.
- **API**: `tft-league-v1`(challenger/grandmaster/master) → `tft-match-v1`(by-puuid ids → match).
  2025-06-20 summonerId 폐기로 **엔트리가 puuid를 직접 준다** → LoL harvest 구조 그대로.
- **아이콘**: DDragon `img/tft-trait/…` 200 확인.
- **비용**: 개인 키 rate limit은 **키 단위**라 LoL과 수집 예산을 나눠 쓴다.

## 3. 트랙 결정 (이 계획의 핵심 판단)

### 트랙 A — LoL 판정 엔진 재사용 **(권장)**

`DeltaRecord`를 그대로 쓰고 `delta.ts`와 같은 모양의 `tft-delta.ts`가 Wilson/Newcombe/BH-FDR·
표본 게이트·`meetsEffectFloor`·`verdict.assignStatus`·`llm-match`를 **호출**한다.

가능한 근거(측정 축이 같다):

| 어댑터 슬롯 | TFT | LoL 대응 | 같은 통계인가 |
|---|---|---|---|
| `Metric.outcome` | **top4 비율** (매치당 8인 중 상위 4) | `winRate` | ✅ 이항 비율 |
| `Metric.adoption` | 유닛·특성·증강 **등장률** (n_등장/n_매치) | `pickRate` | ✅ 이항 비율 |
| 보조 outcome | 평균 등수(1~8) | — | ❌ 연속값 — **1차 범위에서 제외** |
| `Metric.timeline` | `last_round` · `time_eliminated` | `goldAt10/14` | ⚠️ 연속값 — 2차 |
| `Segment[]` | 랭크 티어(챌린저/GM/마스터) | 라인 | ✅ 분할 축 |
| 주 엔티티 | 유닛 · 특성 · 증강 | 챔피언 · 아이템 | ✅ |

**1차 범위는 이항 두 지표(top4 비율 · 등장률)로 자른다.** 평균 등수는 연속값이라 Newcombe가
아니라 Welch/부트스트랩이 필요하고, 그건 "판정 엔진 무수정"을 깨는 첫 단추다. 2차로 미룬다.

### 트랙 B — PUBG식 병렬 트랙

자체 SE·자체 바닥·자체 컴포넌트. 29파일 전례. **권장하지 않는다** — TFT는 지표 축이 LoL과 같아서
병렬로 짤 이유가 없고, 병렬 트랙을 하나 더 만들면 매핑표의 "판정 엔진 게임 무관" 주장이
**두 게임에서 거짓**이 된다.

## 4. 게임 추가 시 건드려야 하는 파일 (실코드 확인 전수)

**확장 계약이 실제로 있는 곳 — 안 고치면 컴파일이 막는다(조용한 누락 없음):**

| 파일 | 무엇 | 컴파일 강제 |
|---|---|---|
| `src/lib/game.ts` | `GameId` 유니온 + `GAMES` 항목(label·prefix·tag·art) | ✅ `defOf`가 throw |
| `src/lib/landing.ts` | `LANDING_LOADERS: Record<GameId, LandingLoader>` | ✅ **Record 전수** |
| `src/components/methodology/adapterMatrixData.ts` | `byGame: Record<GameId, string>` 9행 + `COLUMN_STATUS: Record<GameId, string>` | ✅ **Record 전수** |
| `src/styles/tokens.css` | `:root:has([data-game="tft"])` 램프 | ❌ 산문 — 빠지면 LoL 색으로 렌더 |
| `src/styles/ambient.css` | TFT에서 협곡 아트 3레이어 차단 | ❌ 산문 |
| `public/bg/tft-key-art.webp` | 랜딩 패널 키아트 | ❌ 404로만 드러남 |

> `AdapterMatrix.tsx`·랜딩 `page.tsx`·`Header.tsx`는 **고칠 필요가 없다** — 이미 `GAMES` 순회다
> (2026-09-20 열 레지스트리화 PR #32). 이 계획이 그 설계의 첫 수혜다.

**신규 파일(트랙 A 기준 추정 18~22개):**

```
src/app/tft/{page,compare,methodology}/page.tsx · src/app/tft/unit/[id]/page.tsx
src/pipeline/collect/tft-client.ts · tft-collect.ts
src/pipeline/aggregate/tft-units.ts · tft-traits.ts · tft-augments.ts
src/pipeline/match/tft-delta.ts          ← 얇다. 통계·판정은 전부 호출만
src/pipeline/match/tft-notes-entity.ts   ← 파서의 **엔티티 규칙만** 갈아끼운다(§5)
src/lib/tftData.ts
scripts/run-tft-collect.ts · run-tft-aggregate.ts · run-tft-notes.ts
(+ 각 단위 테스트)
```

**공용 파일 수정(기존 판정 결과 불변이어야 함):**

```
src/pipeline/types.ts          DeltaEntityType +"unit"|"trait"|"augment" · DeltaMetric +"top4Rate"|"appearRate"
src/pipeline/aggregate/stats.ts EFFECT_SIZE_FLOORS 신규 2키 (기존 8개 값 무수정)
src/lib/format.ts              metricLabel·metricKind 신규 2키
src/pipeline/match/patchnotes-parser.ts  엔티티 규칙 주입점(§5)
```

## 5. 파서 — 재작성이 아니라 **엔티티 규칙 교체**

LoL 파서는 이미 두 엔티티 규칙을 상태 기계 하나로 통합해 다룬다(`h3.change-title` 블록 /
라벨 기반 클래식 블록, 2026-09-20 `startsNewEntity`). TFT는 **세 번째 규칙**이다:

```
LoL 표준 : h3.change-title            → 엔티티
LoL 클래식: 소개 문단을 데리고 나온 라벨 → 엔티티      (2026-09-20 추가)
TFT      : 중첩 <li>의 머리            → 엔티티      ← 신규
TFT 소규모: 줄 앞머리 토큰              → 엔티티      ← 신규(사전 대조 필요)
```

fetch·섹션 추적(h2[id])·앵커 정밀도(entity/section/page)·`⇒` 분해·방향 판정(LOWER_IS_BETTER·
서술 힌트)·A⇒A 필터·내용 해시 id는 **전부 그대로 재사용**한다.

⚠️ **「소규모 변경 사항」의 앞머리 토큰은 자유 텍스트다**("카밀 스킬 피해량: …"). 유닛/특성 사전
(DDragon TFT `tft-champion`·`tft-trait`)과 **대조해서만** 엔티티로 인정한다 — 안 그러면 "레벨당
필요 경험치" 같은 시스템 줄이 엔티티가 된다. 이 대조 실패 건은 `section:"system"`으로 떨어뜨린다.

## 6. 수집 예산 (사용자 질문 ③)

개인 키 리밋 **20 req/1s ∧ 100 req/120s** → 지속 처리량 **0.83 req/s**(키 단위, LoL과 공유).

```
LoL 실측    10,000 매치 수집 ≈ 2h44m
TFT 1매치 = 참가자 8명       ← LoL(10명)과 비슷한 밀도
TFT 5,000 매치 ≈ 40,000 참가자 → 유닛 등장률 추정에 충분
  요청 수 ≈ 매치 5,000 + 매치ID 목록(플레이어 ~1,500) ≈ 6,500
  6,500 / 0.83 ≈ 7,800s ≈ 2h10m
```

**충돌 지점**: 9/24 26.19 LoL 크론이 같은 키를 쓴다. 두 게임을 같은 창에 돌리면 리밋을 나눠
써서 **둘 다 느려지거나 429가 난다**. → 크론을 **순차**로 배치하거나(LoL 끝난 뒤 TFT),
Riot에 **Production Key**를 신청해 리밋을 올린다. 착수 전 결정 필요.

> ⚠️ 위 수치는 **산정이지 실측이 아니다**. LoL 2h44m만 실측이고 TFT는 아직 1회도 호출하지 않았다.
> 첫 SubTask에서 소규모 스모크(100매치)로 실측한 뒤 이 값을 교정한다.

## 7. SCOPE 갱신 필요 여부 (사용자 질문 ④)

**필요하다 — 착수 전에 먼저.** 프로젝트 CLAUDE.md: *"대안 채택 금지 — 바꾸려면 SCOPE 문서를
먼저 갱신한다."* PUBG도 같은 절차를 밟았다(§2 Won't를 2026-09-16에 명시적으로 해제).

- **§2 Won't** — 현행은 LoL·PUBG만 전제다. "TFT 어댑터"를 Should/Could에 명시하고 착수 조건
  (Production Key 여부·크론 충돌 해소)을 적는다.
- **§3 기술 스택** — **신규 의존성 0**이다(같은 `fetch`+`bottleneck`+`cheerio`+`@anthropic-ai/sdk`).
  다만 "Riot API 클라이언트" 항목이 LoL 엔드포인트 전제이므로 TFT 엔드포인트를 병기한다.
- **Riot terms** — 아레나/무작위 총력전 통계 금지는 **LoL 모드** 조항이다. TFT는 별개 타이틀이고
  `tft-match-v1`은 개인 키로 열려 있다(발로란트와 달리). 착수 전 terms 재확인 1회는 필요.

## 8. SubTask (트랙 A)

| ID | 내용 | 파일 | TDD |
|---|---|---|---|
| ST1 | **수집 스모크** — `tft-league-v1`→`tft-match-v1` 100매치로 실호출, 6번 예산 수치 교정, 응답 스키마 고정 | `src/pipeline/collect/tft-client.ts` · `scripts/run-tft-collect.ts` | — (외부 I/O) |
| ST2 | 도메인 타입 확장 — `DeltaEntityType`·`DeltaMetric`·`EFFECT_SIZE_FLOORS`·`metricLabel`/`metricKind` | `types.ts` · `stats.ts` · `format.ts` | `[TDD]` |
| ST3 | 집계 — 유닛·특성·증강 등장률 + top4 비율(순수 함수, 입력 `TftMatchSlim[]`) | `aggregate/tft-units.ts` 외 2 | `[TDD]` |
| ST4 | 패치노트 엔티티 규칙 — 중첩 `<li>` 머리 + 사전 대조 앞머리 토큰 | `match/tft-notes-entity.ts` · `patchnotes-parser.ts` | `[TDD]` |
| ST5 | 델타·판정 — 기존 통계/`verdict`/`llm-match` **호출만** | `match/tft-delta.ts` | `[TDD]` |
| ST6 | 레지스트리 편입 — `GameId`·`GAMES`·`LANDING_LOADERS`·`adapterMatrixData`·토큰 램프·키아트 | 6파일 | — (UI) |
| ST7 | 화면 — `/tft/`·`/tft/compare/`·`/tft/methodology/`·`/tft/unit/[id]/` | `src/app/tft/**` | — (UI) |
| ST8 | SCOPE·방법론 갱신 + 매핑표 "판정 엔진 게임 무관" 주장 재검증 | `docs/scope/**` · `adapterMatrixData.ts` | — |

**실행 순서**: ST1(예산 실측) → ST2 → ST3 ∥ ST4 → ST5 → ST6 → ST7 → ST8.
ST1이 게이트다 — 예산·스키마가 예상과 다르면 여기서 계획을 고친다.

**선행 결정(사용자)**: ① SCOPE 갱신 승인 ② 크론 충돌 해소 방식(순차 vs Production Key 신청)
③ 트랙 A/B 확정.

## 9. 깨면 안 되는 것

기존 LoL·PUBG **판정 산출물 불변**(`data/aggregated/**` · `data/cache/llm/**`) — `DeltaMetric`에
키를 **추가**하는 것은 기존 8개 값을 바꾸지 않으므로 LoL 판정·`candidateSetHash`에 영향이 없다
(단, `EFFECT_SIZE_FLOORS`가 8종 전수를 단언하는 테스트 `stats.test.ts:324`는 함께 갱신해야 한다).
`any` 금지 · 미구현은 `throw new Error("TODO(...)")` · 디자인 토큰 Ground Truth 준수 ·
런타임 외부 API 호출 0 · `git add -A` 금지.
