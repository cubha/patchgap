### VERIFY-SPEC — SubTask ST-9
- 기준선 요구사항: "메트릭 포맷 3벌(`lib/format.ts`·`home/logic.ts`·`item/metricFormat.ts`·`tft/shared.tsx`) → `lib/format.ts` 단일 소스, DeltaMetric 전체 golden 선고정"
- 변경 파일: lib/format.ts(displayMetricKind·formatDisplayValue·DisplayMetricKind) · components/home/logic.ts · components/item/metricFormat.ts · lib/__tests__/metric-format-golden.test.ts(신규)
- 관찰 가능한 계약: LoL 화면 경로 출력 불변(golden 97건 · 정적 HTML 773개 동일)
- 구현 결정: **명세 변경(보고 대상)** — item의 top4Rate·playRate 분류 gold→pp(LoL 항목 상세에 도달하지 않는 TFT 지표, 비율을 정수로 보이던 쪽이 틀린 답). home의 avgPlacement kind undefined(타입 거짓) → "gold"(출력 동일). tft/shared formatMetricValue는 등수 단위(「4.35등」)를 아는 TFT 전용 표기라 통합하지 않음 — DeltaValue kind 유니온에 placement가 없어 합치면 화면 컴포넌트까지 번진다
- 인접 경계: DeltaValue(kind 3종), ItemChart, DeltaTable, ReleaseNoteRow
- 미확인 사항: 없음
