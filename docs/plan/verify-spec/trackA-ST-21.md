### VERIFY-SPEC — SubTask ST-21 (PUBG 무기 상세 「말한 것」 전부)
- 기준선 요구사항: "`matchedNoteIds` 전체를 나열, 기대값 없는 조항은 회색 + 「이 데이터로 측정 불가」. 대조표 줄 수와 같다" (PLAN ST-21 · 리뷰 pubg-S3)
- 변경 파일: `src/components/pubg/PubgWeaponDetail.tsx`(수정 — `mentionedNotes`)
- 관찰 가능한 계약: RPD 상세 「말한 것 4」(스폰율·조준 전환·반동·차량 피해), 뒤 셋은 `text-muted` + 「이 데이터로 측정 불가」, 각 줄 원문 링크. MG3 「말한 것 3」. 대조표 좌 내비 줄 수와 같다(`matchedNoteIds` 같은 집합).
- 구현 결정: 머리 문장의 대표 노트(`note`, `matchedNoteId`)는 그대로 — 판정 근거가 된 조항 하나를 가리키는 자리라 뜻이 다르다.
- 인접 경계: `pubgNoteNavItems`(대조표)와 같은 `matchedNoteIds`를 읽으므로 두 화면의 수가 구조적으로 같다. `note`가 null이어도 `mentionedNotes`가 있을 수 있다(대표 없음 + 측정 불가 조항만) — 그 경우 목록이 나온다(의도).
- 미확인 사항: 측정 불가 조항의 「원문 ↗」 앵커가 조항마다 다른지(실측 노트는 같은 공지 URL) — 같은 URL 반복은 허용.
