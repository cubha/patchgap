# VERIFY-SPEC — 상세 공통 관측 섹션 (ST1~ST7)

기준선: `docs/plan/PLAN-detail-observation-section-2026-10-06.md` (구현 결정 K1~K7 포함)
시안: https://claude.ai/artifact/5Jitae5GfFhk8icKRTDggB

## SubTask별 변경

| ST | 파일 | 요지 |
|---|---|---|
| ST1 [TDD] | `src/components/observation/observationModel.ts` | 「지표[] → 구간[] → 행」 제네릭 묶음 · LoL 자격 필터(`isReportableRecord`) · 순서 · 별칭 id → 초기 선택(자격 없으면 폴백). RED 커밋 ab97901 |
| ST2 | `ObservationSection.tsx`(서버 셸) · `ObservationTabs.tsx`(클라이언트 전환) · `ObservationPanel.tsx`(패널 배치·`NoVerdictBadge`) · `ObservationCauses.tsx`(요약 줄 + `CausesPanel`) | 선택된 패널 하나만 렌더(recharts 폭 0 회피) · WAI-ARIA 탭(화살표·Home·End) · 구간 1개면 선택 상자 대신 텍스트 |
| ST3 | `src/components/detail/LolItemDetail.tsx` | 대조 전체 폭 · 원인 카드 흡수 · 지표 카드 N장 → 섹션 · 쌍 선택 K5 · 머리 뱃지 = 자격 행 대표 · 푸터 쌍 단위(K4) · `StatsGatePanel` 삭제(K3) |
| ST4 | `src/components/tft/TftUnitDetail.tsx` | 3칸 그리드 + 원인 카드 → 섹션(구간 없음) |
| ST5 | `src/components/pubg/PubgWeaponDetail.tsx` | 원인·근거 카드 → 섹션 패널(문장 = prose) · 판정 없는 무기 = 빈 섹션 + 사유 없는 머리(K1) · 스플래시 수치 제거 |
| ST6 | `src/components/pubg/PubgMapDetail.tsx` · `mapRotation.ts` | 기술통계 모드 4탭 · 머리 「판정 없음」 뱃지 · 로테이션 문장 산출물 계산 |
| ST7 | `screen-parity.test.ts` · `observationModel.test.ts` · `UX-BRIEF.md` §8-3-1 | 상세 관측 게이트 · 6번 조사 고정 · 계약 문서 |
| 공용 | `item/chartData.ts`(`valueText`·`valuesChartData`) · `item/ItemChart.tsx`(값 표기 위임·눈금 접기) · `item/SourceMatchesPanel.tsx`(`snapshotHash` 선택) | 네 상세가 같은 차트·원천 칸을 쓰기 위한 하위호환 확장 |

## 구현 결정

- K1~K7은 PLAN 「구현 중 확정한 결정」 절이 정본.
- 기존 테스트 2건 **명세 변경**(보고 대상): `tft/__tests__/verify-impl-regressions.test.tsx` V2(「표본 매치:」 한 줄 → 원천 칩,
  지키는 성질 = ID nowrap·break-all 없음 그대로) · `lol/history/[pair]/__tests__/history-links.test.tsx`(머리 문장 「관측 N건」
  → 「보고할 관측 N건」/「통계 게이트 … 없습니다」, 지키는 성질 = 그 쌍을 그린다 그대로).

## 임시구현·보류

- 없음. stub·하드코딩 없음(맵 로테이션 문장도 산출물 계산).

## 미확인 사항 (critic 확인 요청)

- `ObservationCauses`의 `-mx-5` — `CausesPanel` 행이 자체 `px-5`를 가져 패널 패딩과 겹치는 것을 상쇄한다. 좁은 폭(390px)에서
  가로 스크롤을 만들지 않는지 렌더로 미확인.
- 탭 줄(`flex-wrap`)과 선택 상자가 390px에서 한 줄에 안 들어갈 때 줄바꿈이 자연스러운지 미확인.
- LoL 아이템·라인·오브젝트 상세(구간 축 없음)는 `noSegmentNote`를 주지 않는다 — 선택 상자도 사유도 없이 탭만 선다. 시안은
  LoL 챔피언만 그렸으므로 이 경우의 표기는 판단으로 정했다.
- 자격 조합 0인 LoL 대상(쌍마다 4~6건, 예: 26.18→26.19 녹턴·럼블)의 머리 뱃지는 판정이 선 행(대개 「공지」)에서 고른다 — 「공지」
  뱃지 + 「변화가 없습니다」 머리 문장이 함께 서는 조합이 읽기에 모순되지 않는지.
- PUBG 무기 근거 원천 식별자를 접지 않고 보이게 한 K2가 9/19 사용자 지시와 충돌하지 않는지(문장이 먼저라는 위계는 유지).
