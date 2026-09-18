# PLAN — 해커톤 채점 라운드5 (잔여 3점 + D4)
생성: 2026-09-18 · 소스: `/braintrust` 패널 종합(`docs/plan/BRAINTRUST-residual3-2026-09-18.md`) + 사용자 결정 + 시안 실렌더 승인

## 요구사항 (사용자 요청 원문 기준)
- R0. "남긴3건 /braintrust 진행 --> 권고방향에맞게 /sh-dev-loop --tdd --auto 구현 --> 재채점 및 보완 반복"
- R1. (E2·시안 질문에 대해) "둘다 ux및 디자인시안먼저 확인받고 진행방향 선택할게" → 실렌더 비교 아티팩트 제시(https://claude.ai/artifact/XwKP7PM9j8JpyDmdyPCUL3) → **"전건 권고방향에맞게 진행"**
- R2. (D4 캡션에 대해) "분석llm모델을 사용자가 알아야할 이유가잇나?" → 캡션에서 모델 id 제거로 해석(당초 "방법론이 모델명을 말한다"고 전제했으나 Phase 3에서 반증 — 완료 조건 4 참조)
- R3. 상속 제약(verbatim): "이때 파괴적인 수정사항이나 기본 시스템의 목표, 틀을 수정하는 행위는 최대한 지양하고, 불가피한상황이면 나한테 확인 후 confirm받고 진행해" — E2 접기는 시안으로 confirm 받음(R1)

## 확정 제약·거부
- 판정 엔진(`verdict.ts`)·`MatchStatus`·`EFFECT_SIZE_FLOORS`·재분류 임계 불변
- **파서(`patchnotes-parser.ts`) 무수정** — LLM 캐시 키(`candidateSetHash` = 전체 노트 해시)·note id 슬러그가 바뀌어 `notes/*.json`·`deltas/*.json` 재생성 + 캐시 전량 무효(패널 §2). B2는 표시 층위에서만
- `data/aggregated/*.json` 손 편집 금지
- 섹션 묶음 4건을 다른 탭·층위로 **옮기지 않는다** — `contentCount = meta.itemCount`와 화면 행 수가 어긋난다(R3 "타일 49 vs 화면 47" 재현 경로)
- E2 요약행은 **건수만** — 사유 문구 금지(6건 중 5건 `mixed`, 그룹 사유 단정 = "대표 1행 사유 거짓" 재발) · 항상 접는다(조건 분기 금지) · 요약행은 목록 항목(레인 필터·빈 상태와 정합)
- stat-tile 3개(PUBG 시안 요소) 불변 · 별도 탭 금지(UX-BRIEF §3-01)
- 참조 구현: worktree `../patchgap-mock`(branch `mock/round5`) — `next.config.ts`의 `turbopack.root`는 mock 전용, **출하 금지**

## SubTask (전량 [S] 인라인 — 독립 4개 미만·파일 중복)
| ID | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST1 | [TDD] | `isSectionBundle(group, icon, noteDeltaRows)` — 아이콘 해석 null ∧ 비치장 ∧ 짝 델타 0행 | `src/components/home/sectionBundle.ts` + `__tests__/sectionBundle.test.ts` |
| ST2 | [TDD] | `contentTier`/`sortMatchedGroups`에 섹션 묶음 티어(3) 추가, 치장 4로 재번호. 순서 불일치→일치→관측없음→섹션묶음→치장 | `src/components/home/releaseStream.ts` + `__tests__/releaseStream.test.ts` |
| ST3 | [TDD] | `segmentStream(entries)` — 연속 tier 2 항목을 접힘 구간으로, 나머지는 rows. 순서 불변·행 손실 0 | `src/components/home/streamSegments.ts` + `__tests__/streamSegments.test.ts` |
| ST4 | — (UI) | 홈 배선: page.tsx 아이콘 선계산→섹션 묶음 집합→정렬→entries(tier·sectionBundle) · ReleaseNoteStream 접기 요약행 `<details>` · ReleaseNoteRow 섹션 묶음 위계(§ 표식·`text-fg-2`·"N개 항목 · 패치노트 섹션 · 엔티티 아님") | `src/app/page.tsx` · `ReleaseNoteStream.tsx` · `ReleaseNoteRow.tsx` · `render.test.tsx`(test-after) |
| ST5 | — (UI) | `/pubg/` 카드 3장(표본·기저·게이트)을 `PubgBriefingTabs` 아래로 + 표 머리 캡션 "모든 수치는 매치당 총 획득 대비 점유율(기저 보정) · n→n매치" | `src/app/pubg/page.tsx` + `src/app/pubg/__tests__/page-order.test.tsx`(test-after) |
| ST6 | [TDD] | `llmCaption` → "LLM 검토 · {KST} 기준"(모델 id·"캐시" 제거, `LLM_MODEL` import 제거) | `src/components/item/CausesPanel.tsx` + `__tests__/llmCaption.test.ts` |
| ST7 | — | 문서: UX-BRIEF §3-01(접기·섹션 묶음)·§3-05 PUBG 순서 · PLAN-gap-display-unify §ST-A2 1줄 · 채점표 §2 D4 문구 정밀화("요약문·캡션에 raw 모델 id 없음") + A3 사유 정정 · BRAINTRUST §9 결과 | `docs/design/UX-BRIEF.md` · `docs/plan/*.md` |
| ST8 | — | 재채점: 프로덕션 실렌더로 A3·B2·E2·D4 + 만점 항목 재확인, 채점표 §3 라운드5 표 | `docs/plan/SCORECARD-hackathon-2026-09-18.md` |

## UI 설계 명세
- Ground Truth: `docs/design/DESIGN-TOKENS.md` · `docs/design/UX-BRIEF.md` §3-01(홈) · `docs/design/prototype/01-briefing-home.html` · PUBG는 아티팩트 「PUBG 테마 시안」(히어로·타일까지)
- 전부 기존 화면 수정 → `/frontend-design` 생략. 시각은 승인된 실렌더 시안(R1 아티팩트)과 동일해야 한다.

## 완료 조건
1. 홈 프로덕션 첫 10행(카드 summary 기준) 중 "관측 변화 없음"류 문장 ≤1 · 접힘 안 6장 전부 존재(펼치면 카드 그대로)
2. 홈에서 엔티티 카드로 렌더된 섹션 제목 0건(26.18: 의회·증강·버그 수정·버그 수정 및 편의성 개선 4건이 모두 "패치노트 섹션" 위계) · `unpaired` 배지·34줄 유지
3. `/pubg/` DOM 순서: 타일 → 탭 → 표(캡션 포함) → 표본·기저·게이트 카드 → 맵 · 393px 오버플로 0
4. 상세 캡션에 `claude-`·"캐시" 0건, "LLM 검토" 존재. **기준선 정정(Phase 3, acceptance-critic V1·scope-critic ST6 ③)**: 원문 "방법론 페이지의 모델 표기는 유지"는 잘못된 전제였다 — 방법론은 원래 모델명을 말한 적이 없고(`pipelineSteps.ts:81` "2단 LLM 후보 검증"으로 **역할**만 명시, `git log`상 변경 이력 없음) 유일한 노출처가 이 캡션이었다. 사용자 결정(R2 "알아야 할 이유가 있나")에 따라 **사이트 어디에도 모델명을 두지 않는다**. 되돌리기는 방법론 단계 문구 1줄이면 된다
5. `data/aggregated/**` diff 0 · `patchnotes-parser.ts` diff 0 · `next.config.ts` diff 0
6. `verify.sh --full` PASS · 기존 테스트 약화 0(명세 변경은 주석으로 명시)
7. 채점표 §3 라운드5 표 + 잔여 항목 사유
