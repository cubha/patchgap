# VERIFY-SPEC — 트랙 B ST-11 이름 칸 공용 (parity-S19 · parity-S20 · pubg-S22 · pubg-S11 이름 잘림)

- 변경 요약: `compare/CompareNameCell`(아이콘 슬롯 + 「이름 →」 + 유형 줄, nowrap, 아이콘 없으면 슬롯 유지, `hideIconOnMobile`)을 LoL `DeltaTable`·TFT·PUBG 대조표가 사용. PUBG 유형 줄 「무기 · 돌격소총」(`weaponCategoryLabel`, 상세 머리와 같은 함수), 375폭 아이콘 슬롯 숨김(무기명 잘림 원인). TFT 좌측 노트 내비 아이콘: 서버가 판정 산출물 이름 → 대상 키 표(`noteEntityKeys`)를 넘기고 `NoteNavPanel`에 `game` prop(전에는 기본 lol 경로).
- 구현 결정: 말줄임 대신 nowrap(표 가로 스크롤) — LoL `max-w-48 truncate`·PUBG `max-w-40 truncate` 제거. 상세 없는 행은 화살표·링크 없음.
- 검증: screen-parity §8-6 게이트 이동(명세 변경 기록). 전체 컴포넌트·앱 테스트 통과.
- 미확인 사항: 긴 이름(LoL 아이템명)이 nowrap으로 표를 넓혀 1280에서 판정 고정 열과의 사이 스크롤이 생기는지 — 렌더 실측 필요(VERIFY). TFT 노트 이름이 판정 산출물 이름과 철자가 다르면 아이콘 없이 이니셜(지어내지 않음).
