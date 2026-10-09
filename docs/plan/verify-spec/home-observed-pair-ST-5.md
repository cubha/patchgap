# VERIFY-SPEC ST-5 — GameChrome.homePair · PatchPairOption.observed → select 「· 선언만」 · pairSelectHref 홈 기준
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: src/app/layout.tsx · src/components/Header.tsx · header-pair-select.test
- 구현 결정:
- 세 게임 크롬 모두 `homePair` 추가(PUBG 관측=pair, 선언 크롬=null). TFT pairs는 `loadTft(p)!==null`로 observed 플래그 — 쌍마다 번들 읽기(빌드 1회).
- select 라벨 「18.3 → 18.4 · 선언만」. 선택 시 pairSelectHref(home)로 과거 쌍 라우트.
- 미확인 사항:
- TFT pairs 플래그 계산이 쌍 수만큼 무거운 번들을 읽는다(현재 3쌍). 쌍이 10개를 넘으면 메타만 읽는 경량 판정으로 바꿔야 한다.
