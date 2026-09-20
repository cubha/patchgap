# PLAN — 잠수함 패치 검출 (패치노트에 없는 수치 변경)

작성 2026-09-21 · 소스: 세션 대화(사용자 지시) · 상태: **승인 대기**

## 1. 요구사항 (사용자 원문)

> "간접영향 뿐 아니라 실제 통칭 잠수함패치도 우리 시스템에서 체크할수잇어?"
> "롤, tft, pubg전체다 적용되는 얘기임. 간접영향도 중요하지만 잠수함패치도 항상 사용자들
> 입방아에 오르내리기때문에 전체게임 잠수함패치내용이 어떻게오는지, 패치노트에 없는 수치
> 변경을 잡는것도 중요할듯"

- R1. 세 게임(LoL·TFT·PUBG) 전부에 적용한다.
- R2. **패치노트에 없는 수치 변경**을 잡는다.
- R3. 간접효과(`indirect-effect`)와 별개 축이다 — 대체가 아니라 추가.

## 2. 왜 이것이 기존 판정과 다른가 (설계 근거)

지금 `unannounced`에는 세 가지가 섞여 있고, 통계만으로는 구분되지 않는다:

```
(a) 실제 수치가 바뀌었는데 노트에 없음  ← 잠수함 패치       · 미분리
(b) 다른 것이 바뀌어 따라 움직임        ← indirect-effect  · LLM 3단이 이미 분리
(c) 아무것도 안 바뀌었는데 플레이 변화   ← 메타              · 미분리
```

(a)는 **추론 대상이 아니라 대조 대상**이다. 게임사가 원본 수치를 공개하므로 diff하면 증명된다.
이 축이 생기면 남는 `unannounced`는 (c)로 좁혀진다 — 판정의 의미가 선명해진다.

### 2-1. 실측 검증 (2026-09-21, 착수 전 확인 완료)

**LoL** — `data/ddragon/16.17.1` ↔ `16.18.1`(이미 커밋된 파일) diff:

| 엔티티 | 필드 | 변화 | 노트 |
|---|---|---|---|
| 바드 | armor / armorperlevel | 34→32 / 5→4.7 | `"34 + 레벨당 5 ⇒ 32 + 레벨당 4.7"` ✓ |
| 마스터 이 | armorperlevel | 4.5→5 | `"33 + 레벨당 4.5 ⇒ 33 + 레벨당 5"` ✓ |
| 노틸러스 | attackdamage | 61→58 | `"61 + 레벨당 3.3 ⇒ 58 + 레벨당 3.3"` ✓ |

**4/4 전부 노트에 있고 before/after 문자열이 일치한다.** 검출기가 노트를 정확히 재현한다는 것이
증명됐으므로, 어긋나는 순간이 곧 잠수함 패치다. 26.17→26.18은 **잠수함 패치 0건**이며 이것도
증명된 결론이다("없다"를 근거와 함께 말할 수 있는 것이 이 축의 값).

**PUBG** — 축약본 7,217건(official 42.3=1,986 / 43.1=1,614)에서 무기별 `weaponDamageSum /
weaponDamageHits`:

- 원 변화율은 34종이 거의 전부 하락 → **공통 교란**(방어구 보급·교전 거리·봇 비율). 중앙값 −1.51%.
- 공통 모드 제거 후 잔차 |3%p| 초과 **10/34종**.
- MG3(잔차 −10.18%p)는 **노트에 있다**(반동 −15~17%·조준전환 +23%) → 공지 확인.
- FamasG2 −6.91 · Groza −6.71 · ACE32 −5.00 · Beryl −4.35 · HK416 −4.16 · Thompson +5.19 ·
  QBZ95 +4.98 · Mk47 +4.30 · UZI +3.34 → **노트에 한 줄도 없음**. 43.1 노트는 LMG 3종뿐.

**TFT** — Community Dragon `cdragon/tft/ko_kr.json`은 버전 경로(`/16.18/`)가 200이고 유닛별
`stats`(hp·damage·armor·attackSpeed…)와 `ability.variables`(수치 배열)를 갖는다. DDragon의
`tft-champion.json`은 이름·아이콘·cost뿐이라 **쓸 수 없다**.

## 3. 증거 등급 — 게임마다 다르다 (숨기지 않고 화면에 표기한다)

| 등급 | 게임 | 방법 | 성질 |
|---|---|---|---|
| **A. 문서 대조** | LoL · TFT | 게임사 공개 수치 diff ↔ 패치노트 | 반박 불가. "바뀌었다"가 사실 |
| **B. 관측 추정** | PUBG | 무기별 평균 피해/히트, 공통 모드 제거 후 잔차 | **후보**. 수치 변경 외 교란 가능 |

B를 A처럼 말하지 않는다. PUBG 행은 "수치 변경으로 **보인다**"이고, 그 잔차가 공지된 변경의
2차 파급일 수 있다는 점을 함께 적는다(LMG 너프 → 교전이 AR로 이동 → AR 피해 분포 변화).
그 판별은 **기존 LLM 3단 `indirect-effect` 경로가 이미 하는 일**이라 그쪽으로 넘긴다.

## 4. 제약 (엄수)

- **`MatchStatus`·`verdict.ts`·`EFFECT_SIZE_FLOORS`·`pubg-delta.ts classify()` 무수정.**
  잠수함 패치는 **새 판정 상태가 아니다** — 별도 산출물로 내고 기존 델타에 *증거*로 붙인다.
- 기존 판정 산출물·LLM 캐시 불변(`data/aggregated/{26.*,deltas,notes,pubg,tft}/**`·`data/cache/llm/**`).
  PUBG 피해량은 `weapons-{patch}.json`을 고치지 않고 **새 파일**로 낸다.
- `any` 금지 · 미구현은 `throw new Error("TODO(...)")` · 디자인 토큰 Ground Truth.
- `docs/design/prototype/*.html` 소급 수정 금지.
- `git add -A` 금지 — 스크린샷·`*.notify.json`·`scratch.md.precompact-backup-*` 영구 제외.
- 심사 기간(~10/5) 중 `collect.yml`(LoL) 무수정.

## 5. 선결 결정 (사용자 승인 필요)

| # | 결정 | 기본안 |
|---|---|---|
| D1 | **Community Dragon 채택 여부** — 라이엇 공식이 아닌 미러다. npm 의존성은 늘지 않지만(fetch만) SCOPE §3 "대안 채택 금지 — 바꾸려면 SCOPE 문서를 먼저 갱신한다"에 걸린다 | 채택 + SCOPE §3 갱신. 대안이 없다(TFT 유닛 수치를 주는 공식 소스 부재) |
| D2 | **PUBG를 넣을지** — 증거 등급이 B라 A와 섞이면 "증명"의 신뢰가 희석될 수 있다 | 넣되 등급을 화면에 명시 |
| D3 | **과거 패치 소급** — `data/ddragon`에 16.17.1·16.18.1만 있어 지금은 26.17→26.18 한 쌍만 가능. CDN에 과거 버전이 남아 있어 받으면 26.16도 됨 | 26.16 버전 받아 두 쌍 확보 |

## 6. SubTask

| # | 내용 | 파일 | TDD |
|---|---|---|---|
| ST-1 | 타입 + 순수 diff 엔진 (게임 무관) | `src/pipeline/gamedata/types.ts`·`diff.ts` | **[TDD]** |
| ST-2 | LoL 어댑터 — champion/item diff + 개별 champion JSON 스킬 수치 | `src/pipeline/gamedata/lol.ts` | **[TDD]** |
| ST-3 | `run-ddragon.ts`에 개별 챔피언 JSON **보존** 추가(현재 받고 버림) | `scripts/run-ddragon.ts` | |
| ST-4 | TFT 어댑터 — Community Dragon fetch + 유닛/아이템 수치 diff | `src/pipeline/gamedata/tft.ts` | **[TDD]** |
| ST-5 | PUBG 어댑터 — 축약본 → 무기별 평균 피해, 공통 모드 제거 잔차 | `src/pipeline/gamedata/pubg.ts` | **[TDD]** |
| ST-6 | 노트 대조 — 엔티티 정규화 재사용 + 필드↔한국어 지표 사전 | `src/pipeline/gamedata/note-link.ts` | **[TDD]** |
| ST-7 | 진입점 + npm 스크립트 | `scripts/run-gamedata-diff.ts` | |
| ST-8 | 화면 — 델타 상세·대조표에 증거 줄, 방법론에 축 설명 | `src/components/gamedata/*`·각 상세 페이지 | |
| ST-9 | SCOPE §3 갱신(D1 승인 시) + 방법론 문서 | `docs/scope/SCOPE-*.md`·`docs/design/UX-BRIEF.md` | |

## 7. 산출물 계약

`data/aggregated/gamedata/{game}/{from}_{to}.json`

```ts
interface GameDataDiffFile {
  meta: {
    game: GameId; from: string; to: string;
    source: string;              // "ddragon:16.18.1" | "cdragon:16.18" | "telemetry-reduced"
    evidenceGrade: "document" | "observation";
    generatedAt: string;
  };
  changes: GameDataChange[];
}

interface GameDataChange {
  id: string;                    // gdc:{game}:{to}:{entityKey}:{field}
  entityKey: string;
  entityName: string;
  field: string;                 // "armor" | "gold.total" | "ability.Damage" | "meanDamagePerHit"
  before: number | string | null;
  after: number | string | null;
  relChange: number | null;
  residual: number | null;       // observation 등급만 — 공통 모드 제거 후 잔차(%p)
  matchedNoteIds: string[];      // 비어 있으면 = 잠수함 패치 후보
  announced: boolean;
}
```

## 8. 수용 기준

- LoL 26.17→26.18에서 기본 스탯 4건을 검출하고 **4건 전부 `announced: true`**로 분류한다
  (회귀 고정 — 이 쌍은 잠수함 패치 0건이 정답이다).
- PUBG 42.3→43.1에서 MG3가 `announced: true`, 잔차 |3%p| 초과 나머지가 `announced: false`로 나온다.
- 어느 경로도 `MatchStatus`를 새로 만들지 않는다(`git diff`로 `verdict.ts`·`types.ts` MatchStatus 무변경 증명).
- `verify.sh --full` 전 항목 통과.

## 9. 제외 합의

- X1. PUBG를 A등급(문서 대조)으로 만드는 것 — 무기 수치 공개 덤프가 존재하지 않는다.
- X2. 새 `MatchStatus` 추가 — 제약으로 금지.
- X3. 심사 기간 중 `collect.yml`(LoL) 수정 — 별도 워크플로/수동 실행으로 돌린다.
