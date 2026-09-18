# VERIFY-SPEC R1-ST-6 — 파서 before===after 항목 제거 + 26.18 notes 1건 제거

- 대상 파일: src/pipeline/match/patchnotes-parser.ts, data/aggregated/notes/26.18.json
- 구현 결정:
  - items.push 시 before!==null && before===after 제거
- 부수 결정:
  - notes 파일은 재파싱하지 않고 커밋본에서 해당 1건만 제거 — 라이엇이 26.18 페이지를 개정해(증강 항목 28→2) 라이브 재파싱은 18건이 추가로 사라지므로 provenance 보존을 위해 수술적 제거
- 미확인 사항:
  - 다음 CI 자동 수집(26.19)에서 notes가 라이브 재파싱될 때 26.18과의 항목 수 차이는 정상
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
