# VERIFY-SPEC R1-ST-8 — 홈 패치 내용 탭 3티어 정렬 + 문구 압축

- 대상 파일: src/components/home/releaseStream.ts, src/app/page.tsx, src/components/home/ReleaseNoteStream.tsx, src/components/home/ReleaseNoteRow.tsx, src/components/home/logic.ts
- 구현 결정:
  - contentTier: 치장 3 / 관측 없음 2 / 일치 1 / 불일치 0. 관측 선택은 카드와 같은 selectReportableObservation
  - 정렬 고지 1줄(content 탭에서만)
- 부수 결정:
  - 티어 판정을 releaseStream에서 하고 카드(ReleaseNoteRow)는 기존대로 자체 계산 — advisor는 1회 계산 후 props로 내리라고 했으나 같은 순수 함수를 같은 입력으로 부르므로 결과 불일치 위험 없음(중복 계산 비용만)
- 미확인 사항:
  - 라인 필터 적용 시 티어 순서는 유지되나 '관측 있는 항목' 고지가 빈 티어에서도 뜸
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
