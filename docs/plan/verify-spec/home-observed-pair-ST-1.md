# VERIFY-SPEC ST-1 — [TDD] tftHomePair·loadTft 기본=홈·newerTftDeclarations·latestObservedTftPair.isLatest=홈
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: src/lib/tftData.ts · src/lib/__tests__/tftLatestPair.test.ts
- 구현 결정:
- `tftHomePair()`는 프로세스당 1회 메모이즈(모듈 변수) — 정적 빌드 중 데이터 불변 전제. 테스트는 파일별 격리라 영향 없음.
- `latestObservedTftPair().isLatest`는 항상 true로 바뀜(필드는 호출부 분기 계약 유지용으로 남김).
- `loadTftDeclaration()` 무인자는 목록 첫 칸(stub 포함) — 관측 0일 때 폴백 전용.
- 기존 테스트 2곳의 기대를 옛 규칙(목록 첫 칸)→새 규칙(홈)으로 바꿈: tftLatestPair.test 「isLatest = index===0」→true.
- 미확인 사항:
- 메모이즈가 `vi.mock`으로 loadTft를 갈아끼운 테스트(declaration-only)와 상호작용하는지: 그 테스트는 TftPage 경로만 모킹하고 통과했다.
- 빌드 시간: tftHomePair가 처음 한 번 18.4 stub(작음)→18.3 번들(무거움)을 읽는다. 전과 동일 규모.
