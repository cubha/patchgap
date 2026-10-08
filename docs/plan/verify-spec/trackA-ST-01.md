### VERIFY-SPEC — SubTask ST-01 (값 토큰 경로)
- 기준선 요구사항: "**값 토큰 경로** — `linkedNotes` 입력에 `value?: {before, after}`를 더하고, 노트 `before⇒after` 숫자 토큰열이 변경 값과 **정확히 같으면**(토큰 ≥2) 스킬 키·필드 낱말과 무관하게 `via: "value"`로 연결. 엘리스 R 수치 `12/22/32/42 → 14/24/34/44`가 패시브 공지와 짝지어진다. 단일 숫자는 제외" (PLAN-site-review-trackA ST-01 · 리뷰 lol-S1)
- 변경 파일: `src/pipeline/gamedata/note-link.ts`(수정) · `lol.ts`(수정 — push에 value 전달) · `tft.ts`(수정) · `__tests__/note-link.test.ts`·`lol.test.ts`(RED 선커밋 2f044ed)
- 관찰 가능한 계약: `linkedNotes({entityName, value:{before:"12/22/32/42", after:"14/24/34/44"}, skillKey:"R"}, [패시브 노트])` → `[{via:"value"}]`. 단일 숫자 value → 값 경로 불발. `diffLol(16.18.1→16.19.1, notes 26.19)` 잠수함 0건(이전 1건).
- 구현 결정: 값 경로는 rework 다음·skillKey 검사 앞에 둔다(값이 같으면 슬롯 무관). 토큰 비교는 상대 오차 1e-6. `%`·쉼표·공백은 버린다. stub·하드코딩 없음.
- 인접 경계: `noteValueMismatch`는 `via:"keyword"`만 견주므로 value 경로는 불일치 후보가 아니다(값이 같으니 당연). `linkNotes` id 목록도 같은 함수 경유. PUBG 어댑터는 `linkedNotes`를 안 쓴다(영향 0).
- 미확인 사항: 토큰 ≥2 규칙이 LoL 아이템 `stats.*`(단일 숫자)에는 영향이 없음을 실측했지만, TFT `ability.*` 문자열 값(`20/30/48`)이 같은 엔티티의 **다른** 변수와 우연히 같은 배열일 가능성은 데이터로 배제하지 못했다(같은 엔티티·같은 토큰열이면 어차피 노트가 그 값을 말한 것이라 공지로 봐도 틀리지 않는다고 판단).
