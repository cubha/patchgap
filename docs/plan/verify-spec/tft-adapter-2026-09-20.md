# VERIFY-SPEC — TFT 어댑터 전체 (2026-09-20)

ST4 파서 명세는 `tft-notes-parser-2026-09-20.md`에 따로 있다. 이 문서는 나머지 전부를 다룬다.

## 범위

| 파일 | 성격 |
|---|---|
| `src/pipeline/collect/tft-client.ts` · `tft-crawler.ts` · `tft-slim.ts` | 신규 — 수집·원본 적재·슬림 변환 |
| `src/pipeline/aggregate/tft-boards.ts` | 신규 — 순수 집계 |
| `src/pipeline/match/tft-delta.ts` · `tft-catalog.ts` | 신규 — 델타·사전 |
| `src/pipeline/discord/targets.ts` | 신규 — 게임별 채널·역할 |
| `src/lib/tftData.ts` · `src/components/tft/shared.tsx` | 신규 — 빌드 타임 로더·표시 조각 |
| `src/app/tft/{page,compare/page,methodology/page}.tsx` | 신규 — 화면 3장 |
| `scripts/run-tft-{collect,notes,aggregate,match}.ts` | 신규 — 진입점 4종 |
| `src/pipeline/types.ts` | **키 추가만** — `DeltaMetric` 3종 · `DeltaEntityType` 2종 · TFT 슬림 타입 |
| `src/pipeline/aggregate/stats.ts` | **키 추가만** — `EFFECT_SIZE_FLOORS` 3종 |
| `src/lib/format.ts` | 라벨·단위 3종 + `isLowerBetter` 신규 |
| `src/lib/game.ts` · `landing.ts` · `app/layout.tsx` · `adapterMatrixData.ts` | TFT 열 추가 |
| `src/styles/tokens.css` · `ambient.css` · `AmbientBackground.tsx` | 램프·키아트·인트로 |
| `scripts/run-notify.ts` | `--game` 옵션 |

## 구현 결정

- **판정 엔진 무수정.** `verdict.ts`·`stats.ts` 함수 본문·`pubg-delta.ts`를 건드리지 않았다.
  `EFFECT_SIZE_FLOORS`에 **키를 추가**한 것은 기존 8종의 값을 바꾸지 않으므로 커밋된 LoL·PUBG
  판정 산출물과 `candidateSetHash`에 영향이 없다.
- **표시 규칙은 상속이다.** TFT가 `DeltaRecord`를 내므로 `STATUS_SORT_PRIORITY`(정렬)·
  `isReportableRecord`(보고 자격)·`displayStatus`(회색 접기)가 그대로 걸린다. TFT 전용 술어를
  **하나도 만들지 않았다** — 만드는 순간 세 게임이 갈린다.
- **원본을 적재하고 슬림을 분리했다.** 실응답을 못 본 상태에서 수집 시점에 변환을 끼우면 추정
  필드명이 파일 형식으로 굳고, 틀리면 재수집(가장 비싼 단계)해야 한다. 실제로 이 판단이
  값을 했다 — 스모크에서 `game_version`이 비어 있고 증강 필드가 없다는 것이 드러났다.
- **패치 구분은 시각 창.** `game_version`이 `"TFT Unreal Version ?.?.?.?"`라 버전으로 못 가른다.
  노트 발행 시각(18.1=8/25 18:00Z · 18.2=9/9 18:00Z)을 경계로 쓰고, 버전 문자열은 **원문 그대로**
  히스토그램에 남긴다(빈 필드로 두면 "왜 시각으로 가르는가"의 근거가 사라진다).
- **랭크 큐(1100)만.** 스모크에서 일반전(1090)이 섞여 들어왔다. 본 수집에서 395건을 걸렀다.
- **등장률 분모는 보드(참가자).** 한 판 8명 × 각자 보드. 같은 보드의 중복 유닛은 1회로 센다.
- **디스코드 레거시 폴백은 lol 한정.** `DISCORD_WEBHOOK_URL`을 전 게임 폴백으로 쓰면 PUBG·TFT
  브리핑이 LoL 채널로 나가 채널 분리의 목적 자체가 깨진다.

## 실측 결과 (최종 데이터)

```
수집   18.1 2,232매치(17,856보드) · 18.2 2,496매치(19,968보드) · 6,145초 · 큐 불일치 395건 제외
노트   ⇒줄 179 · 항목 119 · 미해소 60 · 해소율 66.5% · 고유 엔티티 65
판정   델타 556 · 미공지 89 · 공지일치 45 · 공지불일치 96 · 바닥미달 72 · 무변화 254
       보고 자격 138건 · 짝지어진 델타 141 · 노트가 붙은 엔티티 53/231
검증   verify.sh --full 전 항목 통과 · 테스트 1,207건
```

**정합성 교차검증**: 순방률↑ ↔ 평균등수↓ 일치 138/159(86.8%). 두 지표가 독립 계산인데 방향이
맞는다는 뜻이다(어긋나는 13%는 꼬리 분포가 다른 정상 케이스).

## 중간에 잡은 결함

1. **`!== null`이 `undefined`를 통과시켰다.** `placementSd`가 없는 낡은 집계 JSON이 들어오자
   `se=NaN` → `ci=[null,null]` → `q=1`로 **조용히 죽었다**. 159건이 그렇게 나갔고 에러는 0건.
   `typeof === "number"`로 고치고 회귀 테스트를 박았다. 고친 뒤 미공지 64→87.
2. **재실행마다 창 밖 매치를 다시 조회했다.** 적재분만 기억해서 생긴 예산 누수. 조회한 ID를
   전부 기록하도록 고쳤다(테스트가 잡았다).
3. **세트 필터 부재 시 오탐.** `tft-item.json`의 「12골드」·「4단계」가 엔티티로 잡혔다.
   Set 18 필터로 제거.
4. **`DA_` 전체 허용이 차기 세트에서 샌다.** 세트 19에서 `DA_18_*`이 딸려 들어온다. 번호가
   박힌 키는 번호가 맞아야 통과하도록 막았다.

## 미확인 사항

- **`insufficient-sample`이 TFT에 안 찍힌다.** `assignStatus`의 표본 게이트가
  `metric === "winRate"` 전용이고 엔진 무수정 제약이 있어, 표본 게이트를 델타 생성 시점에 걸었다
  (등장 보드 200 미만이면 순방률·평균등수 행 자체를 안 만듦). 실질 영향은 작다 — LoL에서도 그
  상태는 노이즈로 분류돼 표에서 빠진다. 정확히 맞추려면 `verdict.ts` 한 줄이 필요하다.
- **방향 동률 노트가 「공지 · 이상 관측」으로 찍힌다.** 정확히는 「판정할 수 없음」이다. 18.2에서
  4종(르블랑·마오카이·레오나·케일). 마오카이는 대규모에서 마나를 내렸다가 추가 패치 노트에서
  되돌린 경우로, 노트를 시간순으로 체이닝하면 순변화를 낼 수 있다. **미구현**이고 방법론 화면에
  밝혔다. LoL도 같은 동작이라 이것이 게임 간 어긋남은 아니다.
- **원천 매치 ID 표본이 비어 있다.** 보드 단위 샘플링 규칙을 정하지 않았다. `evidence.matchIds`가
  빈 배열이고, 화면은 그것을 근거 없음으로 읽어 링크를 안 건다.
- **`TFT18_Akali` 조인 실패 1종.** 매치는 `TFT18_Akali`를, DDragon은 `DA_18_Akali_AD`를 쓴다.
  표본부족 1종과 같은 건이라 화면 영향이 없지만 원인은 미규명이다.
- **18.2 한 패치의 노트만 파싱했다.** 18.1 노트는 안 받았다 — 판정은 "after 패치의 노트"만
  쓰므로 현재 흐름엔 필요 없지만, 노트 커버리지를 양쪽으로 보려면 필요하다.
- **화면 3장뿐이다.** LoL·PUBG에 있는 **엔티티 상세**(`/lol/item/*`·`/pubg/weapon/*`)에 해당하는
  `/tft/unit/[key]/`를 만들지 않았다. 대조표에서 엔티티를 눌러 들어갈 곳이 없다.
- **모바일 폭 미검증.** 1280×900에서만 확인했다.
- **디스코드 역할 ID 미설정.** 웹훅은 등록됐으나 `DISCORD_ROLE_ID_*`가 비어 있어 멘션 없이
  발송된다. GitHub Secrets에도 아직 안 넣었다(로컬 `.env`만).
