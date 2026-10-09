# VERIFY-SPEC ST-9 — [TDD] PUBG stub → declaration.json(관측 deltas.json 보존) · deltasStateOf 2파일 · pickPubgDeclaration · newerPubgDeclaration · PUBG 배너(원문 링크)
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: scripts/write-observation-stub.ts · scripts/pubg-determine.ts · src/lib/pubgData.ts · src/components/pubg/PubgBriefing.tsx · src/app/pubg/page.tsx · .github/workflows/collect-pubg.yml(주석)
- 구현 결정:
- StubTarget에 `observedFile` 추가 — PUBG는 deltas.json(관측)·declaration.json(stub) 분리. 같은 쌍 관측이 있으면 stub 안 씀.
- pubg-determine: 이번 쌍 상태 = deltas.json이 답하면 그것, 없으면 declaration.json.
- `pickPubgDeclaration` 순수 규칙: 관측 to ≥ stub to면 stub 무시(낡음). 옛 배치(deltas.json 자체가 stub) 호환.
- PUBG 배너는 과거 쌍 라우트가 없어 노트 원문(`meta.source`)으로 보낸다. ETA 없음.
- 워크플로의 `git add data/aggregated/pubg`가 디렉터리 단위라 declaration.json도 커밋된다.
- 미확인 사항:
- 관측이 43.2를 따라잡은 뒤 declaration.json이 파일로 남는다(로더는 무시). 지우는 단계를 두지 않았다 — 다음 stub이 덮어쓴다.
- collect-pubg.yml의 `declaration` 모드가 매일 재실행될 때 pubg-determine이 declaration.json의 stub을 보고 skip하는지: `deltas.kind==='stub' && notesExist → skip` 분기는 planPubgRun 안에 있고, 전에는 deltas.json의 stub을 보던 자리에 같은 값을 넣는다.
