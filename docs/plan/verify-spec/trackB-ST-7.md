# VERIFY-SPEC — 트랙 B ST-7 랜딩 매치 정의 (lol-S14)

- 변경 요약: `GameLandingCard.pairMatches`(쌍 전후 합) — 세 카드 표본 줄의 「N매치」가 같은 정의(LoL은 사후만 → 전후 합). 히어로 「분석한 매치」 정의(각 게임이 수집한 매치, LoL 전 패치 합)는 유지하고 아래에 구성 한 줄 `landingMatchBreakdown`(게임별 수, 합 = 히어로). ST-6 패널 문구는 `TILE_LABELS.gap` 상수로(§8-5 사본 금지 게이트).
- 구현 결정: 히어로를 카드 합으로 바꾸지 않는다 — `landing.ts` 기존 결정(이미 쌓은 표본을 작게 말하지 않는다). 수용기준의 「구성이 표기된다」 분기.
- 검증: `landing.test.ts` 2건(실데이터 표본 줄 = pairMatches, 구성 합 = 히어로).
- 미확인 사항: 구성 줄이 375폭에서 줄바꿈되는 모양은 렌더 실측 전.
