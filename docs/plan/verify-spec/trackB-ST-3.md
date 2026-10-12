# VERIFY-SPEC — 트랙 B ST-3 공지 수 단위 = 대상 (tft-S5 · parity-S5 · parity-S6 · lol-S15 + LoL 커버리지 관측 짝)

- 변경 요약: `src/lib/announcedCount.ts`(`tftNoteEntityCount`·`pubgNoteTargetCount`)를 랜딩·TFT 브리핑·PUBG 브리핑·PUBG 대조표·PUBG 선언 뷰·NewerPatchNotice가 공유. 히어로·선언 머리·배너 단위어 「N개 대상」(5곳). PUBG 히어로·타일 = 무기 대상 수, 타일 부제 `· N개 항목`(조항 수). `computeCoverage.matchedCount` = `countAnnouncedObservedEntities`(LoL 대조표 「관측 짝」).
- 구현 결정: 조항(줄) 수는 타일 부제 한 곳만(2026-10-09 결정). `DeclarationHero`에 `entityCount` prop — 노트에 대상 묶음이 없는 PUBG가 대상 수를 넘긴다.
- 검증: `announcedCount.test.ts`(함수 2 · LoL 커밋 4쌍 관측 짝 ≤ 공지 대상 · 단위어 소스 가드).
- 미확인 사항: TFT 관측 전 선언 경로(현재 데이터엔 없음)의 히어로 = 랜딩 = 배너 일치는 렌더로 실측하지 못했다(같은 함수 공유로 보장). LoL 히어로 문장의 수(`noteEntityCount`)는 `countRelevantNoteEntities`(제외 노트 뺀 대상)라 TFT의 단순 집합과 정의가 다를 수 있음 — 둘 다 「대상」이며 각 게임 커버리지와 같은 함수.
