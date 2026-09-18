# VERIFY-SPEC R1-ST-2 — resolveGapCause confidence 분리(weak 모드) + CausesPanel 신뢰도 라벨

- 대상 파일: src/components/home/logic.ts, src/components/home/ReleaseNoteRow.tsx, src/components/item/CausesPanel.tsx
- 구현 결정:
  - 대표 후보 = 검증된 것 중 신뢰도 최고(없으면 causes[0]); low → mode weak(회색 '가능성(신뢰도 낮음): ')
  - CausesPanel: verified&&low는 회색 링크 + '노트 인용 ✓ · 신뢰도 낮음'
- 부수 결정:
  - indirect-effect 재분류 임계(medium)는 건드리지 않음 — CauseChain(원인 규명 Gap) 경로는 confidence를 별도로 보지 않는다(기존 그대로)
- 미확인 사항:
  - ReleaseNoteRow CauseChain(causes prop 경로)는 weak 구분이 없다 — 재분류 자체가 medium 이상만 되므로 low가 들어올 수 없다고 가정
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
