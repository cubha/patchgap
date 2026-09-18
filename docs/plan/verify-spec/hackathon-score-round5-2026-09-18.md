# VERIFY-SPEC — PLAN-hackathon-score-round5-2026-09-18.md

## ST1 `isSectionBundle` (src/components/home/sectionBundle.ts)

### 구현 결정
- 키 = `icon.entityType === null` ∧ `!isCosmeticGroup` ∧ 모든 노트의 짝 델타 0행 ∧ 노트 ≥1. 파서·데이터를 건드리지 않는다(LLM 캐시 전량 무효 회피 — PLAN 제약).
- 아이콘 해석 결과를 **page.tsx가 이미 계산한 값**으로 받는다(ddragon을 이 모듈이 알지 않는다).
### 미확인 사항
- 26.17로 패치 쌍을 바꾸면 「챔피언 변경」·「아트」·「시스템 사양 업데이트」·「체력 재생 정수」가 같은 키에 걸린다(패널 실측). 이름을 보면 전부 섹션 라벨이지만, 26.17 프로덕션 렌더로 **직접 확인하지는 않았다**(현재 기본 쌍은 26.17→26.18).
- ddragon 인덱스가 없는 환경(`loadDdragonSafe` 폴백)에서는 **모든** 챔피언이 icon null이 되어 섹션 묶음으로 잘못 분류될 수 있다. 빌드 환경에서는 ddragon이 항상 있으나(public/dd 빌드 타임 다운로드), 그 경로의 방어는 넣지 않았다.

## ST2 티어 재번호 (src/components/home/releaseStream.ts)

### 구현 결정
- `ContentTier` 0|1|2|3|4 — 섹션 묶음 3, 치장 4(이전 3). `sortMatchedGroups`·`contentTier`에 4번째 선택 인자 `sectionBundles?: ReadonlySet<string>`(엔티티명 집합). 집합을 안 주면 이전과 동일(기존 테스트 불변으로 확인).
### 미확인 사항
- 엔티티명을 키로 쓴다 — 같은 이름의 matched 그룹이 둘일 수 없다는 `groupNotesByEntity`의 성질에 기댄다.

## ST3 `segmentStream` (src/components/home/streamSegments.ts)

### 구현 결정
- 연속 tier 2만 collapsed. tier undefined(미공지)는 rows. 순서·행 수 불변(테스트로 고정).
### 미확인 사항
- 없음 — 순수 함수, 5케이스.

## ST4 홈 배선 (page.tsx · ReleaseNoteStream.tsx · ReleaseNoteRow.tsx)

### 구현 decision
- page.tsx: 아이콘을 **정렬 앞에서** Map으로 선계산 → 섹션 묶음 집합 → `sortMatchedGroups(…, bundles)` → entries에 `tier`·`sectionBundle`. 정렬과 카드가 같은 집합·같은 티어 함수를 본다.
- ReleaseNoteStream: `segmentStream(filtered)` → collapsed 구간은 `<li><details><summary>관측 변화 없음 N건</summary><ul>…</ul></details></li>`. 요약행은 **건수만**(PLAN 제약). 항상 접힘(조건 분기 없음). `"use client"` 경계 유지 — tier는 prop으로 내려온다.
- ReleaseNoteRow: `sectionBundle` prop → § IconBox + `text-fg-2` 제목 + "N개 항목 · 패치노트 섹션 · 엔티티 아님". 본문(줄·`unpaired` 배지) 불변. 미공지 그룹에선 prop을 무시한다.
### 미확인 사항
- 접힘 `<details>` 안의 카드 `<details>` — 중첩 details의 키보드 포커스 순서는 jsdom으로 못 본다. Lighthouse a11y는 Phase 3/재채점에서 실측한다.
- 요약행 `px-5 py-3 text-xs`는 카드 summary(`px-5 py-4`)보다 얇다 — 시안 실렌더에서 사용자가 승인했으나 393px 캡처는 오버플로 0만 봤고 육안 확인은 안 했다.
- 레인 필터로 tier 2가 0건이 되면 요약행도 사라진다(segmentStream 입력이 filtered) — 의도이나 테스트 없음.

## ST5 `/pubg/` 순서 (src/app/pubg/page.tsx)

### 구현 결정
- 카드 3장 블록을 JSX 그대로 `PubgBriefingTabs` 뒤로 이동. 표 머리에 캡션 `<p>`(점유율·n→n매치). stat-tile 3개 불변.
### 미확인 사항
- `PubgSampleNotice` 제거 결정(PLAN-gap-display-unify ST-A2)과 이 캡션이 겹치지 않는지 — 캡션은 표본 "성격"이 아니라 정규화 사실 + 매치 수만 말한다고 판단했으나 acceptance-critic이 봐야 한다.
- 시안 아티팩트(「PUBG 테마 시안」)에는 이 카드가 없으므로 축B 시안 대조는 "시안 밖" 판정이 정상이다.

## ST6 `llmCaption` (src/components/item/CausesPanel.tsx)

### 구현 결정
- `LLM 검토 · {KST} 기준`. `LLM_MODEL` import 제거(미사용 import 금지). 모델 표기는 방법론 화면에 남는다(확인 필요 — 아래).
### 미확인 사항
- ~~방법론 페이지가 실제로 모델명을 말하는지 **확인하지 않았다**.~~ → Phase 3에서 확인: **말하지 않는다**(원래부터). `pipelineSteps.ts:81` "2단 LLM 후보 검증"이 역할만 명시. 기준선(PLAN 완료조건 4)을 정정했고 모델명은 어디에도 두지 않는다(사용자 결정). D1("역할이 화면에 명시")은 "추정 원인(LLM)" 블록 제목이 이미 만족하지만, "어떤 모델"은 방법론에 없으면 사이트 어디에도 없게 된다 — 재채점(ST8)에서 grep한다.

## 전체
- `data/aggregated/**`·`patchnotes-parser.ts`·`next.config.ts` diff 0(PLAN 완료 조건 5) — Phase 3 verify 전 `git status`로 확인한다.
