### VERIFY-SPEC — SubTask ST-11 (푸터 판정 수)
- 기준선 요구사항: "`verdictCount(rows, qAlpha)` = 보고 자격 행 수(타일 「유의한 관측」과 같은 수). 세 게임 모든 `SiteFooter` 호출부가 이것을 넘긴다(TFT 696·PUBG 47 → 유의 건수)" (PLAN ST-11 · 리뷰 tft-S12·S17·parity-S34·pubg-S5)
- 변경 파일: `src/pipeline/shared/headline.ts`(수정 — `verdictCount`·`pubgVerdictCount`) · 호출부 13곳(LoL 브리핑·대조표·상세·방법론 / TFT 브리핑·대조표·상세·방법론 / PUBG 브리핑·대조표·무기·맵·방법론) · `__tests__/headline.test.ts`(RED 554dee7)
- 관찰 가능한 계약: TFT 두 쌍의 푸터 「판정 N건」이 다르고 각각 그 쌍의 타일 「유의한 관측」과 같다. PUBG 푸터는 47이 아니라 보고 자격 판정 수(7). LoL 푸터는 1931이 아니라 76(26.19).
- 구현 결정: 라벨 「판정」은 그대로(어휘 통일은 B1) — 세는 것만 바꿨다. 관측 전 화면(`nVerdicts={0}`)은 불변.
- 인접 경계: `screen-parity.test`가 푸터 컴포넌트 경유만 보므로 영향 없음. 방법론 `MethodologyLayout.nVerdicts` prop 의미 변경(호출부 3곳 모두 갱신).
- 미확인 사항: 없음.
