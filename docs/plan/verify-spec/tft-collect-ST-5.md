### VERIFY-SPEC — SubTask ST-5 (워크플로: 브랜치 끝 체크아웃 · TFT 쌍 수집 · collecting stub)
- 기준선 요구사항: "concurrency 대기열 실행이 예약 시점 SHA로 체크아웃해 직전 실행의 데이터 커밋과 rebase 충돌(run 38097140647) — 최신 main 기준으로 수집 산출물을 커밋하도록. 세 수집 워크플로(collect·collect-tft·collect-pubg) 공통 여부 확인" (PLAN ST-5)
- 변경 파일: `.github/workflows/{collect,collect-tft,collect-pubg,patch-watch}.yml`(checkout `ref: ${{ github.ref_name }}`) · `collect-tft.yml`(Collect `--patches "$PATCH_FROM,$PATCH_TO"` · stub `collecting`+`--progress`) · 테스트 `workflow-fresh-checkout.test.ts`(신규) · `collect-tft-workflow.test.ts`(추가)
- 관찰 가능한 계약: git push하는 워크플로 = 정확히 넷, 그 모든 checkout에 `ref: ${{ github.ref_name }}`. 새 push 워크플로가 생기면 목록 단언이 깨져 가드 대상이 된다.
- 구현 결정: rebase 충돌을 "이번 실행 쪽 우선"으로 자동 해소하지 않았다 — 낡은 실행의 stub이 새 관측을 덮어 화면을 되돌릴 수 있다. 근본(낡은 트리에서 판정)을 고쳤다. `ref_name`은 schedule=main, `workflow_dispatch --ref X`=X(기존 push 스텝은 `pull --rebase origin main` 후 push라 동작 동일).
- 인접 경계: determine이 잡 시작 시점 트리를 읽으므로 앞 실행이 관측을 넣었으면 뒤 실행은 no-op. `persist-credentials: false` 개수 단언(workflow-credentials)은 checkout 수 기준이라 영향 없음.
- 미확인 사항: 잡이 도는 동안(최대 120분) 다른 주체가 같은 파일을 push하는 경우(코드 PR 머지 등)는 여전히 rebase 충돌로 멈춘다 — 그건 의도된 fail-loud. 실제 대기열 실행은 다음 연속 실행 때 실측된다.
