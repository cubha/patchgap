### VERIFY-SPEC — SubTask ST-04 (PUBG 0건 문구)
- 기준선 요구사항: "`SubmarineSection` 0건 분기를 출처 종류로 가른다: `telemetry-grid`면 '피해 격자 추정에서 어긋난 것을 찾지 못했다 — 게임사 수치 파일이 없어 원본 전수 대조가 아니며, 격자 밖 축(조준 전환·반동·차량 피해)은 대조하지 않는다'. DDragon·CDragon은 기존 문구" (PLAN ST-04 · 리뷰 pubg-S1)
- 변경 파일: `src/components/gamedata/SubmarineSection.tsx`(수정)
- 관찰 가능한 계약: `summary.source.kind === "telemetry-grid"` & 잠수함 0건 → 본문에 "피해 격자 추정" · "원본 전수 대조가 아니며" · "격자 밖 축" 문구; 그 외 kind → 기존 "원본 수치를 전부 대조해" 문구.
- 구현 decision: 분기 키는 `source.kind`(게임 id가 아님 — 섹션은 게임을 모른다는 기존 규약 유지). 하드코딩된 축 이름 3개(조준 전환 시간·반동·차량 피해 배수)는 PUBG 방법론 「한계」와 같은 목록.
- 인접 경계: `PubgBriefing`(관측·선언 두 뷰)·`TftBriefing`·`LolBriefing` 공용. 문구 테스트 없음(test-after, 렌더 스냅샷 미작성).
- 미확인 사항: 축 이름 목록이 PUBG 방법론의 문구와 글자 단위로 같은지 대조하지 않았다(의미는 같다).
