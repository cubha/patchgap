# VERIFY-SPEC — PLAN-user-review-round6-2026-09-18.md

## ST1 표시 키 통일 (src/pipeline/shared/display-status.ts · src/lib/format.ts · src/components/StatusBadge.tsx)
- 기준선 요구사항: C5 "공지된 내용은 공지된 내용인데 공지-일치, 불일치, 관측미확인 등 상세 value가 나뉨 → 통일 … 이상관측 표시 / 미공지, 노트에없는변화, 간접영향은 결국 미공지내용 → 통일" · C1 "표본부족, 바닥미달, 변화없음 … 아예 보여주지 않도록"
- 변경 파일: display-status.ts(수정) · format.ts(수정) · StatusBadge.tsx(수정) · pipeline/discord/webhook.ts(수정 — `announced-anomaly`로 필터)
- 관찰 가능한 계약: `displayStatus(record,q)` → `announced` | `announced-anomaly`(inconsistent ∧ 유의 ∧ 바닥 통과) | `unannounced`(unannounced·indirect-effect) | 노이즈 3종 통과. `displayStatusOf(status)`(q 없이). `isNoiseStatus`. `statusLabel`은 raw MatchStatus도 통일 어휘로.
- 구현 결정: `unpaired` 키는 남겼으나 화면 사용처 0(홈 스킬 행 배지가 보고 가능 관측만 붙게 바뀜). 노이즈 라벨은 방법론 정의표용으로 유지.
- 인접 경계: 호출부 — compare/logic·DeltaTable·NoteNavigator·ReleaseNoteRow·item page·StatusDefinitionTable·PUBG 3화면·webhook. `DISPLAY_SORT_PRIORITY`는 exhaustive Record.
- 미확인 사항: 디스코드 embed의 "공지 불일치 상위 3" 섹션이 이제 `announced-anomaly`만 뽑는다(실데이터 26.18에서 1건) — 방송 항목 수가 줄어드는 것이 의도인지 사용자 확인 없음(웹과 같은 잣대라 정합은 맞다).

## ST2 대조표 로직 (src/components/compare/entityRows.ts · logic.ts)
- 기준선 요구사항: L3(엔티티 1행·인라인 지표·골드 제외) · L4(엔티티 묶음·포커스) · C1
- 변경 파일: entityRows.ts(신규) · logic.ts(수정)
- 관찰 가능한 계약: `buildEntityRows(rows, lane, q)` — 챔피언·아이템만, 라인 축 일치 행만, 보고 가능 셀만, 셀 0이면 행 없음, 대표 상태·|Δ| 정렬. `STATUS_FILTERS` 4종. `groupNotesForNav`·`navBadgeStatus`.
- 구현 결정: `filterByStatus`를 **행 조립 전에** 적용 → "공지" 칩에서 미공지 셀은 빠지고 그 엔티티는 공지 셀만으로 행이 선다(칩 = 셀 필터). `sortRows`·`directionSymbol`·`formatDeltaCell`·`formatCiCell`·`formatNCell`·`shortNoteId`·`filterByLane`은 UI 사용처가 없어졌으나 테스트가 있어 남겼다.
- 인접 경계: HeroSummary 타일 링크 `/compare/#gap` → `/compare/#unannounced`.
- 미확인 사항: 라인 필터 + 아이템 — 아이템은 라인 축이 없어 특정 라인 선택 시 표에서 사라진다(이전 `filterByLane`과 같은 결정이지만 사용자 확인 없음). 대조표 `computeCoverage`는 옛 필드(lowSampleCount 등)를 그대로 계산하고 CoverageBar가 안 쓸 뿐이다.

## ST3 대조표 UI (DeltaTable · NoteNavigator · CompareExplorer · CoverageBar)
- 기준선 요구사항: L3·L4·C5·C1
- 변경 파일: 4개(수정)
- 관찰 가능한 계약: 헤더 6열(엔티티+버전 이동 1회 · 밴·승·픽·채택 · 상태). 행 `data-entity-key`. `focusKey` 행 `.row-highlight` + 스크롤 컨테이너 `scrollTo(row.offsetTop − thead 높이)`. 내비 클릭 → 줄 id 교집합 → 없으면 아이콘 키 → 없으면 머리 1줄 "유의한 관측이 없어 이 표에 행이 없습니다".
- 구현 결정: "더 보기" 페이지네이션 삭제(엔티티 200행 미만 + 640px 내부 스크롤). `scrollTo`는 jsdom 부재 가드.
- 인접 경계: `/compare/#unannounced` 해시 · 라인 필터 상태.
- 미확인 사항: 스크롤 최상단 정렬은 실브라우저에서만 확인 가능(sticky thead offsetHeight) — Phase 3 이후 로컬 렌더로 본다. 셀 링크와 엔티티명 링크가 서로 다른 상세로 간다(셀=그 지표, 이름=|Δ| 최대 지표) — 의도이나 사용자 확인 없음.

## ST4 홈 로직 (excluded-notes.ts · notes-count.ts · miscSections.ts)
- 기준선 요구사항: L1(의회 제거) · L2(기타 변경 카테고리)
- 변경 파일: excluded-notes.ts(신규) · notes-count.ts(수정) · miscSections.ts(신규)
- 관찰 가능한 계약: `isExcludedNote`(/의회|투표 N 결과/) · `countRelevantNoteEntities`가 제외 반영(26.18: 14 → 13) · `classifyMiscNote` 5카테고리 · `buildMiscSections` 순서·무손실.
- 구현 decision: 제외 키는 **엔티티명 정규식**(anchorKind·section으로는 결정론 분리 불가 — BRAINTRUST-residual3 §2). 「버그 수정 및 편의성 개선」은 줄 요약으로 가른다.
- 인접 경계: `countRelevantNoteEntities`는 홈 히어로·방법론 3단·대조표 커버리지·디스코드 `countEntityNotes`가 공유 → 전부 13.
- 미확인 사항: 26.16·26.17에는 의회 묶음이 없어 영향 0(실측 grep). 미래 패치의 다른 투표 묶음명은 정규식이 못 잡을 수 있다. 디스코드 헤드라인 숫자 변화(14→13)는 재발송 전까지 화면과 다를 수 있다.

## ST5 홈 UI (page.tsx · ReleaseNoteStream · ReleaseNoteRow · MiscChangesSection)
- 기준선 요구사항: L1·L2·C1·C3·C5
- 변경 파일: page.tsx(수정) · ReleaseNoteStream.tsx(수정) · ReleaseNoteRow.tsx(수정) · MiscChangesSection.tsx(신규)
- 관찰 가능한 계약: tier ≤2만 카드, tier ≥3은 `miscSections` → 목록 끝 `<li><details>` "기타 변경 N건". 카드 헤더 "유의한 관측 없음". 스킬 행 배지·판정문은 `isReportableRecord`일 때만. Gap 문구 "✕ {patch} 패치노트에 없음". 접힘 요약행 "유의한 관측 없음 N건". 탭 배지 = 카드 줄 + 기타 줄.
- 구현 결정: ReleaseNoteRow의 `sectionBundle` 경로·S4 사유 계산 제거(`explainNoObservation`·`noObservationLabel`은 streamVerdict에 남김 — 테스트 존재, UI 사용처 0). `noteDeltaRows` prop은 계약 유지용으로만 남김.
- 인접 경계: `segmentStream`(tier 2 접기) 불변 · `sectionBundle.ts`·`contentTier`는 라우팅 판별에 계속 쓴다.
- 미확인 사항: 기타 변경 블록은 라인 필터와 무관하게 항상 실린다(줄에 라인 정보 없음) — 라인 선택 시 카드 0 + 기타 블록만 남는 화면이 생길 수 있다. 접힘 블록 내부 `<section>`의 스크린리더 낭독 순서는 jsdom으로 못 본다.

## ST6 gameHref (src/lib/game.ts)
- 기준선 요구사항: C2
- 변경 파일: game.ts(수정)
- 관찰 가능한 계약: 다른 게임이면 항상 `${prefix}/`.
- 구현 결정: `SHARED_SECTIONS`·`segments` 삭제.
- 인접 경계: Header 드롭다운 `router.push(gameHref(...))`.
- 미확인 사항: 없음.

## ST7 인트로 버튼 제거
- 기준선 요구사항: C4
- 변경 파일: page.tsx · HeroSummary.tsx · pubg/shared.tsx(수정) · IntroReplayButton.tsx(삭제)
- 관찰 가능한 계약: 버튼 0. `AmbientContext.replayIntro`/`introNonce`는 남김(AmbientBackground가 nonce를 읽는다).
- 구현 결정: 컨텍스트 필드는 사용처 0이 됐지만 자동 재생 로직(`useIntroRun`)이 nonce 시그니처를 쓰므로 유지.
- 미확인 사항: `prefers-reduced-motion` 환경에서 인트로를 볼 수단이 사라졌다(버튼이 그 탈출구였다) — 사용자 지시가 제거이므로 그대로.

## ST8 상세 (causeOrder.ts · CausesPanel · NoteContrastPanel · item/[id]/page.tsx)
- 기준선 요구사항: L5
- 변경 파일: causeOrder.ts(신규) · CausesPanel.tsx · NoteContrastPanel.tsx · page.tsx(수정)
- 관찰 가능한 계약: `sortCauses` 안정 정렬 high→medium→low→미검증. 대조 카드: 스킬별 묶음 + 하단 링크 1개(`target=_blank rel=noreferrer`). 레이아웃 1행[대조|원인] h-80 · 2행 차트 · 3행[게이트|원천] h-64, 내부 스크롤.
- 구현 결정: SectionCard에 `className="flex h-80 flex-col"`을 주고 본문이 `min-h-0 flex-1 overflow-y-auto`. 원문 링크 앵커는 첫 줄의 것(같은 엔티티는 같은 h3 앵커).
- 인접 경계: `/methodology/#discord` 링크(디스코드 전송 버튼·홈 DiscordPanel)는 기존 그대로 — 그 앵커는 2026-09-14에 사라져 **죽은 링크**다(이번 범위 밖, 미확인).
- 미확인 사항: 65줄(피오라) 상세에서 h-80 안 스크롤 가독성은 실렌더로 봐야 한다. 차트 카드는 고정 높이가 아니다(단일 차트라 가변 요인 없음).

## ST9 PUBG (page · compare · methodology · weapon · map · shared · PubgCompareTable · PubgWeaponGrid)
- 기준선 요구사항: P1·P2·C1·C3·C5
- 변경 파일: 8개(PubgWeaponGrid 신규)
- 관찰 가능한 계약: 브리핑 = 타일 → 탭(표 + 단위 캡션 + 원문 링크 1) → 무기별 상세 그리드(47 링크, h-80 스크롤) → 맵(썸네일 링크). 표본·기저·게이트 카드·대리지표 문단·각주는 방법론으로. 대조표 = 판정 선 무기만(7행), 칩 3종, 무기명 링크. 방법론 = 표본 고지 · 카드 3 · 파이프라인 · 판정표(3 상태) · 표시하지 않는 관측 · 한계. 어댑터 매핑표 제거. 사용자 문구에 "리그 오브 레전드/LoL" 0.
- 구현 결정: 무기 상세의 노이즈 상태는 배지 없이 "유의한 변화 없음". 자산 없는 무기의 고지 문단 제거(폴백 마크가 이미 말한다).
- 인접 경계: `isReportable`(pubgData) 공유 · `displayStatusOf` · assets.json.
- 미확인 사항: 그리드 47장 이미지(lazy)의 LCP 영향은 Lighthouse로 본다. "LLM 판정"(P1 원문)은 PUBG에 원리적으로 없다 — 방법론에 명시했으나 사용자가 기대한 것이 그것인지 확인 없음.

## ST10 LoL 방법론 (StatusDefinitionTable · methodology/page.tsx)
- 기준선 요구사항: C3·C5
- 변경 파일: 2개(수정)
- 관찰 가능한 계약: 정의표 6행(3 표시 + 3 비표시) + 구획 헤더 + 캡션. "표시 규칙" 카드 4항(홈 2탭·대조표·상세).
- 구현 결정: 어댑터 매핑표(LoL↔PUBG)는 **유지**(확장성 증명, 방법론은 방법의 집).
- 미확인 사항: P2 원문 "리그오브레전드의 배틀그라운드문구가있으면 찾아서 없애고"를 사용자 화면(홈·대조표·상세)에 한정해 해석했다 — 방법론 매핑표까지 뜻했다면 기준선 갱신 필요.

## ST11 문서 (UX-BRIEF §3-01 12·13항 · 이 파일)
- 미확인 사항: 없음.

## 전체
- `data/aggregated/**`·`patchnotes-parser.ts`·`verdict.ts`·`pubg-delta.ts`·`next.config.ts` diff 0 — Phase 3 verify 전 `git status`/`git diff --stat`으로 확인한다.
