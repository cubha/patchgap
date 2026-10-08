### VERIFY-SPEC — SubTask ST-19 (LoL 라인 칩이 값을 바꾼다)
- 기준선 요구사항: "(a) `lanesForEntityKey`: 그 라인에 **보고 자격 행**이 있을 때만 라인 소속 (b) `ReleaseNoteStream`(client)이 선택 라인에 맞춰 카드 대표 행을 다시 고른다 (c) 패치 내용 탭 배지 = 거른 뒤 줄 수" (PLAN ST-19 · 리뷰 lol-S6)
- 변경 파일: `src/lib/lane.ts`(수정 — 시그니처 `(records: DeltaRecord[], entityKey, qAlpha?)`) · `src/components/home/noteDeltaIndex.ts`(수정 — `representativeForLane`) · `ReleaseNoteStream.tsx`(수정 — `laneDeltas`·`laneContentCount`) · `LolBriefing.tsx`(수정 — qAlpha 전달) · `__tests__/lane.test.ts`·`noteDeltaIndex.test.ts`(RED 42cdacc; 기존 `stubRecord`를 전체 행으로 — 명세 변경)
- 관찰 가능한 계약: 탑 칩 → 탑에서 보고 자격 행이 있는 챔피언만 남고, 카드 관측 줄은 탑 행 값 + 「탑」 칩, 배지 「패치 내용 N」은 남은 줄 수. 전체면 ST-08 규칙(scope=all 우선).
- 구현 결정: Gap 탭 배지는 라인과 무관하게 둔다 — 수치 축(게임 파일)에는 라인이 없고, 지표 축 Gap 수는 합집합 정의(`lolGapTotal`)라 라인별 재정의는 B 트랙(단위 정의)과 얽힌다. 미공지 카드의 대표도 `laneDeltas`를 거치지 않는다(미공지 카드는 `group.deltas` 자체를 쓴다 — 기존 경로).
- 인접 경계: `lanesForEntityKey`의 다른 호출부가 있으면 전체 행을 넘겨야 한다(tsc가 잡는다 — 현재 LolBriefing 1곳). `representativeForLane`는 클라이언트 번들(`isReportableRecord` 클라이언트 안전).
- 미확인 사항: 실제 26.19 데이터에서 탑·원딜 칩이 서로 다른 목록을 내는지 렌더로 재지 않았다(단위 테스트는 규칙만 고정). Phase 3에서 `gap-tile-tab`류 렌더 테스트가 통과하면 회귀는 없다.
