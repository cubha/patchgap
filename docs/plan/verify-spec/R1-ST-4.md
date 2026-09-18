# VERIFY-SPEC R1-ST-4 — 공지-불일치 표시 분리(displayStatus → announced-unobserved)

- 대상 파일: src/pipeline/shared/display-status.ts, src/lib/format.ts, src/components/StatusBadge.tsx, src/components/compare/logic.ts, src/components/compare/CompareExplorer.tsx, src/components/compare/NoteNavigator.tsx, src/components/compare/DeltaTable.tsx, src/components/home/ReleaseNoteRow.tsx, src/components/methodology/StatusDefinitionTable.tsx, src/app/compare/page.tsx
- 구현 결정:
  - MatchStatus 불변, 표시 키만 추가. 판정=isSignificantDelta(record, meta.qAlpha)
  - 칩 '공지-불일치'는 유의 반대만, 신규 칩 '공지 · 관측 미확인'(회귀 테스트 14→15 갱신 — 명세 변경)
- 부수 결정:
  - representativeStatus 반환형 MatchStatus→DisplayStatus(호출부 NoteNavigator만)
  - DISPLAY_SORT_PRIORITY: unobserved = consistent+0.5
- 미확인 사항:
  - 디스코드 웹훅(pipeline/discord)은 여전히 MatchStatus 어휘 — 화면과 어휘가 다를 수 있음(의도: 파이프라인 계약 불변)
  - URL 해시 #announced-inconsistent로 진입하는 기존 링크는 이제 유의 5건만 보인다
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
