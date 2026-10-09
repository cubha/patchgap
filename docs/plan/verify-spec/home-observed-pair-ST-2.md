# VERIFY-SPEC ST-2 — [TDD] homePairOf·pastPairsOf(홈 제외)·resolvePastPair(홈 제외)·pairHref/pairSelectHref(home)·getDefaultPair stub 건너뜀
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: src/lib/pairPages.ts · src/lib/pairRoutes.ts · src/lib/data.ts · pair-routes.test · history-links.test · static-params.test
- 구현 결정:
- `pairHref` 3번째 인자를 목록→홈 쌍(PairLike|null)으로 바꿈(시그니처 변경). 호출부: Header(pairSelectHref), static-params.test.
- 과거 쌍 라우트가 홈보다 **새** stub 쌍(18.3→18.4)도 만든다 → `/tft/history/18_3-18_4/`가 선언 뷰. history-links.test의 링크 검사는 관측 쌍(observedPast)만 돈다(선언만 쌍은 상세 0).
- LoL `getDefaultPair`가 stub을 건너뛴다 — LoL은 stub을 쓰는 파이프라인이 없어 현 데이터에선 무영향.
- 미확인 사항:
- `/tft/history/18_3-18_4/` 안의 링크(상세 0·대조표 링크)가 그 쌍 안에 머무는지는 history-links의 observedPast 루프에서 제외됐다 — 선언 뷰의 링크 집합은 declaration-only.test가 본다.
