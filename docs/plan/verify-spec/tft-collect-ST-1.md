### VERIFY-SPEC — SubTask ST-1 (크롤 범위 = 이번 쌍 · 미달 창)
- 기준선 요구사항: "크롤러가 TFT_PATCH_WINDOWS 전 구간(18.1·18.2 등 불필요 패치)을 채우느라 조회 절반 이상 낭비 — 이번 관측 쌍(from·to)만 수집하도록 한정" (PLAN-tft-collect-resilience ST-1)
- 변경 파일: `src/pipeline/collect/tft-crawler.ts`(`selectTftWindows`·`crawlProgress` 신설, ID 조회 span = 목표 미달 창) · `scripts/run-tft-collect.ts`(`--patches`, `progress=` 출력)
- 관찰 가능한 계약: `--patches 18.3,18.4`면 창이 그 둘뿐. raw 재개로 18.3이 이미 2,500이면 `getMatchIdsByPuuid` startTime = 18.4 시작. 전부 찼으면 ID 조회 0회. 캘린더에 없는 패치 지정은 던진다.
- 구현 결정: `--patches` 생략 시 전 창(로컬 수동 수집 호환). `from` 창도 수집 대상에 남겼다 — `run-tft-aggregate --patch FROM`이 raw를 다시 읽기 때문(커밋된 boards-FROM.json 재사용은 matchIds·observedUntil 경로를 바꿔야 해 범위 밖). ID 상한 `target × 미달 창 수 × 2`.
- 인접 경계: `crawlTft` 호출부는 `run-tft-collect.ts` 하나. `storedByPatch` 키는 선택된 창만이라 진행 출력도 이번 쌍만.
- 미확인 사항: 실제 CI에서 `from`이 이미 찬 상태의 실행당 `to` 적재량 증가폭은 다음 TFT 패치에서야 실측된다. 18.4처럼 라이브 직후 매치 풀 자체가 얇으면 범위를 좁혀도 실행당 상한은 풀 크기가 정한다.
