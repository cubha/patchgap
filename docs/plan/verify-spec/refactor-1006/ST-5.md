### VERIFY-SPEC — SubTask ST-5
- 기준선 요구사항: "`PATCH_ID_PATTERN` 4벌 + `trimmed()` 3벌 → `scripts/shared/cli.ts` 단일 export"
- 변경 파일: scripts/shared/cli.ts(envValue·PATCH_ID_PATTERN export) · scripts/{lol,tft,pubg}-determine.ts · scripts/shared/__tests__/cli.test.ts(추가)
- 관찰 가능한 계약: 같은 env 입력 → 같은 판정·같은 에러 메시지(메시지 문자열 무변). 경로 주입 문자열은 여전히 거부
- 구현 결정: envValue의 env 파라미터 타입은 테스트 주입을 위해 Readonly<Record<string,string|undefined>>
- 인접 경계: GH Actions workflow_dispatch 입력(MANUAL_PATCH 등) — 이 값이 파일 경로로 흘러가는 보안 가드
- 미확인 사항: 실제 Actions 실행은 다음 cron에서(로컬은 단위 테스트 + determine 테스트 통과)
