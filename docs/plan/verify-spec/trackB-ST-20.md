# VERIFY-SPEC — 트랙 B ST-20 패널 유지 + 더 보기 (lol-S13 · pubg-S12, tft-S15 링크 후반)

- 변경 요약: `PanelExpand`(클라이언트, 넘침 실측 시에만 「패널 안에서 스크롤됩니다 · 전체 N개 펼치기 ↓」, 펼치면 상한 해제) — 상세 바로가기 격자(`EntityIndexGrid`)·PUBG 무기 격자(`h-80` 사본 제거)·PUBG 맵 격자. `BriefingListPanel` — TFT·PUBG 브리핑 카드 목록(펼치기 + 「대조표에서 전체 보기 →」 필터 착지). `CompareSplit` `total` → `SplitExpand` 「표 전체 펼치기」(래퍼 `data-expanded` + `PANEL_SPLIT_BODY`의 group 변형으로 행 높이·두 패널 상한 해제). LoL 스트림 머리 「목록 아래 · 유의한 관측 없음 N건 ↓ · 기타 변경 N건 ↓」(패널 안 앵커).
- 구현 결정: 기본 상태는 기존 상한 그대로(9/11·9/20 결정, 사용자 2026-10-11 재확인). LoL 스트림은 좌우 높이 맞춤(`StreamColumnLayout`)이 걸려 펼치기 대신 앵커 바로가기. 넘침은 데이터 개수로 추측하지 않고 렌더 후 실측(ResizeObserver, jsdom에선 첫 측정만).
- 검증: panelScroll 게이트 이동(명세 변경 기록), link-fragments 추출기 수정. 전체 앱·컴포넌트 테스트 통과.
- 미확인 사항: 펼친 상태의 sticky 판정 열·가로 스크롤 동작, 앵커 클릭 시 내부 패널 스크롤 이동은 브라우저 실측 필요(VERIFY). design-lint가 `data-[expanded=true]` 변형을 arbitrary 우회로 볼지 — verify.sh로 확인.
