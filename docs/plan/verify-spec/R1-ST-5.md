# VERIFY-SPEC R1-ST-5 — 방법론 STEP4 유의 변화 = 홈과 같은 술어

- 대상 파일: src/app/methodology/page.tsx
- 구현 결정:
  - isSignificantDelta(row, meta.qAlpha ?? FDR_ALPHA)
- 부수 결정:
  - 없음
- 미확인 사항:
  - pipelineSteps 테스트는 입력 숫자만 받으므로 술어 변경을 직접 검증하는 테스트는 없음(페이지 코드)
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
