### VERIFY-SPEC — SubTask ST-08 (카드 대표 행)
- 기준선 요구사항: "`noteDeltaIndex.better`: 보고 자격·상태가 같으면 챔피언 scope=all 행 우선(`selectAnnouncedPreview`와 같은 규칙). 라인 행이 대표가 되면 `ObservationLine`에 라인 라벨 표시" (PLAN ST-08 · 리뷰 lol-S5)
- 변경 파일: `src/lib/lane.ts`(수정 — `isAllScopeChampionRow` 이관·export) · `src/components/home/{noteDeltaIndex,logic}.ts`(수정) · `ReleaseNoteRow.tsx`(수정 — 라인 칩) · `__tests__/noteDeltaIndex.test.ts`(RED dd99e6e)
- 관찰 가능한 계약: 같은 자격·상태의 `champion:Khazix:pickRate` vs `champion:Khazix:JUNGLE:pickRate` → 전체 행이 대표(|Δ| 무관). 전체 행이 자격을 잃으면 라인 행. 대표가 라인 행이면 지표 라벨 옆에 「정글」 칩.
- 구현 결정: 우선순위 사슬 = 자격 → 상태 → **scope** → |Δ|. 라인 칩은 `positionLabel`(기존 라벨 소유자) 재사용, 토큰 `bg-surface-warm`·`text-fg-2`.
- 인접 경계: `indexNoteDeltaRows`(전수)는 불변. 3티어 정렬도 같은 사전을 쓰므로 대표가 바뀌면 티어 순서가 미세하게 바뀔 수 있다(의도된 결과 — 상세와 같은 값).
- 미확인 사항: 라인 칩이 390px에서 줄바꿈을 일으키는지 캡처로 보지 않았다(`flex-wrap`이라 넘침은 없다).
