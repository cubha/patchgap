### VERIFY-SPEC — SubTask ST-18 (약속 문구 정정 + 공용 커버리지)
- 기준선 요구사항: "`AnnouncedCoverageLine` 마지막 문장을 실제 표시 범위로. `CoverageSection`(공용)을 LoL `CoverageBar`·TFT 인라인 섹션·PUBG(없음) 셋이 쓴다. PUBG는 노트 중 기대값 없는 조항을 「이 데이터로 측정 불가 N조항(축 이름)」으로 한 줄 더 — 숨김 상태 건수는 말하지 않는다(#78)" (PLAN ST-18 · 리뷰 lol-S9·parity-S14·pubg-S2 — PLAN ② 범위 조정)
- 변경 파일: `src/components/compare/CoverageSection.tsx`(신규) · `CoverageBar.tsx`(재작성 — 어댑터) · `TftCompareView.tsx`(수정) · `src/app/pubg/compare/page.tsx`·`PubgCompareExplorer.tsx`(수정 — `coverage` prop) · `AnnouncedCoverageLine.tsx`(수정) · `compare/__tests__/render.test.tsx`(어휘 「엔티티」→「대상」)
- 관찰 가능한 계약: 세 대조표 하단에 `[data-coverage]` 블록 「표가 다룬 범위 — 노트 N대상(M항목) 중 관측 짝 X · 미공지 Y」. PUBG는 그 아래 「이 데이터로 측정 불가 4조항 — 조준 전환 시간 · 반동 제어 · 차량 피해 배수 …」. 브리핑 결론 문장은 "대조표 하단 「표가 다룬 범위」가 노트 대상 중 관측 짝과 미공지 수를, 방법론이 게이트 규칙을 밝힙니다".
- 구현 결정: `CoverageBar` 파일을 남긴 이유 — `screen-parity.test`가 숨김 문구 검사 대상 목록에 그 경로를 두고 있고 `render.test`가 import한다. 리뷰어가 요구한 「공지됐으나 관측 없는 대상마다 사유」는 사용자 결정(#78)과 충돌해 **하지 않았다**(PLAN ②).
- 인접 경계: PUBG `gap`은 `pubgGapTotal`(타일과 같은 수). `PubgCompareExplorer`("use client")는 ReactNode를 prop으로 받을 뿐 서버 로더를 import하지 않는다.
- 미확인 사항: PUBG `matched`(공지 무기 중 보고 자격 무기 수)가 브리핑 결론 문장의 분자와 같은 집합인지 — 브리핑은 `announced` 행의 weaponKey Set, 여기는 `matchedNoteIds.length>0 && isReportable` — 뜻은 같고 수도 같아야 하지만 렌더로 대조하지 않았다.
