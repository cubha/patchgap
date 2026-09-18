# VERIFY-SPEC R1-ST-9 — 대조표 기본 정렬 priority

- 대상 파일: src/components/compare/logic.ts, src/components/compare/CompareExplorer.tsx
- 구현 결정:
  - SortKey 'priority' = STATUS_SORT_PRIORITY → |Δ|; 기본값
- 부수 결정:
  - 헤더 클릭 정렬은 기존 3키 그대로(priority는 헤더 버튼 없음 — 기본으로만 돌아옴 불가)
- 미확인 사항:
  - priority 상태에서 헤더를 클릭해 absDelta로 바꾼 뒤 priority로 되돌릴 UI가 없음(새로고침 필요)
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
