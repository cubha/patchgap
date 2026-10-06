### VERIFY-SPEC — SubTask ST-3
- 기준선 요구사항: "effort 캐시 키: 비교 기준을 고정 리터럴(캐시 생성 기준 effort)로 분리, `cacheKeyFor`가 기준값을 인자로 받음. 실제 캐시 파일 golden 테스트 + 기본값 변경 시나리오 테스트"
- 변경 파일: src/pipeline/match/llm-config.ts(UNTAGGED_CACHE_EFFORT 신설·주석) · src/pipeline/match/llm-match.ts(cacheKeyFor export·비교 기준 교체) · src/pipeline/match/__tests__/llm-cache-key.test.ts(신규, RED 선커밋)
- 관찰 가능한 계약: effort=medium → 무태그 키(기존 파일명과 동일, golden 01023ce…). effort≠medium → `|effort=X` 태그. LLM_EFFORT를 high로 바꿔도(vi.mock) medium 키 불변·high 키는 태그.
- 구현 결정: PLAN은 "기준값을 인자로"라 적었으나, 인자 대신 고정 상수(UNTAGGED_CACHE_EFFORT) 직접 참조로 했다 — 테스트는 vi.mock으로 기본값 변경을 흉내 내 같은 계약을 검증한다. 인자로 열면 호출부가 다른 기준을 넘겨 키를 가를 수 있는 구멍이 생긴다.
- 인접 경계: inferIndirectCandidates keyOf, callLlmForDelta(effort 기본값 LLM_EFFORT — 호출 강도이지 키 아님), run-llm-ab(effort 명시 실험), 캐시 1,969건.
- 미확인 사항: 현재 LLM_EFFORT=medium이라 오늘의 키는 바이트 동일 — 회귀 하네스(캐시 전용 재실행 3게임 IDENTICAL)로 확인 예정.
