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

### 2-1. 실측 검증 — 착수 전 전수 확인 (2026-09-21)

세 게임의 현재 보유 데이터로 **실제로 잠수함 패치가 존재하는지** 먼저 확인했다.

| 게임 | 쌍 | 원본 수치 변경 | **노트에 없는 것** |
|---|---|---|---|
| LoL | 26.16 → 26.17 | 챔피언 6종 18건 · 아이템 7종 13건 | **1건** |
| LoL | 26.17 → 26.18 | 챔피언 7종 9건 · 아이템 0건 | 0건 |
| TFT | 18.1 → 18.2 | 유닛 15종 26건 · 아이템 37종 54건 | **32건**(유닛 5 · 아이템 27) |
| PUBG | 42.3 → 43.1 | 무기 52종 피해 격자 | 0건 (+후보 1, 표본 부족) |

**LoL 26.17 — 폭풍갈퀴(id 3095, 맵 11)**

```
공격 속도  20%      → 25%       노트 있음: "공격 속도: 20% ⇒ 25%"
가격      3000골드  → 3200골드   노트 없음                      ★ 잠수함
```

같은 패치에서 활력증진의 펜던트는 `"조합 가격 750골드(총 2,650) → 350골드(총 2,250)"`를 명시했다 —
라이엇은 가격 변경을 공지하는 관행이 있는데 폭풍갈퀴만 빠졌다.

**오탐 2종 (반드시 게이트로 막을 것)**

- **모드 스코프**: 도미닉 경의 인사·필멸자의 운명(맵 30 칼바람), 리글의 랜턴·야생의 섬광(맵 12·453)이
  후보로 잡혔다. `item.json`은 전 모드를 담으므로 **`maps["11"]`로 거른다**. 「클래식」 사건과 같은 축이다.
- **복합 엔티티명**: 노트 엔티티가 `"리글의 랜턴과 야생의 섬광"`이라 정확 일치 매칭은 두 아이템을 모두
  미공지로 오판한다. 부분 문자열 대조가 필요하다.

**TFT** — 장로 드래곤 `damage 110→125`(+13.6%)·`armor 70→75`·`magicResist 70→75`, 조약돌 `damage 30→35`,
아무무 `mana 140→125` 등 유닛 5종이 노트에 이름조차 없다. 아이템 27종도 마찬가지(강철나무
`DamageReduction 0.12→0.14` 등). TFT 노트가 「소규모 변경 사항」에 전부 적지 않는다는 실측이다.

**PUBG — 평균이 아니라 격자를 본다 (설계 정정)**

개별 피격 이벤트의 `damage`는 `기본데미지 × 부위배율 × 방어구계수 × 거리감쇠`의 곱이라 **이산 격자값**이다
(AK47 79발 중 고유값 14개). 기본 데미지가 바뀌면 격자 전체가 같은 비율로 이동하고, **격자 위치는 방어구·
거리 구성이 바뀌어도 움직이지 않는다**. 매치 45건 × 2창으로 무기 52종의 부위별 최대치를 비교한 결과
**51종이 1.5% 이내로 고정**됐다 — 방법 자체의 검증이다. 움직인 것은 FNFal TorsoShot 51.93 → 56.59뿐이고
표본이 172/149로 얇아 미확정으로 둔다. 43.1 노트가 말한 LMG 변경(반동·조준전환·스폰율)은 피해량 축이
아니므로 격자가 안 움직인 것이 정답이다.

⚠️ **앞선 평균 피해/히트 방식(잔차 −10.18%p 등)은 폐기한다.** 평균은 구성 변화에 같이 움직여 전 무기가
한꺼번에 내려가는 공통 모드를 만든다(중앙값 −1.51%). 그것은 기존 `deltas.json`이 이미 하는 "지표가
움직였다"와 같은 종류이지 수치 변경의 증거가 아니다.

⚠️ **텔레메트리 보존 정정**: 42.3 창(9/5)·43.1 창(9/14) 모두 오늘 `HTTP 200`이다. 앞서 "42.3은 336h가
지나 소급 불가"라고 적은 것은 틀렸다 — **세 게임 모두 지금 소급 가능**하다. 다만 축약본
(`telemetry-reduce.ts:113`)이 `damage` 개별값을 합계로 뭉개므로 **리듀서에 격자 보존을 추가해야** 한다.

## 3. 두 축을 가른다 (2026-09-21 사용자 확정)

미공지는 한 종류가 아니다. 사용자 원문: *"패치내용에는 없지만 승률, 픽률, 등 지표가변한 변경 / 패치내용에는
없는데 실제 데미지, 쿨타임, .. 등 수치가 변한 변경(통칭 잠수함패치) — 이거를 명확하게 분리를해야할거같아.
사실상 우선순위도 잠수함패치가 간접영향 변경보다 더 상위가 되어야하는거고"*

| 축 | 무엇이 바뀌었나 | 증거 | 표시 |
|---|---|---|---|
| **수치 축** (신설) | 데미지·쿨타임·가격 등 **원본 값** | 게임사 데이터 대조 | `잠수함 패치` |
| **지표 축** (기존) | 승률·픽률 등 **관측 통계** | 통계 추론 | `미공지` / `간접 영향` |

**표시 정렬 위계** — `잠수함 패치` > `미공지`(0) > `간접 영향`(1) > 나머지 기존 순서.
근거는 중요도가 아니라 **증거 등급**이다: 지표 축은 통계가 "움직였다"고 말하고, 수치 축은 게임사 파일이
"바꿨다"고 말한다. 반박 가능한 것과 반박 불가능한 것을 같은 줄에 둘 수 없다.

**핵심 귀결**: 지표가 하나도 안 움직여도 수치가 바뀌었으면 발견이다. 지금 `isReportableRecord`는 그런 행을
거르므로 **화면에 아예 안 나온다**. 수치 축은 그 필터를 우회해야 한다.

세 게임 모두 증거 등급 A다. PUBG만 소스가 파일이 아니라 경기 로그일 뿐, 읽는 값은 똑같이 **게임이 선언한
상수**다. 다만 격자는 표본에 의존하므로 **부위별 최소 표본(120히트)을 못 채우면 판정하지 않는다** —
`insufficient-sample`과 같은 규율이다.

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

## 6. SubTask · 라우팅 (2026-09-21 확정 · `--tdd --auto`)

**라우팅: 전량 `[S]`** — `[P]` 후보가 4개 미만이다. ST-1이 ST-2·3·5의 타입 소스이고 전부 **같은 신규
디렉토리**(`src/pipeline/gamedata/`)에 들어가 worktree merge가 충돌한다.
전제: git ✅ / `verify.sh` ✅(`--ts-only` 지원) / gbc 미설치(브리지 스킵).

| # | 내용 | 파일 | TDD |
|---|---|---|---|
| ST-1 | 타입 + 게임 무관 diff 엔진 | `src/pipeline/gamedata/{types,diff}.ts` | **[TDD]** |
| ST-2 | LoL 어댑터 — champion/item diff + **`maps["11"]` 모드 게이트** | `src/pipeline/gamedata/lol.ts` | **[TDD]** |
| ST-3 | 노트 대조 — 부분 문자열·복합 엔티티(`"A와 B"`) | `src/pipeline/gamedata/note-link.ts` | **[TDD]** |
| ST-4 | 개별 챔피언 JSON **보존**(현재 받고 버림) | `scripts/run-ddragon.ts` | |
| ST-5 | PUBG 피해 격자 추출·비교(부위별 최소 120히트) | `src/pipeline/gamedata/pubg.ts` | **[TDD]** |
| ST-6 | 리듀서에 격자 보존 필드 추가 | `src/pipeline/collect/pubg/telemetry-reduce.ts` | |
| ST-7 | 진입점 + npm 스크립트 | `scripts/run-gamedata-diff.ts` | |
| ST-8 | `DisplayStatus`에 `submarine` 추가 + 정렬 위계 | `src/pipeline/shared/{display-status,submarine}.ts` | **[TDD]** |
| ST-9 | 화면 — 「바뀐 것」 열 · 배지 · 로더 | `src/components/**` · `src/lib/**` | |
| ST-10 | TFT 어댑터 (Community Dragon) — **D1 승인 대기, 보류** | `src/pipeline/gamedata/tft.ts` | **[TDD]** |
| ST-11 | 문서 — UX-BRIEF·방법론 (D1 승인 시 SCOPE §3) | `docs/**` | |

**핵심 구현 결정**: 잠수함은 `MatchStatus`가 아니라 **`DisplayStatus` 확장**이다
(`src/pipeline/shared/display-status.ts:31`). `DISPLAY_SORT_PRIORITY`가
`Record<DisplayStatus, number>` exhaustive 타입이라 키를 더하면 **tsc가 라벨·배지·정의표의 누락처를
전부 컴파일 타임에 잡는다** — 이 저장소가 `status-order.ts` 헤더에 적어 둔 SSOT 장치를 그대로 쓴다.

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

## 8. 수용 기준 (전부 위 실측으로 회귀 고정한다)

- LoL 26.16→26.17: 잠수함 **1건**이고 그것이 **폭풍갈퀴 가격 3000→3200**이다.
- LoL 26.16→26.17: 맵 30·12·453 아이템 4종이 후보에 **들어오지 않는다**(모드 스코프 게이트).
- LoL 26.16→26.17: 리글의 랜턴·야생의 섬광이 `"리글의 랜턴과 야생의 섬광"` 노트와 **짝지어진다**.
- LoL 26.17→26.18: 수치 변경 9건이 **전부 announced**, 잠수함 **0건**.
- TFT 18.1→18.2: 잠수함 **32건**(유닛 5 · 아이템 27)이고 장로 드래곤·조약돌·아무무가 그 안에 있다.
- PUBG 42.3→43.1: 무기 **51종의 격자가 1.5% 이내로 고정**되고 잠수함 확정 **0건**.
- 지표가 없는 수치 변경 행이 화면에 **나온다**(세라핀 케이스 — `isReportableRecord` 우회 확인).
- `git diff`로 `MatchStatus`·`verdict.ts`·`EFFECT_SIZE_FLOORS`·`pubg-delta.ts classify()` **무변경** 증명.
- `verify.sh --full` 전 항목 통과.

## 9. 제외 합의

- X1. PUBG를 A등급(문서 대조)으로 만드는 것 — 무기 수치 공개 덤프가 존재하지 않는다.
- X2. 새 `MatchStatus` 추가 — 제약으로 금지.
- X3. 심사 기간 중 `collect.yml`(LoL) 수정 — 별도 워크플로/수동 실행으로 돌린다.
