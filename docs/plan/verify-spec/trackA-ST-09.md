### VERIFY-SPEC — SubTask ST-09 (표시값 정합 델타·q 표기)
- 기준선 요구사항: "`DeltaValue`에 `endpoints?`; 있으면 델타 문자열을 **표시 정밀도로 반올림한 두 끝값의 차**로(`%p`·초 둘 다). q 표기는 `fmtQ`로 상세 게이트 행도 같은 형식" (PLAN ST-09 · 리뷰 lol-S20·pubg-S17)
- 변경 파일: `src/lib/format.ts`(수정 — `fmtDisplayDelta`·`fmtQ`) · `src/components/DeltaValue.tsx`(수정) · `ReleaseNoteRow.tsx`·`SideMatchAverages.tsx`·`LolItemDetail.tsx`·`DeltaTable.tsx`·`PubgMapDetail.tsx`·`TftUnitDetail.tsx`·`streamVerdict.ts`(수정) · `__tests__/format.test.ts`(RED 3ec57a9) · `compare/__tests__/render.test.tsx`(기대값 −10.8 → −10.9, 명세 변경)
- 관찰 가능한 계약: 끝값 55.4%→44.5% 옆 델타 「−10.9%p」(원시 −0.108이라도). 29:29→30:31 「+1:02」. 표시값이 같으면 「0.0%p」 무부호·중립색. q는 세 화면 모두 `q<0.001`/`q=0.076`.
- 구현 decision: CI·유의성은 원시 델타 그대로(통계는 안 건드린다 — 표기만). TFT 상세의 지표 델타(`d.text`, 등수 단위)는 범위 밖 — 등수는 `DisplayMetricKind`에 없고 리뷰 지적도 LoL·PUBG였다. `formatQ`는 `fmtQ` 위임으로 남겨 호출부를 보존.
- 인접 경계: 디스코드 웹훅(`webhook.ts`)은 여전히 `fmtPp(d.delta)` — 알림 문장은 끝값과 델타를 같은 줄에 쓰므로 같은 결함이 있을 수 있다(범위 밖, 메모).
- 미확인 사항: 디스코드 웹훅 표기 정합(위). `fmtDisplayDelta`의 `gold` 분기는 호출부가 없다(계약만 고정).
