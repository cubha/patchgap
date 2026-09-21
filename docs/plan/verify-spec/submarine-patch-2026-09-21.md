# VERIFY-SPEC — 잠수함 패치 검출 (ST-1~ST-9)

기준선: `docs/plan/PLAN-submarine-patch-2026-09-21.md`

## 구현 결정

- **`MatchStatus` 무수정.** 잠수함은 `DisplayStatus`(표시 계층) 확장이다. `DISPLAY_SORT_PRIORITY`가
  exhaustive `Record`라 키를 더하자 tsc가 `format.ts` 라벨 누락을 즉시 잡았다 — 의도한 장치다.
- **산출물 분리.** `data/aggregated/gamedata/{game}/{from}_{to}.json`. 기존 판정 산출물·LLM 캐시 불변.
- **모드 스코프 게이트**(`isRiftItem`): `item.json`이 전 모드를 담아 칼바람 아이템 5종이 후보로
  잡혔다. `maps["11"] === true`만 통과. `maps` 자체가 없으면 **제외**(보수적).
- **`effectBurn`의 `"0"`은 미사용 슬롯**이다. 한쪽이 빈 슬롯이면 값 변경이 아니라 배열 재배치로 본다.
- **빈 `fieldKeywords` = 스킬 일치만으로 공지.** DDragon이 `effect[i]`의 의미를 안 알려주므로
  필드 낱말을 만들 수 없다. 보수적으로 틀리는 쪽(잠수함을 덜 찾는 쪽)을 고른다.
- **PUBG 이중 추정자.** `max`는 표본이 커질수록 커지는 편향 추정자라 이상치 하나로 발화한다
  (실측 FNFal 51.93→56.59, 172/149히트). 최빈값 중 최댓값을 교차 추정자로 두고 **둘이 같은
  방향으로 함께 이동할 때만** 격자 이동으로 본다.
- **PUBG 패치 라벨 매핑**은 `PUBG_PATCH_WINDOWS.telemetryPatch`가 소유한다(`43.1` ↔ `pc-2018-43`).
  스크립트에서 문자열을 따로 만들지 않는다.
- **빈 상태를 숨기지 않는다.** 잠수함 0건은 "못 찾았다"가 아니라 "전부 대조해 어긋난 것이 없다"는
  증명이므로 분모(수치 변경 N건)와 함께 말한다.

## 임시구현·보류

- **ST-10 TFT 어댑터 미구현** — `run-gamedata-diff.ts`가 `throw new Error("TODO(gamedata): ...")`로
  명시한다(조용히 빈 값 반환 금지 규칙). Community Dragon(비공식 미러) 채택은 SCOPE §3 갱신이
  선행이고 그건 **사용자 결정**이다(PLAN §5 D1).
- **PUBG 산출물 미커밋** — 커밋된 축약본 7,217건은 ST-6 이전 생성분이라 `damageGrid`가 없다.
  90건 샘플로 경로만 증명했고(무기 48종, 격자 이동 0건), 실제 산출은 다음 수집부터다.
  스크립트가 격자 미보유 축약본 수를 `::warning::`으로 보고한다.
- **LoL 스킬 축 커버리지**는 `buildSkinIndex`가 받는 챔피언(집계에 등장한 것)에 한정된다.

## 회귀 고정 (실측)

| 대상 | 기대 | 테스트 |
|---|---|---|
| LoL 26.16→26.17 | 수치 변경 17건 · 잠수함 **1건 = 폭풍갈퀴 가격 3000→3200** | `lol.test.ts` |
| LoL 26.16→26.17 | 칼바람 아이템 5종이 후보에 없음 | `lol.test.ts` |
| LoL 26.17→26.18 | 수치 변경 9건 · 잠수함 **0건** | `lol.test.ts` |
| PUBG 42.3→43.1 | 무기 48종 비교 · 격자 이동 **0건** | 스크립트 실행(90건 샘플) |
| 정렬 | `submarine` < `unannounced` < `announced-anomaly` | `submarine.test.ts` |
| 표시 | 지표가 `no-change`여도 수치 변경이 있으면 `submarine` | `submarine.test.ts` |

## 미확인 사항

- **`entityKey` 조인의 전수 확인을 못 했다.** `DeltaRecord.entityKey`와 `GameDataChange.entityKey`가
  챔피언(`MonkeyKing`)·아이템(`6610`)에서 일치함은 실측했으나, 전 엔티티에서 그런지는 표본 확인이다.
  현재 화면은 이 조인을 쓰지 않으므로(섹션이 독립) 영향은 없지만, 행 배지에 얹을 때 문제가 된다.
- **`REWORK_KEYWORDS` 목록이 경험적이다.** 26.17 한 패치에서 관찰한 `"조합식"` 외 다섯 낱말은
  추정이다. 과하게 넓으면 잠수함을 놓친다.
- **PUBG `tolerance` 1.5%가 무기 48종 한 쌍의 실측에서 나왔다.** 다른 패치·다른 표본에서 같은
  값이 맞는지는 확인 못 했다.
- **화면은 LoL 홈에만 붙였다.** TFT/PUBG 홈은 산출물이 생긴 뒤에 같은 컴포넌트로 붙인다.
- **`isReportableRecord` 우회 경로는 아직 화면에 없다.** 섹션이 `gamedata` 파일을 직접 읽으므로
  지표 없는 변경도 나오지만, PLAN이 말한 "델타 행에 배지를 얹는다"는 미구현이다.

## Phase 3 판정 반영 (2026-09-21)

### 반영함
- **`REWORK_KEYWORDS` 테스트 부족**(scope-critic, `DECISION_CHANGED: yes`) — 상수에 낱말 6개가
  있는데 테스트는 `"조합식"` 하나만 덮고 있었다. `it.each`로 **전수 고정**하고, 재작업 특례가
  스킬 키를 무시한다는 규칙도 함께 박았다(개편은 스킬 전체를 갈아엎으므로). 21/21.

### 무시함 — 사유
- **`damageGrid`를 선택 필드로 바꾸라**(scope-critic, `DECISION_CHANGED: yes`). 근거는
  "기존 축약본 7,217건에 그 필드가 없어 읽을 때 깨진다"였다. **실측으로 반증됐다**:
  - 필수인 것은 **생산자**(`reduceTelemetry`)의 반환 타입이고, 그건 항상 그 필드를 만들므로 옳다.
  - **소비자**는 둘 다 안전하다 — `run-pubg-aggregate.ts:84`가 캐스팅하는 `PubgReducedMatch`
    (`aggregate/pubg-weapons.ts:18`)에는 `damageGrid`가 **아예 없다**(추가 필드는 무시된다).
    `run-gamedata-diff.ts`의 `ReducedMatchFile`은 이미 `damageGrid?:` 선택이고 미보유 건수를
    `::warning::`으로 보고한다.
  - **결정적 증거**: 기존 커밋 축약본으로 `run-pubg-aggregate`를 재실행한 결과
    `weapons-42.3.json`·`weapons-43.1.json`이 **바이트 동일**했다. `accuracy-comparison`·
    `deltas`·`map-deltas`는 `generatedAt`만 달랐고(판정 내용 동일) 제약대로 복원했다.

### 축A(acceptance-critic) 판정 반영

- **V3 반영 — 죽은 코드였다.** `buildSubmarineIndex`·`displayStatusWithGameData`를 ST-8에서
  만들어 놓고 **어디서도 호출하지 않았다**(테스트만 덮고 있었다). 섹션이 파일을 직접 읽는 구조라
  동작은 했지만, "된 것처럼 보이는 미배선"은 조용한 빈 값 반환과 같은 종류의 잘못이다.
  대조표(`buildEntityRows`)에 색인을 넘겨 행 상태를 덮도록 배선했다 —
  `EntityCompareRow.key`가 이미 `${entityType}:${entityKey}`라 색인 키와 같은 형식이었다.
  클라이언트 컴포넌트라 색인(메서드 보유)을 직렬화할 수 없어 **평문 배열을 넘기고 클라이언트에서
  색인을 만든다**(`buildSubmarineIndexFromChanges`).
  - 남긴 경계: 델타가 **아예 없는** 엔티티는 대조표에 행이 생기지 않는다. 그 표는 "지표가 움직인
    것들의 표"이고, 델타 없는 잠수함을 억지로 끼우면 표의 의미가 무너진다. 그런 건은 홈의
    `SubmarineSection`이 맡는다 — 누락이 아니라 **의도된 분업**이다.
- **A8 ❓ 해소(증거 공급).** `git diff --stat e614f93..HEAD -- verdict.ts pubg-delta.ts types.ts
  aggregate/stats.ts` → **빈 출력**. 네 파일에서 `submarine` 문자열 **0건**. `MatchStatus` 7종 유지.
- **A9 ❓ 해소(증거 공급).** `verify.sh --full` — Spec·tsc·ESLint·단위 테스트·빌드·design-lint
  전 항목 통과(2회: 배선 전·후).
- **A5(TFT) ⚠️ 유지** — 축A도 "정당한 보류"로 판정했다. D1이 사용자 결정이고 SCOPE를 무단으로
  앞질러 갱신하지 않았다. PLAN §8 문면상 미충족인 것은 맞으므로 표기를 바꾸지 않는다.
- **A6(PUBG) ⚠️ 유지** — 알고리즘·회귀는 고정됐으나 실 산출물은 90건 샘플(무기 48종)이고 PLAN이
  적은 규모(45건×2창·52종)와 다르다. 전량 재축약은 텔레메트리 7,217건 재수신(≈9GB)이 필요해
  이번 라운드에서 하지 않는다. 다음 수집이 격자를 포함해 만들므로 그때 닫힌다.

## verify-impl 2회차 (2026-09-21)

### 축A — 반영·해소
- **V3 해소 확인**(죽은 코드 배선) — 축A가 `CompareExplorer.tsx:27,77` → `entityRows.ts:196-198`
  배선을 독립 확인했다.
- **32→37 정정은 정당한 기준선 갱신으로 판정됨.** 축A 근거: ① 방향이 반대다(구현에 맞춰 깎았다면
  줄어야 하는데 늘었다) ② 방법론 차이가 구체적 반례(카직스·마스터 이)로 뒷받침된다 ③ 실데이터
  스냅샷을 읽는 테스트라 하드코딩 합리화가 아니다. — **내가 내린 판단을 내가 승인하지 않았다는
  것이 이 항목의 요점이다.**
- **`damageGrid` 무시 결정도 타당으로 판정됨** — 축A가 3개 파일을 직접 열어 재확인했다.
- **V7 ❓ 해소(증거 공급)** — `verify.sh --full`에서 단위 테스트가 **동결**했다(포렌식 덤프 생성).
  코드 결함이 아니라 공유 머신 자원 압박이다(이 저장소가 전에 3연속 OOM으로 겪은 그 증상).
  개별 실행으로 동등 검증: `npx vitest run` → **1,399/1,399 통과**. 나머지 축은 verify.sh 안에서
  전부 ✔(Spec·tsc·ESLint·빌드·design-lint). 부수 정리: 이전 세션들이 남긴 정적 서버 4개를 종료했다.
- **V8 ❓ 해소(증거 공급)** — `lol.test.ts` 7/7 통과(26.16→26.17 1건 · 26.17→26.18 0건 회귀 포함).

### 축B — 시안 충족, 갭 1건 보완
- 요청한 5개 확인 항목 전부 ✅. 배지 실측: 잠수함 = `bg #c8a355 / text #030d18 / radius pill`(채움),
  기존 미공지 = `border #c8a355 / bg transparent / radius 4px`(외곽선) — **색은 같은 계열이되 채움과
  모양이 달라** 같은 화면에서 구분된다. design-lint 전 페이지 **error 0**.
- 빈 상태 문구 색 실측 `--fg-2`/`--fg`(회색 `--muted` 아님) — 요구 충족.
- **V1 보완** — 랜딩 확장성 표의 TFT 열이 §2-1에 미등재였다. 기능은 처음부터 정합적이었고(게임이
  늘면 표도 늘어야 그 표가 자기 주장을 증명한다) 근거 기록만 빠져 있었다. 등재 완료.

### 남은 것 — 사용자 결정 (재검증 규약 2: 2회차에도 열려 있음)
- **V6 PUBG 산출물 규모.** `data/aggregated/gamedata/pubg/`가 아직 없어 **PUBG 홈에만 섹션이 뜨지
  않는다**. 알고리즘·회귀는 고정됐고 90건 샘플로 경로를 증명했지만(무기 48종·격자 이동 0건),
  PLAN §8 문면(51종)과 다르다. 차이의 원인은 표본 게이트(부위별 120히트) — 사전 분석에는 그 게이트가
  없었다. 전량(7,217건) 재축약은 텔레메트리 ≈9GB 재수신이 필요하다. **42.3 창(9/4~9/8) 텔레메트리는
  336시간 보존이라 곧 만료되므로, 소급하려면 지금이 사실상 마지막 기회다.**

## 전량 노출로 정정 (2026-09-21, 사용자 지시)

지표 축 게이트(`isReportableRecord` — 유의성·효과크기 바닥·표본)는 **지표 축에만** 적용한다.
수치 축은 그 게이트와 무관하다.

| 화면 | 적용 |
|---|---|
| LoL 대조표 | `buildEntityRows`에 합성 행 — `representative`를 `DeltaRecord \| null`로 열고, 관측 0개 행은 링크 없이 이름만 그린다(없는 링크를 만들지 않는다) |
| TFT 대조표 | `buildTftEntityRows`에 합성 행 — 실측 91행 → **114행**(합성 23행), 잠수함 30종이 최상단 |
| PUBG 대조표 | 표 아래 `SubmarineSection` — 이 표는 지표가 `pickupShare` 하나뿐이라 빈 점유율 행이 표를 망가뜨린다. 전량이 보인다는 요구는 섹션으로 지킨다 |
| 세 게임 홈 | `SubmarineSection` — LoL·TFT·**PUBG** 전부 배선(PUBG는 산출물이 생기면 바로 뜬다) |

**PUBG를 반복해서 미룬 것에 대한 기록**: B등급 격하 → 산출물 미커밋 → 홈 섹션 미배선 → 대조표
계획 누락, 네 번이었다. 매번 사유가 "산출물이 아직 없어서"였는데 **코드 경로는 산출물과 무관하게
있어야** 데이터가 생기는 순간 뜬다. 지금은 셋 다 배선돼 있다.


## 2026-09-21 3회차 — PUBG 판별자 교체(6번째) 후 전량 산출

- **판별자**: 값 하나의 이동(max·최빈·순위·집합 생존·유의값 하한 — 5종 전부 폐기)이 아니라 **분포 이동**.
  `src/pipeline/gamedata/pubg.ts compareGrids` — 로그 구간(0.4%) 히스토그램 교집합을 ±120구간 밀어
  최대 겹침을 찾고, 이동 ≥ 3구간(1.2%) 이고 겹침 이득 D ≥ 0.10 이면 이동.
- **보정 근거(실측, 스크래치 분석 → 픽스처로 고정)**: 무변화 대조군(42.3 반반 200셀 · 43.1 반반 181셀) D 최대
  0.021 · 실제 42.3→43.1(191셀) D 최대 0.027 · 합성 ×1.03/×0.97/×1.10 D 중앙값 0.42, 5분위 0.13.
- **알려진 검출력 한계(정직 고지)**: 산탄총(Saiga12·DP12·Sawnoff)·발사기(PanzerFaust)는 펠릿 합산·폭발
  감쇠로 분포가 연속이라 3% 이동에서 D 0.02~0.10 — **놓칠 수 있다.** 무변화에서 임계를 넘은 셀은 0이라
  지어내지는 않는다. 거리 감쇠 곡선만 바뀐 변경(격자 위치가 아니라 꼬리만 변함)도 이 검정의 대상 밖.
- **결과**: 전량 5,079매치(official) · 무기 59종 · 셀 191 → 이동 0 · 잠수함 0. 산출물
  `data/aggregated/gamedata/pubg/42.3_43.1.json` 커밋(이전 90건 샘플 산출물은 폐기됐었다).
- **노트 전개 결함 수정**: PUBG 노트 5건 전부 `entity: null`·`weaponKeys`만 있어 `linkNotes`가 어떤 무기와도
  짝을 못 맞추고 있었다 → `expandPubgNotes`. "차량 피해 배수"는 "피해량" 키워드를 포함하지 않아 플레이어
  피해 격자의 알리바이가 되지 않는다(테스트로 고정).
- **판정 기준 동일화(사용자 지시 2026-09-21)**: 포맷은 게임마다 달라도 되나 **판정 기준**은 같다 —
  잠수함은 표본부족·바닥미달 게이트와 무관하게 전량 노출, 배지 1종(`submarine`, 채운 accent). `StatusBadge`에
  `submarine` 클래스가 없어 LoL·TFT 대조표 행이 **회색 폴백**으로 렌더되고 있었다 → 추가. PUBG 판정표·홈
  배지는 `pubgDisplayStatus`(잠수함이 지표 판정을 덮음)로 통일, "미공지" 칩에 잠수함 포함.
- **테스트 변경 고지(정합성 가드)**: `pubg.test.ts`의 이전 규칙 테스트(이중 추정자·최빈값 판별)는 명세
  자체가 바뀌어 새 계약(실측 픽스처 + 합성 이동)으로 교체했다. `page-order.test.tsx`에는 `server-only`
  mock 1줄 추가 — 페이지가 `@/lib/gamedata`를 import하게 된 뒤 HEAD에서도 suite 로드가 실패하고
  있었다(단언은 변경 없음).

### 3회차 판정 반영 (verify-impl 2026-09-21, 축A acceptance-critic · 축B screen-critic)

1라운드: 축A 기준선 충족(UNMET 1 ⚠️ · ❓ 2) · 축B 이탈 1(낮음). 조치와 근거:

- **A3-1 verify.sh 단위 테스트 240s 타임아웃** — 원인은 코드가 아니라 실행 환경: 121개 테스트 파일 전부 jsdom이라
  환경 생성이 전체의 79%(단독 219s), 유휴 기계에서도 재현. `vitest.config.ts`에 `projects`로 환경 분리
  (`.tsx` 12개만 jsdom, `.ts` 109개는 node — 커밋 513db68). 테스트 파일·단언 무변경, 121 files/1,410 tests 동일,
  61s. 3회차 `verify.sh --full` 전 항목 ✔ EXIT 0.
- **A3-2 보정 수치 출처** — `docs/plan/provenance/2026-09-21-pubg-grid-calibration/`(스크립트 3개 + 실행 결과 +
  README, 커밋 f435e82). TS `compareGrids`와 같은 통계 정의. 원본 축약본은 gitignore(336h 보존 → 재수신 불가).
- **A3-3 run-ddragon.ts** — `ChampionDetailResponse.spells` 타입 선언 16줄(ST-4 잔여), 런타임 변경 없음.
- **B3-1 TFT 방법론 수치 축 카드 위계** — 카드를 "관측" 뒤·"판정" 앞으로 이동(커밋 219b4f0). 판정 카드의 정렬 행에
  "잠수함 패치 →"를 앞에 추가(DISPLAY_SORT_PRIORITY와 일치).

2라운드(델타 재판정) 결과는 아래에 비평가 원문으로 싣는다.

**2라운드 판정(비평가 원문 요지)**
- 축A acceptance-critic: A3-1 ✅ — `vitest.config.ts:14-23` projects 분리 확인, `.ts` 테스트 중 DOM 의존 0건(patch-calendar의
  `window`는 지역 변수), 테스트 파일·단언 무변경. A3-2 ✅ — `output-quantiles.txt:73-91` NULL42 max 0.021 · NULL43 0.000 ·
  REAL 0.027이 README와 일치, `2-shift-statistic.py`와 `pubg.ts:66-75` 통계 정의 동일(한계: 원본 축약본은 gitignore —
  README에 고지). A3-3 ✅ — `run-ddragon.ts:283-299` 타입 선언이 기존 `spells.json` 기록 로직(348-358)의 잔여분으로 정합
  (비평가는 diff를 직접 못 보므로 정적 정합성 판정; 메인이 `git diff` 16+/2− 확인). 결론: 기준선 충족 · UNMET 0 · SPEC 0.
- 축B screen-critic: B3-1 ✅ — `/tft/methodology/` 카드 순서 한계 → 관측 → 수치 축 → 판정, 캡처
  `.playwright-mcp/screen-critic/tft-methodology-impl-r2.png`. 결론: 시안 충족 · DEVIATION 0 · SPEC 0.
