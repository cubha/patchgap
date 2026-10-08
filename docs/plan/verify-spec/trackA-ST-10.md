### VERIFY-SPEC — SubTask ST-10 (Gap 탭 지표 축 = 대조표 미공지 칩)
- 기준선 요구사항: "`metricGapEntities(rows, qAlpha, numericKeys)`: 수치 축 대상은 지표 축 목록에서 뺀다(한 대상은 한 섹션). 머리 숫자는 **대상 수**(= 칩). 타일 = 수치 축 + 지표 축. TFT·PUBG 적용" (PLAN ST-10 · 리뷰 parity-S7·tft-S18·tft-S9)
- 변경 파일: `src/pipeline/shared/gap-total.ts`(수정 — `tftMetricGapRows`·`pubgMetricGapRows`) · `src/lib/gapTotals.ts`(수정) · `TftBriefing.tsx`·`PubgBriefing.tsx`(수정 — 목록·머리 「대상 N종」) · `__tests__/gap-total.test.ts`(신규, RED 72c9ddd)
- 관찰 가능한 계약: 수치 축 키 집합에 든 대상의 행은 지표 축 목록에 없다. `tftGapTotal` == 수치 축 대상 수 + 지표 축 목록 대상 수. 머리 글자 「대상 N종」.
- 구현 결정: 함수 이름을 PLAN의 `metricGapEntities`에서 `*MetricGapRows`로 바꿨다 — 목록 렌더가 행을 필요로 하고 대상 수는 호출부가 Set으로 센다. LoL은 스트림 구조(노트 카드)라 지표 축 목록이 따로 없어 적용하지 않았다(PLAN대로).
- 인접 경계: 대조표 칩(`countByFilter`)은 그대로 — 그쪽은 수치 축 대상의 상태를 `submarine`/`note-mismatch`로 덮어 「미공지」 칩에서 이미 빠져 있다. 디스코드 브리핑(`run-notify`)은 `tftGapTotal`만 쓴다(불변).
- 미확인 사항: TFT 18.2→18.3 실제 머리 수가 대조표 칩 21과 같은지 렌더로 확인하지 않았다(가정: 같은 술어 `displayStatus === "unannounced"` + 보고 자격 — 칩 쪽은 `entityRows` 대표 상태라 동률 노트 처리가 미세하게 다를 수 있다).
