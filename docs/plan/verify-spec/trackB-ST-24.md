# VERIFY-SPEC — 트랙 B ST-24 수치 축 칩·Gap 착지 (tft-S10, tft-S9 착지 수)

- 변경 요약: `COMPARE_FILTERS`에 「잠수함 패치」·「공지값 불일치」(세 게임 공통 6칩). `GAP_FILTER = "gap"` 묶음 필터(미공지 ∪ 잠수함 ∪ 공지값 불일치) — 도구모음에 상태 칩과 줄을 나눈 「미공지 Gap N」 묶음 칩, `useFilterHash`가 `#gap` 착지, `StatTiles.gapHrefOf` → `#gap`.
- 구현 결정: 묶음은 상태 칩이 아니라 「칩 합 = 전체」 셈 밖(그 불변식은 상태 칩만). 산출물 재생성·판정 엔진 무변경(표시 계층).
- 검증: `chip-invariants.test.ts` — 커밋된 전 쌍 × 세 게임에서 ① 칩 합 = 전체 ② `#gap` 결과 수 = 타일 숫자(16 케이스). 명세 변경 6곳 기록.
- 미확인 사항: PUBG는 `pubgDisplayStatus`가 공지값 불일치를 상태로 덮지 않는다(잠수함만) — 현재 PUBG 불일치 0이라 불변식은 통과하나, 생기면 타일과 착지가 어긋날 수 있다(②가 그 순간 실패해 잡는다).
