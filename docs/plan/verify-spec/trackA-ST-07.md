### VERIFY-SPEC — SubTask ST-07 (「패치 내용」 수 단일화)
- 기준선 요구사항: "탭 배지(233)와 타일 부제(231)가 다른 출처. … **화면에 실리는 고유 노트 수** 하나를 두 자리가 공유" (PLAN ST-07 · 리뷰 lol-S3)
- 변경 파일: `src/components/home/LolBriefing.tsx`(수정 — `HeroSummary stats={{...headline, noteItemCount: contentLineCount}}`)
- 관찰 가능한 계약: LoL 브리핑 타일 부제 「26.19 패치노트 · N개 항목」의 N == 탭 배지 「패치 내용 N」. 실측 원인: `meta.itemCount`(231)는 파서가 센 원문 항목 수, `items.length`(233)는 화면 줄 수 — 과거 쌍은 반대 방향(146 vs 181, 의회 34줄 제외)이라 두 수의 관계가 쌍마다 달랐다.
- 구현 결정: **[TDD] 태그를 내렸다** — 한 줄 전달이라 3-AND의 (c)비자명을 만족하지 않는다(tdd-gate §1). `HeadlineStats.noteItemCount`의 정의(`meta.itemCount`)는 그대로 두고 브리핑에서만 덮어쓴다 — 방법론 `pipelineSteps`의 「원문 항목 수」 병기는 원문 수가 맞다.
- 인접 경계: `landing.ts`는 `noteItemCount`를 안 쓴다. TFT·PUBG는 부제가 `notes.items.length`·없음이라 이미 한 출처.
- 미확인 사항: 렌더 테스트로 두 수의 동일성을 고정하지 않았다(Phase 3 `gap-tile-tab`류 테스트는 Gap 수만 본다). 보완 테스트 후보로 남긴다.
