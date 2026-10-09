# VERIFY-SPEC ST-7 — [TDD] 커밋 데이터 실측 테스트 + parity 행(NewerPatchNotice, lol 제외)
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: src/app/__tests__/home-observed-pair.test.tsx · src/app/__tests__/screen-parity.test.ts
- 구현 결정:
- 실측 테스트는 선언만 쌍이 없으면 조기 return(규칙은 tftLatestPair.test가 본다).
- parity 행은 tft·pubg만(LoL은 stub 파이프라인 없음) — 조건문으로 제외, 사유 주석.
- 미확인 사항:
- 18.4 관측이 들어오면(10/10) 배너 검사들이 전부 조기 return — 그 뒤엔 규칙 테스트만 남는다. 고정 fixture로 바꾸려면 tftData 로더에 dataRoot 주입이 필요(현재 cwd 고정).
