# VERIFY-SPEC — 트랙 B ST-18 TFT 브리핑 목록 상한 제거 (tft-S15)

- 변경 요약: `components/tft/briefingOrder.ts` `sortBriefingRows`(정렬만, 자르지 않음) — `TftBriefing` 공지·미공지 목록이 `topRows(…,15)` 대신 사용. 머리 대상 수 = 렌더 묶음 수.
- 구현 결정: 높이는 공용 `PANEL_SCROLL_BODY`가 막는다(LoL·PUBG와 같은 규약). 「대조표로 가는 링크」(수용기준 후반)는 ST-20 「패널 유지 + 더 보기」에서 세 게임 공통으로.
- 검증: `briefingOrder.test.ts` 2.
- 미확인 사항: 18.1→18.2(미공지 89건 수준)에서 패널 내부 스크롤 길이 — ST-20 넘침 표시와 함께 렌더 확인.
