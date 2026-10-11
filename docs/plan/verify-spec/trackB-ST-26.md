# VERIFY-SPEC — 트랙 B ST-26 모바일 판정 가시 (tft-S14 · pubg-S11)

- 변경 요약: TFT 대조표 열 순서 「…근거 → 판정」, 마지막 `sticky right-0` 고정 열 = 판정(LoL·PUBG와 같은 규약). PUBG 이름 칸 아이콘 375폭 숨김은 ST-11 `CompareNameCell hideIconOnMobile`로 이미 적용. 방향어 안내문 제거는 ST-12.
- 구현 결정: 트랙 A ST-25가 TFT는 「근거」를 고정했는데(1280에서 근거 열 가시 — tft-S13), 이번엔 판정을 고정한다. 근거 열이 1280에서 보이는지는 트랙 A 측정(SubmarineCell nowrap 해제 + `px-2`로 자연폭 862/862)에 기대며, 재측정 필요.
- 검증: wording 가드(헤더 순서·고정 열).
- 미확인 사항(중요): tft-S13 회귀 여부 — 1280×800에서 TFT 대조표 「근거」 헤더·첫 행 「원문 ↗」가 가로 스크롤 없이 보이는지 VERIFY 실측.
