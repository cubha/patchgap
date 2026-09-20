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
- **API**: 🔴 **현재 키로 차단됨 — 2026-09-20 실호출로 확인(ST1 게이트 결과)**.
  `tft-league-v1`·`tft-match-v1`·`tft-status-v1` 전부 **403 Forbidden**이고, **kr·na1·euw1·jp1
  4개 지역에서 동일**하다. 같은 키의 LoL 엔드포인트(`lol/league/v4`·`champion-rotations`)는
  **200**이므로 키가 죽은 것도, 경로 오류도, 지역 문제도 아니다 — 응답 본문은
  `{"status":{"message":"Forbidden","status_code":403}}`뿐이다. 원인은 **키의 제품 등록에 TFT가
  빠져 있는 것**으로, developer.riotgames.com에서 TFT 제품을 따로 등록해야 풀린다(사용자 조치).
  구조 자체(2025-06-20 summonerId 폐기로 엔트리가 puuid 직통 → LoL harvest 구조 그대로)는
  문서 기준으로 유효하나, **실호출로 확인된 바 없다**.
  → **관측 축(매치 데이터)에 의존하는 ST1·ST3·ST5·ST7은 이 등록이 풀릴 때까지 착수 불가.**
- **아이콘**: DDragon `img/tft-trait/…` 200 확인.
- **패치노트는 키가 필요 없다 — 선언 축은 열려 있다**(2026-09-20 재확인). `patch-18-2`가
  최신이고 `⇒` 364개가 그대로 잡힌다(`18-3`·`19-1`은 404 = 미발행). 즉 **403은 관측 축만
  막고 선언 축은 막지 않는다.**
- **비용**: 개인 키 rate limit은 **키 단위**라 LoL과 수집 예산을 나눠 쓴다. (403이 풀리기 전까지
  이 항목은 무의미하다 — 9/24 크론 충돌 논의도 그때 다시 한다.)

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

## 3-1. 표시 규칙 상속 (사용자 요구 · 2026-09-20 실코드 확인)

> 사용자 원문: "리그오브레전드나 배틀그라운드의 데이터 표시 규칙(우선순위, 바닥이나 표본부족
> 데이터 표기방식, ..)을 동일하게 표현하여 타겟 사용자에게 정말 필요한 정보를 집중적으로
> 제공할 수 있도록 유의해서 작업 진행."

**결론: 트랙 A를 택하면 상속된다 — 새로 만들 것이 없다.** 표시 규칙 3종이 이미
`src/pipeline/shared/`에 게임 무관 단일 소스로 있고, 전부 `DeltaRecord`/`MatchStatus`만 본다.

| 규칙 | 단일 소스 | TFT가 얻는 방법 |
|---|---|---|
| 정렬 우선순위 | `status-order.ts` `STATUS_SORT_PRIORITY` (`Record<MatchStatus, number>` — 누락 시 tsc가 잡는다) | `DeltaRecord.status`를 채우면 그대로 |
| 보고 자격(표본부족·바닥 제외) | `reportable.ts` `isReportableRecord` — 노이즈 아님 ∧ delta 존재 ∧ 유의 ∧ `meetsEffectFloor` | 동일 |
| 상태 접기·회색 | `display-status.ts` `displayStatus`/`isNoiseStatus` | 동일 |
| 무근거 회색 | `DeltaRecord.causes[].verified` + `evidence` | 동일 |

**LoL과 PUBG가 갈리는 지점은 하나뿐이고, 결함이 아니다**(2026-09-20 실코드 확인):

- **정렬 축이 다르다** — LoL은 상태 우선순위 우선, PUBG는 보수적 효과크기
  (`pubg-delta.ts:257`). PUBG 표는 사용자가 고르는 정렬 드롭다운이 따로 있다.
- **보고 술어가 다르다** — LoL `isReportableRecord(record, qAlpha)`(4조건) vs
  PUBG `pubg-status.ts` `isReportable(status)`(상태만). **PUBG 쪽이 느슨한 게 아니다** —
  `pubg-delta.ts` `classify()`가 이미 `PICKUP_MIN_N`→`insufficient-sample`,
  비유의→`no-change`, 바닥 미달→`below-threshold`로 **유의성과 바닥을 상태에 접어 넣어서**
  상태만 보는 것이 그 트랙에서는 동치다.

**TFT 채택**: `DeltaRecord`를 내므로 **LoL 쪽**을 쓴다 — 정렬은 `STATUS_SORT_PRIORITY`,
보고 자격은 `isReportableRecord`. 새 술어를 만들지 않는다(만드는 순간 세 게임이 갈린다).

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

**실행 순서(원안)**: ST1(예산 실측) → ST2 → ST3 ∥ ST4 → ST5 → ST6 → ST7 → ST8.
ST1이 게이트다 — 예산·스키마가 예상과 다르면 여기서 계획을 고친다.

### 8-1. ST1 게이트 실행 결과 (2026-09-20) — 게이트가 걸렸다

ST1을 돌린 결과 §2의 403이 나왔다. 게이트가 설계대로 작동해 **원안을 둘로 쪼갠다**:

| ID | 상태 | 근거 |
|---|---|---|
| ST1 수집 스모크 | 🔴 **차단** | TFT 제품 미등록 → 403 (§2) |
| ST2 도메인 타입 | 🟢 착수 가능 | 순수 TS. `DeltaMetric` 키 **추가**는 기존 8개를 안 바꿔 `candidateSetHash` 무영향(§9). `stats.test.ts:324` 전수 단언은 함께 갱신 |
| ST3 집계 | 🟡 fixture로만 | 입력 `TftMatchSlim` 형태가 **문서 기반 추정**이다 — 같은 문서가 API가 된다고 했다. 실응답 미검증 |
| ST4 패치노트 엔티티 | ✅ **완료 (2026-09-20)** | `tft-notes-parser.ts` + `tft-catalog.ts` 신규, 테스트 33건. 실측 해소율 **66.5%**(119항목·고유 엔티티 65). 명세=`docs/plan/verify-spec/tft-notes-parser-2026-09-20.md` |
| ST5 델타·판정 | 🟡 ST3 의존 | 엔진은 재사용뿐이라 로직은 안전하나 입력이 추정 |
| ST6 레지스트리·테마 | 🟢 **부분 착수 가능** | 배경·램프·키아트는 **데이터 비의존**이고 2026-09-20 확정됐다(아트 8 전술가의 왕관 보라 그레이드 + A안 보라 램프). 레지스트리 편입은 화면이 설 때 |
| ST7 화면 | 🔴 차단 | `data/aggregated/tft/*.json`이 존재할 수 없다. **빈 페이지를 만들지 않는다** |
| ST8 SCOPE·방법론 | 🟢 착수 가능 | 403을 제약으로 기록해야 한다 |

**선행 결정(사용자)**: ① SCOPE 갱신 승인 ② **developer.riotgames.com TFT 제품 등록**
(③ 크론 충돌은 ②가 풀린 뒤로 이월 — 지금 논의해도 무의미)
④ 트랙 A/B → **A 확정**(§3-1: 표시 규칙 상속이 A에서만 공짜다).

## 8-2. 계획에서 벗어난 것 (2026-09-20 · acceptance-critic V3 지적)

**`avgPlacement`(평균 등수)를 1차 범위에 넣었다.** §3 트랙 A 표는 "1차는 이항 두 지표(top4·등장률)로
자르고 평균 등수는 2차로 미룬다"였다. 실구현에서 셋을 다 냈고, 그 판단의 근거는 이렇다:

- **비용이 예상보다 작았다.** 연속 지표용 통계는 이미 있다 — `meanDiffInterval`·`normalCdf`가
  LoL `goldAt10/14`용으로 존재한다. 새로 만든 것은 정규근사 p값 한 함수(`meanDiffP`, 12줄)뿐이고
  그것도 `delta.ts`의 기존 `meanDiffPValue`와 같은 식이다. 판정 엔진은 손대지 않았다.
- **순방률만으로는 꼬리가 안 보인다.** 순방률은 4등/5등 경계 하나만 본다. 「8등이 늘고 3등도 늘어
  순방률은 그대로인데 분산이 커진」 변화를 놓친다. 실측 교차검증에서 두 지표의 방향이 86.8%만
  일치했고, 그 13%가 정확히 그런 경우다.
- **단, 방향이 반대인 유일한 지표라 위험이 있다.** 부호를 안 뒤집으면 상향 패치가 전부 불일치로
  찍힌다. `agreesWithNote`가 뒤집고, `isLowerBetter`가 화면 색을 뒤집는다. 엔진에서 부호가 의미를
  갖는 지점은 `directionAgreement` 하나뿐임을 확인하고 테스트로 박았다
  (`__tests__/run-tft-match.test.ts` "부호는 엔진의 directionAgreement 한 곳에서만 의미를 갖는다").

**이 확장은 사용자 승인을 받은 바 없다.** 계획을 벗어난 사실 자체를 여기 남긴다 — 되돌리려면
`TFT_METRICS`에서 `avgPlacement`를 빼고 `tft-delta.ts`의 ③ 블록을 지우면 된다(다른 곳에 파급 없음).

**다른 두 이탈은 영향이 없다**: ① 엔티티 종류를 `unit·trait·augment` 계획 대신 `unit·trait·item`으로
냈다 — 증강은 API 응답에 필드가 없다(실측). ② `appearRate` → `playRate` 개명(동의어).

## 9. 깨면 안 되는 것

기존 LoL·PUBG **판정 산출물 불변**(`data/aggregated/**` · `data/cache/llm/**`) — `DeltaMetric`에
키를 **추가**하는 것은 기존 8개 값을 바꾸지 않으므로 LoL 판정·`candidateSetHash`에 영향이 없다
(단, `EFFECT_SIZE_FLOORS`가 8종 전수를 단언하는 테스트 `stats.test.ts:324`는 함께 갱신해야 한다).
`any` 금지 · 미구현은 `throw new Error("TODO(...)")` · 디자인 토큰 Ground Truth 준수 ·
런타임 외부 API 호출 0 · `git add -A` 금지.

## 9. TFT 화면 ↔ LoL 화면 격차 (2026-09-21 screen-critic 실측 · 잔여)

ST7(화면)은 "TFT 라우트 4종이 존재하고 판정 결과를 보여준다"까지를 완료 기준으로 삼았다.
독립 검토가 LoL 대비 **구조적 스캐폴드 격차**를 실측으로 열거했다 — 이번 라운드(LLM 원인 배선)의
범위 밖이라 고치지 않았고, 사라지지 않게 여기 적어 둔다.

| ID | 격차 | LoL 대응 |
|---|---|---|
| G1 | `/tft/` 우측 사이드바(매치 평균·디스코드 공유받기) 없음 | `/lol/` 보유 |
| G2 | `/tft/` 홈이 49건·89건 전체 표를 즉시 노출(상위 N 미리보기 + 전체보기 패턴 없음) | 시안 01 · `/lol/` |
| G3 | `/tft/compare/`에 좌측 패치노트 탐색기·상태 필터·정렬 없음 | `/lol/compare/`가 `CompareExplorer` 사용 — **같은 컴포넌트를 TFT만 안 쓴다** |
| G4 | `/tft/unit/[key]/`에 아이콘·CTA·추이 차트·전후 막대차트·통계 게이트/원천 매치 사이드박스 없음 | `/lol/item/[id]/` 보유 |

G4의 **근거 자체는 빠져 있지 않다** — 95% CI·q·표본·바닥 대비·집계 파일 경로를 지표 카드 안에
인라인으로 흡수했다(무근거 회색 원칙 위반 아님). 빠진 것은 제시 **형식**이다.

G3이 가장 값싸다(컴포넌트가 이미 있다). 다만 `CompareExplorer`는 노트 축(엔티티 목록)을
전제하므로 TFT 노트 파서의 해소율 66.5%를 먼저 봐야 한다.

**홈 섹션 순서(대조 → 발견)는 격차로 세지 않는다** — TFT는 PUBG 홈과 같은 순서이고, 시안 01은
LoL 탭 분할 구조의 것이다. 바꾸려면 세 게임을 함께 바꿔야 한다(사용자 결정 사항).
