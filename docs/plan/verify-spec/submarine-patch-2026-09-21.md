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
