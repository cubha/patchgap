# VERIFY-SPEC — 트랙 B ST-21 단일 쌍 정적 라벨 (pubg-S19)

- 변경 요약: `Header` — `pairs.length === 1`이면 select 대신 「패치 42.3 → 43.1」 정적 라벨(`data-pair-static`, `aria-describedby` 힌트 유지). 쌍이 둘 이상인데 과거 쌍 라우트가 없어 닫힌 경우는 기존 disabled select 유지.
- 검증: header-pair-select 테스트(명세 변경 1건 기록).
- 미확인 사항: 헤더 높이·정렬 변화(select 테두리 없음)의 시각 확인.
