### VERIFY-SPEC — SubTask ST-14 (latestObservedTftPair)
- 기준선 요구사항: "`latestObservedTftPair(): {pair, isLatest} | null` 프로덕션 함수(테스트 헬퍼 `observed-briefing.tsx`의 것을 lib로 승격, 헬퍼는 이것을 쓴다)" (PLAN ST-14)
- 변경 파일: `src/lib/tftData.ts`(수정) · `src/app/__tests__/observed-briefing.tsx`(수정 — TFT는 프로덕션 함수 위임) · `src/lib/__tests__/tftLatestPair.test.ts`(RED 8701d2d)
- 관찰 가능한 계약: 돌려준 쌍은 `loadTft(pair) !== null`이고, `listTftPairs()`에서 그보다 앞(최신)인 쌍은 전부 stub. `isLatest` = 인덱스 0. 관측 쌍이 없으면 null.
- 구현 결정: LoL은 로더에 stub 개념이 없어 헬퍼의 LoL 분기는 그대로. 파일 I/O 함수라 테스트는 커밋 데이터로 **일관성**(하드코딩 쌍 아님)을 본다.
- 인접 경계: `loadTft`를 쌍마다 부르므로 쌍 수 × 파일 읽기 — 빌드 타임 호출뿐이라 비용 무시 가능. 소비처: tft 대조표·상세·방법론 페이지·`TftDeclarationView`.
- 미확인 사항: 없음.
