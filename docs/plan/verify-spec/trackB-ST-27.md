# VERIFY-SPEC — 트랙 B ST-27 가드·닫힌 행 기록 (parity-S33 가드 + PLAN ③)

- 변경 요약: screen-parity에 「자기 Container를 갖는 `TftFooter`를 Container 안에 두지 않는다」 게이트(파일 내 Container 깊이 계산, 주석 제거, 자기 닫힘 제외). 가짜 입력으로 검출 확인(중첩 true / 형제 false / 자기 닫힘 false).
- ③ 닫힌 행(lol-S12·pubg-S9 #81, lol-S29 ST-26, pubg-S26 현 빌드, parity-S33 #80)과 parity-S10 사용자 결정 기각은 PLAN ③에 근거와 함께 기록.
- 미확인 사항: `PubgFooter`는 `contained={false}` 고정 래퍼라 반대 방향(Container 밖에 두면 여백 0) 결함은 이 게이트 범위 밖.
