### VERIFY-SPEC — SubTask ST-2
- 기준선 요구사항: "쓰기 토큰 범위 — 5 워크플로 checkout `persist-credentials: false`, push 스텝에서만 extraheader 주입, patch-watch 매일 push 인증 카나리아(`git push --dry-run`) + 가드 테스트"
- 변경 파일: .github/workflows/{ci,collect,collect-tft,collect-pubg,patch-watch}.yml(수정) · scripts/__tests__/workflow-credentials.test.ts(신규)
- 관찰 가능한 계약: npm ci·tsx 스텝 시점 .git/config에 토큰 없음. "Commit + push" 스텝만 GH_TOKEN env + extraheader 설정 후 push/pull --rebase. patch-watch changed=false 날엔 카나리아가 `git push --dry-run origin HEAD:$GITHUB_REF`로 쓰기 인증 확인(실패 시 잡 빨간불).
- 구현 결정: 헤더 형식은 checkout@v4와 동일(basic x-access-token). push 스텝 이후엔 upload-artifact뿐이라 토큰이 남아도 임의 코드 실행 지점 없음.
- 인접 경계: push 재시도 루프의 `git pull --rebase origin main`(같은 스텝이라 헤더 공유), collect-tft/pubg의 `git restore/clean`(로컬, 인증 불필요), Vercel git 연동(봇 커밋 감지 — 무변).
- 미확인 사항: 로컬 검증 불가 — 브랜치 ref로 patch-watch workflow_dispatch를 돌려 카나리아 통과를 확인해야 한다(머지 전 필수). `--dry-run`이 up-to-date일 때도 receive-pack 인증을 거치는지는 dispatch 결과로 확정(실패 로그면 카나리아 설계 수정).
