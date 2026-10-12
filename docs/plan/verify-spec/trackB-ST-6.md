# VERIFY-SPEC — 트랙 B ST-6 미공지 분포 범위 (lol-S4)

- 변경 요약: `laneDistribution.ts` `all` 라벨 「전체」→「라인 무관」, `laneDistributionScope(records, gapTotal)`(라인 구분 대상 수 · 그 밖 = Gap − 구분). `LaneGapPanel` 바닥 한 줄 「미공지 Gap N 중 라인 구분 n대상 · 그 밖(밴률·아이템·수치 축) m대상」. `LolBriefing`이 `gapTotal`(타일과 같은 수)을 넘긴다.
- 구현 결정: 대상 기준(라인 여럿인 대상 1회). 「그 밖」의 내역 라벨은 고정 문구(밴률·아이템·수치 축) — 실제 구성은 쌍마다 다르나 분포에 오지 않는 축의 종류는 이 셋이다.
- 검증: `laneDistribution.test.ts` 3건.
- 미확인 사항: 분포 입력(`unannouncedRows`)이 간접 영향(indirect-effect)을 포함하는지에 따라 covered가 Gap의 지표 축과 정확히 겹치는지 — 음수는 막았다(`max(0, …)`). 렌더 실측은 VERIFY 빌드에서.
