# VERIFY-SPEC — 트랙 B ST-5 노트 탭 순서·어휘 (tft-S20 · parity-S17 · parity-S16 · lol-S22)

- 변경 요약: `noteNav.ts` `noteSectionLabel(game, section)` 단일 출처(대상만 게임 어휘 챔피언/유닛, 아이템·시스템 공통, 미등록 「기타」) + `noteNavSections` 고정 순서(대상 → 아이템 → 시스템 → 그 밖). LoL `NAV_SECTION_LABEL`·TFT `SECTION_LABEL` 사본 삭제. `DeltaTable` 열 헤더 「엔티티」→「대상」, 빈 상태 「델타」→「변화」.
- 구현 결정: 「시스템」(사용자 결정 2026-10-11). 대상 섹션 이름은 게임 어휘 유지(결정 6). PUBG는 노트 섹션이 하나라 탭 없음(변경 없음).
- 검증: `noteNav.test.ts` 2건 신규(순서·라벨). 명세 변경 `render.test.tsx` 2곳.
- 미확인 사항: LoL 방법론의 「노트 17 엔티티」·랜딩 표 「주 엔티티」는 이 ST 범위(대조표) 밖 — ST-12 방법론 문구에서 함께 본다.
