### VERIFY-SPEC — SubTask ST-25 (대조표 판정 열 가시)
- 기준선 요구사항: "`CompareSplit` 그리드 `minmax(0,1fr)` + LoL `DeltaTable` `overflow-x-auto`·열 최소폭(TFT·PUBG와 같은 규약). 1280 기본 상태에서 판정 열이 보인다" (PLAN ST-25 · 리뷰 parity-S15·lol-S8·tft-S13)
- 변경 파일: `src/components/compare/CompareSplit.tsx`(수정) · `DeltaTable.tsx`(수정)
- 관찰 가능한 계약: 1280px에서 우측 섹션 트랙이 표의 최소 너비에 끌려 늘어나지 않고(`minmax(0,1fr)`), 표가 더 넓으면 패널 안에서 가로 스크롤(`overflow-x-auto`, `min-w-[640px]`)이 생겨 열이 잘리지 않는다.
- 구현 결정: 최소폭 640px은 TFT·PUBG 표의 `--table-min`과 같은 역할 — 토큰이 아니라 유틸 값이라 `verify.sh` Spec 규칙(arbitrary 우회)에 걸릴 수 있다. Phase 3 verify.sh 결과로 확인하고, 걸리면 `var(--table-min)`로 바꾼다.
- 인접 경계: `CompareSplit`은 세 게임 공용 — TFT·PUBG는 이미 `overflow-x-auto`라 변화는 그리드 트랙뿐.
- 미확인 사항: 1280·375 캡처 미실측(`--ui` 미지정). 375에서 판정이 "첫 화면 너비 안에" 보이는 요구(lol-S8 후반)는 모바일 레이아웃(B4) 범위라 여기서 닫지 않았다.
