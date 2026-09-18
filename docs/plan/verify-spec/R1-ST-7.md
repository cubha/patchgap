# VERIFY-SPEC R1-ST-7 — 내부 라벨·개발자 메모 문구 정리

- 대상 파일: src/app/item/[id]/page.tsx, src/app/methodology/page.tsx, src/app/pubg/methodology/page.tsx, src/components/compare/CompareExplorer.tsx, src/components/methodology/adapterMatrixData.ts, src/components/methodology/AdapterMatrix.tsx, src/components/pubg/shared.tsx, src/components/methodology/pipelineSteps.ts
- 구현 결정:
  - eyebrow '우선 N ·' 제거(11곳) · 어댑터표 PUBG 열 (설계) 표기 · 푸터 날짜 로그 제거 · '일별 추이' 고지 제거 · STEP1 cron 명시
  - AdapterMatrix 테스트 어서션 갱신(명세 변경)
- 부수 결정:
  - 없음
- 미확인 사항:
  - prototype/*.html 시안의 eyebrow 문구('우선 1 · …')와 이제 다르다 — UX-BRIEF 갱신 필요 여부
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
