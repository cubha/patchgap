### VERIFY-SPEC — SubTask ST-24 (마크다운 `**` 노출)
- 기준선 요구사항: "`adapterMatrixData.ts`의 `**…**` 2곳을 평문(또는 `<strong>` 렌더)" (PLAN ST-24 · 리뷰 lol-S24)
- 변경 파일: `src/components/methodology/adapterMatrixData.ts`(수정)
- 관찰 가능한 계약: 랜딩·방법론 어댑터 표의 TFT 칸에 `**` 문자가 없다(「보드(참가자)」·「작을수록 개선」 평문).
- 구현 결정: 평문. 강조 렌더를 넣으려면 표 셀이 마크다운을 해석해야 하는데 다른 칸은 전부 평문이라 한 칸만 다른 체계가 된다.
- 인접 경계: `AdapterMatrix.test`가 문구를 고정하고 있다면 깨진다 — 전체 테스트 통과로 확인(안 깨짐).
- 미확인 사항: 없음.
