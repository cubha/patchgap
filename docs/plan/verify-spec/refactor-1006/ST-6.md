### VERIFY-SPEC — SubTask ST-6
- 기준선 요구사항: "`defaultSleep`/`backoffMs` 3벌 → `pipeline/shared/retry.ts`(base는 인자)"
- 변경 파일: pipeline/shared/retry.ts(신규) · collect/riot-client.ts · collect/tft-client.ts · discord/webhook.ts
- 관찰 가능한 계약: 백오프 = base×2^attempt(Riot 1000ms · Discord 500ms 유지), sleepImpl 주입 경로 불변
- 구현 결정: 각 파일에 `const backoffMs = (a) => exponentialBackoffMs(BASE_BACKOFF_MS, a)` 얇은 바인딩을 남겨 호출부 무수정
- 인접 경계: Retry-After 헤더 우선 로직(무변)
- 미확인 사항: 없음(collect·discord 테스트 312건 통과)
