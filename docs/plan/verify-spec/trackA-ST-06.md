### VERIFY-SPEC — SubTask ST-06 (결론 문장 분자)
- 기준선 요구사항: "`countAnnouncedObservedEntities(rows, qAlpha)` = 보고 자격 행이 있고 `matchedNoteIds`가 비지 않은 **대상** 수. LoL `announcedCoverage.observed`가 이것을 쓴다(≤ 분모). TFT·PUBG도 같은 함수로 통일" (PLAN ST-06 · 리뷰 lol-S2·parity-S4)
- 변경 파일: `src/pipeline/shared/headline.ts`(수정) · `src/lib/headline.ts`(수정 — `HeadlineStats.announcedObservedCount`) · `LolBriefing.tsx`·`TftBriefing.tsx`(수정) · `__tests__/headline.test.ts`(RED 554dee7) · `home/__tests__/{logic,render}.test.ts(x)`(픽스처에 새 필드 추가 — 명세 변경)
- 관찰 가능한 계약: LoL 26.19 결론 문장 분자 ≤ 19(전에는 76). TFT는 `matchedNoteIds`가 있는 보고 자격 행의 대상 수(전에는 표시 상태 ≠ 미공지로 걸러 간접 영향 행까지 셌다).
- 구현 결정: PUBG는 행 타입이 달라(`PubgDeltaRow`, weaponKey) 기존 Set 계산을 유지했다 — 뜻은 같다(공지 무기 중 보고 자격). stub 없음.
- 인접 경계: `HeadlineStats` 소비처(`HeroSummary`·`landing.ts`·디스코드)는 새 필드를 무시해도 동작. `AnnouncedCoverageLine` 문구는 ST-18에서 바뀐다.
- 미확인 사항: TFT 분자가 바뀌는 실제 값(종전 10 → ?)을 렌더로 확인하지 않았다 — Phase 3 테스트 렌더가 통과하면 계약은 지켜진 것.
