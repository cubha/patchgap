# VERIFY-SPEC ST-3 — [TDD] observationEta — 창 시작 + N일차 이후 첫 cron(21:00 UTC) · etaLabelKst · cron 상수 워크플로 대조 테스트
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: src/lib/observationEta.ts · src/lib/__tests__/observationEta.test.ts
- 구현 결정:
- `loadTftWindowsForWeb()`는 scripts/shared/calendar의 `loadTftWindows`를 복제(상수+오버레이 머지) — lib가 scripts를 import하지 않으려고. 머지 함수는 같은 것(`mergeTftWindows`).
- `TFT_COLLECT_CRON_HOUR_UTC=21` 상수 — 테스트가 collect-tft.yml cron과 대조.
- PUBG ETA는 만들지 않음(수확 창 규칙이라 N일차 개념이 없다) — 배너가 eta null을 받아 「표본이 쌓이면」으로 말한다.
- 미확인 사항:
- 오버레이 파일 손상(단조 위반)이면 `mergeTftWindows`가 throw → 빌드가 죽는다. 감시자가 쓰는 파일이라 지금까지 유효했고, `scripts/shared/calendar`도 같은 함수를 쓴다.
