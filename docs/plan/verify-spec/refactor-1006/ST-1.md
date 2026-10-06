### VERIFY-SPEC — SubTask ST-1
- 기준선 요구사항: "LoL LLM 총 상한 150 고정 결함 — 엔진이 `totalCallCapFor(maxDeltas)`로 유도(max(150, maxDeltas+40)), TFT 명시값 제거(단일 소스), collect.yml 예산 명시($14 ≥ 440×$0.03) + 예산≥견적 구조 게이트 테스트, llm-config 주석 정정"
- 변경 파일: src/pipeline/match/llm-match.ts(수정) · scripts/run-tft-match.ts(수정) · src/pipeline/match/llm-config.ts(주석) · .github/workflows/collect.yml(수정) · scripts/__tests__/llm-cost-policy.test.ts(수정) · src/pipeline/match/__tests__/llm-match.test.ts(RED 선커밋 3854d04)
- 관찰 가능한 계약: maxTotalCalls 미지정 + maxDeltas=200, 미스 200 → plan.estimatedCalls=200(전 150). maxDeltas≤110 → 150 유지. 명시 maxTotalCalls가 이긴다. TFT 기본(120) → 160(전 명시 160과 동일). PUBG(40) → 150(동일). LoL CI(400) → 440. collect.yml 예산 14 ≥ 13.2.
- 구현 결정: 여유 40은 TFT 실측값 승계. LoL 로컬 기본(--llm-max 120) 총 상한이 150→160으로 오른다(로컬은 캐시 전용·예산 게이트 하에 있음). 예산 $14는 견적($0.03/건) 기준 — 실단가 ≈$0.015.
- 인접 경계: run-match.ts(호출부 무수정 — 엔진 기본이 해결), run-tft-match.ts, run-pubg-llm.ts(maxDeltas 40만 넘김), run-llm-ab/compare(명시 maxTotalCalls 유지), llm-guard 예산 throw 경로.
- 미확인 사항: LoL 26.20 실제 미스 수 — 266건 미만이면 기본 예산으로도 통과했겠지만 상한 400이라 이론상 440까지 감. `llmSample` 소량 실행 시 총 상한이 45→150으로 오르나 대상 ≤N이라 실호출 ≤2N(재요청 1회 상한)로 무영향이라 판단.
