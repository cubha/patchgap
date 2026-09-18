# PLAN — 사용자 리뷰 라운드6 (공통 5 · LoL 5 · PUBG 2)
생성: 2026-09-18 · 소스: 사용자 요청 원문(세션) · 실행: `/sh-dev-loop --tdd --auto` → `/verify-impl` → 별도 에이전트 재판정 → 보완 반복

## 요구사항 (사용자 요청 원문 — 요약 금지)

### [공통]
- C1. "표본부족, 바닥미달, 변화없음 --> 표본부족하고 수치에 유의미한 변화가 없는항목 최대한 배제(아얘 보여주지않도록) --> 사용자가 확인해야할 데이터에 집중을 위함"
- C2. "배틀그라운드, 리그오브레전드 변환하는데 메뉴는 유지됨 --> 브리핑 메뉴가 기본값. 테마전환될때마다 초기화되도록"
- C3. "방법론에서 표현해야할 정보, 텍스트들이 무분별하게 각 메뉴의 각섹션에 표기됨 --> 메뉴에서는 실제로 사용자들에게 제공해야할 정보만. 표기이유나 방법에 대한 내용은 방법론 메뉴에 총망라"
- C4. "인트로재생 버튼 제거"
- C5. "대조표 뱃지 중복내용 및 의도 불분명 내용 다수 >
  - 공지: 공지된 내용은 공지된 내용인데 공지-일치, 불일치, 관측미확인 등 상세 value가 나뉨. --> 통일해야할거같음 단 공지내용은 상향인데 승률, 픽률 등 실측은 하락된 대상은 뱃지에 이상관측 표시
  - 미공지, 노트에없는변화, 간접영향은 결국 미공지내용이라는 뜻임. 통일"

### [리그오브레전드]
- L1. "관측변화없음 항목 중 의회-투표결과 항목의 존재이유? --> 어떤 데이터를 표시하는지도 모르겟고, 사용자 입장 - 특히 지금 이 시스템 타겟은 게임을 전문적으로 '잘하는 고랭크 유저'들을 위한 시스템임. 전혀 불필요한 정보기 때문에 없어도될듯"
- L2. "버그수정, 증강, 버그수정 및 편의성 개선, ... 등 관측변화없음 전체항목은 하나의 섹션으로 묶여야함. 단순 버그수정, 편의성 개선 및 신규 스킨 등 내용은 중요도가 낮은 정보에 해당하며, 위 항목들 전부 관측 불필요하기 때문에 관측없음 뱃지 불필요. 단, 버그수정이면 버그수정, 편의성개선은 편의성개선, 신규스킨 테마 등은 신규스킨 등 Value별로 묶어 섹션이 명확하게 구분되게 표시해야함"
- L3. "대조표 > 델타테이블에 동일한 챔피언이 별도의 행으로 표기 --> 이건 그리드 coldef의 문제인거같음. 델타테이블 Label에 버전 Mig 표시하고, 지표 및 버전 col 제거 --> 벤률 / 승률 / 픽률 / 채택률을 인라인으로 표시. 상승 하락 기호까지 cell데이터에 함께표시 (탑,미드,바텀 등 골드내용은 분명히 빼라고 몇번얘기함.)"
- L4. "대조표 > 패치노트 항목도 동일하게 동일챔피언에 대한 항목이 별도 행으로 표기됨. 챔피언, 아이템 별로 하나의 항목으로 묶어서 표시 --> 클릭 시 델타테이블 Focus 강화 (해당 대상이 최상단으로 Scroll Focus되도록 개선)"
- L5. "챔피언 상세 페이지 개선
  - 패치노트 대조: 각 항목마다 패치노트 원문보기 link가 보임. 패치노트 내용 전부 표시하고 하단에 링크는 한번만 (링크도 이동이 아닌 신규창열기)
  - 추정원인: 패치노트와 동일하게 최상단에 표시할 수 있도록 --> 이에따라 영역조정 및 통계게이트와 원천매치는 최하단으로 이동(중요도 낮음). 추가로 각항목 height고정하고 내부스크롤발생하도록 (지금 원천매치 등 타섹션에 따라서 height가 계속가변됨)하고 추정원인의 신뢰도낮음은 최하단으로 표시되도록"

### [배틀그라운드]
- P1. "상세페이지 진입점이없음 --> 총기, 맵류, ... 등 상세 관측내용 및 LLM판정을 확인할 수 없음 (스플레시 페이지 추가하라고 계속얘기함)"
- P2. "리그오브레전드와의 차이를 비교하는 문구, 내용들이 계속 반복됨. 이거는 정말 잘못되었다 생각함. 배틀그라운드는 배틀그라운드대로 판정내용이 다른데 이를 명시하면 오히려 사용자한테 반감만 증가함. 리그오브레전드의 배틀그라운드문구가있으면 찾아서 없애고 배틀그라운드 문구는 리그오브레전드와의 비교가아닌 판정표 기준으로 전면 재작성"

### 재판정 기준(사용자 원문 — 채점 에이전트 입력)
1. "해당 시스템은 '숙련자', '고티어유저', '게이머' 등 게임에 대해서 명확하게 파악하고있는 유저를 대상으로한 시스템임. 이에맞게 게임에 영향없는 불필요한 내용은 중요도가 낮음 --> Focus 및 우선표시되는 대상이 타겟을 기준으로 작성되어있는지 (일반 패치내용이 누락되어서는 안됨. 일반패치내용 우선표기, 미공지 Gap 별도탭 표기 현행은 유지)"
2. "시스템의 목적은 패치내용에는 없는 이상현상을 LLM 이 다각도로 판정(여러 Case의 간접영향 가능성을 두고 추측)하여 사용자에게 제공함 --> 이에맞게 명확하게 목적에 맞는 데이터를 제공하는지, 판정이 잘못된 항목은없는지(판정의 근거확인 --> 적합한지 확인), 다른 데이터가 더 우선시 표현되지는 않는지, .. 등"
3. "디자인적으로 특정영역의 Stretch로 인한 전체 Scroll 폭발 발생하지는 않는지 (영역 고정되어 항상 동일한 레이아웃 보장. 각 섹션 내부스크롤로 표현)"
4. "각섹션, 항목에서 사용자에게 제공하는 텍스트가 AI스러운 텍스트, 불필요한 구어체 텍스트를 지양하고 간결하게 필요한 정보를 가독성 좋게, 명확하게 사용자에게 제공하는지"

### 상속 제약(verbatim)
- "이때 파괴적인 수정사항이나 기본 시스템의 목표, 틀을 수정하는 행위는 최대한 지양하고, 불가피한상황이면 나한테 확인 후 confirm받고 진행해" — 이번 라운드의 표시 축 변경(노이즈 배제·의회 제거·배지 어휘 통일)은 **사용자 원문이 직접 지시한 것**이므로 별도 confirm 없이 진행한다. 판정 엔진·데이터는 불변.

## 확정 제약·거부
- 판정 엔진(`verdict.ts`·`pubg-delta.ts`)·`MatchStatus`·`EFFECT_SIZE_FLOORS`·`data/aggregated/**`·`patchnotes-parser.ts`·`next.config.ts` 무수정. 배지 통일은 **표시 키**(`display-status.ts`)에서만.
- "미공지 Gap 별도 탭 현행 유지"(재판정 기준 1) — 홈 2탭·PUBG 2탭 구조 불변. 일반 패치 내용(챔피언·아이템 밸런스 줄)은 누락 금지 — C1의 배제 대상은 **관측(델타 행)**이지 패치노트 줄이 아니다.
- C1 해석: 화면에서 `insufficient-sample`·`below-threshold`·`no-change`·**비유의/바닥 미달 공지 관측**은 표시하지 않는다. 판정 엔진 결과(파일)는 그대로이며 방법론이 "표시하지 않는 관측"으로 규칙을 밝힌다.
- C5 해석: 표시 키 3종 + 부재 1종 — `announced`(공지) · `announced-anomaly`(공지 · 이상 관측 = 노트 방향과 반대로 유의·바닥 통과) · `unannounced`(미공지 = `unannounced`+`indirect-effect`) · `unpaired`(짝지은 관측 없음, 홈 스킬 행 전용). 칩도 4종(전체/공지/공지 · 이상 관측/미공지).
- L1 해석: 「의회 - 투표 N 결과」 섹션 묶음은 패치 내용이 아니라 커뮤니티 투표 결과다 → 스트림·엔티티 수 집계에서 제외(`pipeline/shared/excluded-notes.ts`, 홈·방법론·디스코드 카운트가 같은 규칙을 본다).
- L1 확장(2026-09-19, 독립 채점 1회차 보완 1·2·5 — 82/100): 26.18 원문의 게임 모드 섹션(`#patch-classic`·`#patch-aram:-mayhem`)이 파서에서 "피오라" 65줄로 귀속돼 SR 챔피언 공지 카드·"공지" 판정·아트록스 원인 인용의 근거가 됐다. 파서·verdict·deltas JSON은 보호 대상이므로 **표시 층위**가 같은 제외 우주로 흡수한다: `isModeSectionNote`(앵커 해시) → 엔티티 수·대조표 내비에서 제외, 홈은 "기타 변경 › 게임 모드(클래식)" 줄, 짝이 전부 제외 노트인 관측은 표시용 `unannounced`·제외 노트를 인용한 원인은 `verified:false`(`display-normalize.ts`, `loadDeltas` 한 곳). **미확인(사용자 결정)**: 근본 수정은 파서의 모드 섹션 스코프 + 재매칭(LLM 캐시 전량 무효)이며 이번 라운드 범위 밖.
- 단위 통일(보완 4): 미공지 수는 히어로 타일·Gap 탭 배지·대조표 커버리지 전부 **엔티티** 수(관측 행 49 vs 카드 28 병존 해소).
- 보완 7(LLM 원인 문장 길이·완곡 종결)은 `data/aggregated` LLM 산출물이라 미반영 — 재생성은 SCOPE·파이프라인 재실행 사안.
- L2 해석: tier 3(섹션 묶음)·tier 4(치장) 그룹을 카드로 그리지 않고 **"기타 변경" 1블록**(접힘 `<details>`)으로 모아 카테고리(버그 수정 / 편의성 개선 / 신규 스킨·치장 / 증강 / 기타)별 소제목 아래 줄만 나열한다. 배지 0. tier 2(밸런스 줄이 있으나 유의 관측 없는 챔피언)는 **카드 유지**(패치 내용 누락 금지) — 헤더 문구만 "유의한 관측 없음", 스킬 행 배지는 보고 가능한 관측이 있을 때만.
- L3 해석: 델타 테이블 = **엔티티 1행**(챔피언·아이템만; 라인 골드·오브젝트·매치 평균 행 제외), 열 = 엔티티 · 밴률 · 승률 · 픽률 · 채택률 · 상태. 셀 = `전 → 후 ▲+Δ%p`(보고 가능 지표만, 아니면 빈칸 `—`). 표 머리에 `26.17 → 26.18` 버전 표기. 라인 필터 선택 시 그 라인의 position 행으로 셀을 채운다(밴률은 라인 무관이라 `—`).
- L4 해석: 좌 내비 = 엔티티 1항목(줄 수·스킬 요약·배지). 클릭 → 우 테이블 해당 행을 스크롤 컨테이너 **최상단**으로 이동 + 강조. 테이블에 행이 없으면(유의 관측 0) 그 사실을 표 머리 1줄로 말한다.
- L5 해석: 상세 레이아웃 = 1행 [패치노트 대조 | 추정 원인(LLM)] · 2행 [전/후 관측값] · 3행 [통계 게이트 | 원천 매치]. 1·3행 카드는 고정 높이(`h-80`/`h-64`, Tailwind 표준 스케일) + 내부 스크롤. 원문 링크는 카드 하단 1회 `target="_blank" rel="noreferrer"`. 원인 정렬: 검증 high → medium → low → 미검증.
- P1 해석: `/pubg/`에 **무기 상세 진입 그리드**(렌더 이미지·이름·점유율·변화, 전 무기, 고정 높이 내부 스크롤) 신설 + 대조표 무기명 링크화 + 맵 카드 썸네일. LLM 판정은 PUBG 파이프라인에 없다(설계) — 상세는 관측·판정 근거만 보여주며 그 사실을 방법론이 말한다.
- P2 해석: PUBG 3화면·상세 2종의 사용자 노출 문구에서 "리그 오브 레전드/LoL" 비교 서술 0건. PUBG 방법론에서 어댑터 매핑표(LoL↔PUBG) 제거, 판정 규칙을 판정표(상태 정의) 기준으로 재작성. LoL 사용자 화면(홈·대조표·상세)에 PUBG 문구 0건. **LoL 방법론의 어댑터 매핑표는 유지**(확장성 증명 — 방법론은 "표기 이유·방법"의 집이라 C3와 정합) — 미확인 사항으로 남긴다.
- C3 해석: 각 메뉴의 "왜 이렇게 표시하나/어떻게 계산하나" 문단·캡션 제거(홈 정렬 고지, PUBG 브리핑 대리지표 문단·표본/기저/게이트 카드·맵 각주, PUBG 대조표 각주 등) → 방법론으로 이동. 단위·기준선(예: "총 획득 대비 점유율 · n매치")처럼 수치 해석에 필수인 1줄은 남긴다.
- 기존 테스트 약화 금지 — 명세 변경으로 바뀌는 단언은 주석에 사유를 남긴다.

## SubTask (전량 [S] 인라인 — 파일 공유·타입 의존)
| ID | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST1 | [TDD] | 표시 키 통일(C5·C1): `DisplayStatus = announced \| announced-anomaly \| unannounced \| below-threshold \| insufficient-sample \| no-change \| unpaired`, `displayStatus(record,q)`, `displayStatusOf(status)`, `isNoiseStatus`, `DISPLAY_SORT_PRIORITY`; 라벨·배지 색 | `src/pipeline/shared/display-status.ts` · `src/lib/format.ts` · `src/components/StatusBadge.tsx` + `__tests__/display-status.test.ts`·`format.test.ts`·`components.test.tsx` |
| ST2 | [TDD] | 대조표 로직(L3·L4·C1): `buildEntityRows(rows, lane, q)` 엔티티 1행·보고 가능 셀만·노이즈 행 제외·대표 상태·정렬; `STATUS_FILTERS` 4종·`filterByStatus`; `groupNotesForNav`·`representativeStatusForNotes` | `src/components/compare/entityRows.ts`(신규) · `src/components/compare/logic.ts` + `__tests__/entityRows.test.ts`·`logic.test.ts` |
| ST3 | — (UI) | 대조표 화면: DeltaTable 인라인 지표 열·버전 표기·행 스크롤 포커스 · NoteNavigator 엔티티 묶음 · CompareExplorer 포커스 상태·`#unannounced` 해시 · CoverageBar 어휘 · HeroSummary 타일 링크 | `src/components/compare/{DeltaTable,NoteNavigator,CompareExplorer,CoverageBar}.tsx` · `src/components/home/HeroSummary.tsx` + `compare/__tests__/render.test.tsx` |
| ST4 | [TDD] | 홈 기타 변경 묶음(L1·L2): `isExcludedNote`(의회 투표 결과) 공용 + `countRelevantNoteEntities` 반영; `buildMiscSections(groups)` — 카테고리 분류(버그 수정/편의성 개선/신규 스킨·치장/증강/기타) | `src/pipeline/shared/excluded-notes.ts`(신규) · `src/pipeline/shared/notes-count.ts` · `src/components/home/miscSections.ts`(신규) + 테스트 |
| ST5 | — (UI) | 홈 배선: page.tsx(제외·기타 분리·contentCount) · ReleaseNoteStream(기타 변경 블록·정렬 고지 제거) · ReleaseNoteRow(섹션 묶음 경로 제거·배지/판정문은 보고 가능 관측만·Gap 문구 축약) · `MiscChangesSection.tsx` 신규 | `src/app/page.tsx` · `src/components/home/{ReleaseNoteStream,ReleaseNoteRow,MiscChangesSection}.tsx` + `home/__tests__/render.test.tsx` |
| ST6 | [TDD] | 게임 전환 시 브리핑으로(C2): `gameHref` 다른 게임이면 항상 `${prefix}/` | `src/lib/game.ts` + `__tests__/game.test.ts` |
| ST7 | — | 인트로 재생 버튼 제거(C4): 홈·PUBG 헤더 사용처 삭제, 컴포넌트 삭제 | `src/app/page.tsx` · `src/components/home/HeroSummary.tsx` · `src/components/pubg/shared.tsx` · `src/components/IntroReplayButton.tsx`(삭제) |
| ST8 | [TDD]+UI | 상세(L5): `sortCauses` 순수 함수 + CausesPanel 적용 · NoteContrastPanel 전문 표시+하단 링크 1회(새 창) · 페이지 레이아웃 재배치·고정 높이 | `src/components/item/{causeOrder.ts(신규),CausesPanel,NoteContrastPanel}.tsx` · `src/app/item/[id]/page.tsx` + `item/__tests__/causeOrder.test.ts`·`NoteContrastPanel.test.tsx` |
| ST9 | — (UI) | PUBG(P1·P2·C1·C3): 브리핑(카드 3장·설명 문단 제거 → 방법론, 무기 상세 그리드, 맵 썸네일, 링크 어포던스) · 대조표(노이즈 제외·칩 3종·무기명 링크) · 방법론(표본/기저/게이트 흡수·판정표 기준 규칙·매핑표 제거) · shared(리드·표본 고지 재작성) · 상세 2종 문구 | `src/app/pubg/{page,compare/page,methodology/page,weapon/[key]/page,map/[key]/page}.tsx` · `src/components/pubg/{PubgCompareTable,PubgWeaponGrid(신규),shared}.tsx` + `pubg/__tests__/page-order.test.tsx` |
| ST10 | — (UI) | LoL 방법론(C3·C5): 상태 정의표를 표시 키 기준으로 재작성(공지/공지 · 이상 관측/미공지 + "표시하지 않는 관측" 3행) · "표시 규칙" 카드(정렬·배제·기타 변경·상세 배치) | `src/components/methodology/StatusDefinitionTable.tsx` · `src/app/methodology/page.tsx` + 테스트 |
| ST11 | — | 문서: UX-BRIEF §3 승계 목록 12·13 · 이 PLAN 갱신 · verify-spec | `docs/design/UX-BRIEF.md` · `docs/plan/verify-spec/user-review-round6-2026-09-18.md` |

실행 순서: ST1 → ST2 → ST3 → ST4 → ST5 → ST6 → ST7 → ST8 → ST9 → ST10 → ST11 → Phase 3 배치 검증 → `/verify-impl` → 재판정(별도 에이전트) → 보완.

## UI 설계 명세
- Ground Truth: `docs/design/DESIGN-TOKENS.md` · `docs/design/UX-BRIEF.md` §3 · `docs/design/prototype/0{1,2,3,4}-*.html`. 전부 기존 화면 수정 → `/frontend-design` 생략.
- 델타 테이블 셀: `font-mono tabular-nums` · `전 → 후` 회색, `▲/▼ Δ` 는 `text-success`/`text-danger`(DeltaValue 관례). 빈 셀 `—` muted.
- 기타 변경 블록: 홈 스트림 `<ul>` 마지막 `<li>` — 접힘 요약행(`관측 변화 없음` 요약행과 같은 골격) "기타 변경 N건", 펼치면 카테고리 소제목(`text-xs font-bold text-fg-2`) + 줄(`text-sm text-fg-2`).
- 상세 고정 높이: `h-80`(320px) 1행 카드, `h-64`(256px) 3행 카드, 내부 `overflow-y-auto`. 라이트하우스·393px 오버플로 0 유지.
- PUBG 무기 그리드: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`, 카드 = 렌더(`object-contain`, 없으면 텍스트 마크) · 이름 · 43.1 점유율 · 변화(색). 컨테이너 `h-80 overflow-y-auto`.

## 완료 조건
1. 대조표: 델타 테이블 행 = 엔티티 단위(같은 챔피언 2행 0건) · 열에 지표/버전 없음 · 라인 골드/오브젝트/매치 평균 행 0 · 노이즈 상태 행 0 · 좌 내비 항목 = 엔티티 단위 · 클릭 시 해당 행이 스크롤 컨테이너 최상단(offset ≤ 8px)
2. 배지·칩 어휘: 화면 전체에서 `공지-일치`·`공지-불일치`·`관측 미확인`·`공지 · 바닥 미달`·`간접 영향`·`노트에 없는 변화` 0건(방법론 정의표는 옛 어휘를 쓰지 않는다) · `공지 · 이상 관측`은 방향 반대·유의·바닥 통과 행에만
3. 홈: 「의회 - 투표 1 결과」 0건 · 버그 수정/증강/편의성/스킨은 "기타 변경" 1블록 안 카테고리별 · 그 블록 안 배지 0 · 챔피언·아이템 카드는 전부 존재(26.18: 13개) · 패치 내용 탭 배지 = 표시 줄 수
4. 게임 전환: 어느 화면에서든 드롭다운 전환 → `/` 또는 `/pubg/`
5. 인트로 재생 버튼 0건(`IntroReplayButton` 파일 없음)
6. 상세: 패치노트 대조 카드에 원문 링크 1개(`target=_blank`) · 추정 원인 카드가 1행 우측 · 통계 게이트·원천 매치가 최하단 · 1·3행 카드 고정 높이 · 원인 목록 low가 뒤
7. PUBG: 브리핑에 무기 상세 진입 그리드 존재(전 무기 링크) · 대조표 무기명 링크 · PUBG 5화면 사용자 문구에 "리그 오브 레전드/LoL" 0건 · LoL 홈·대조표·상세에 "PUBG/배틀그라운드" 0건 · 표본·기저·게이트 카드는 `/pubg/methodology/`에만
8. 각 메뉴 설명 문단 제거 목록 이행(홈 정렬 고지 · PUBG 브리핑 대리지표 문단·맵 각주 · PUBG 대조표 각주) · 방법론에 "표시 규칙" 카드 존재
9. `verify.sh --full` PASS · `data/aggregated/**`·`patchnotes-parser.ts`·`verdict.ts`·`pubg-delta.ts` diff 0 · 기존 테스트 약화 0(명세 변경 주석)
10. 재판정: 4기준 채점 항목을 추출 → 별도 에이전트가 프로덕션/로컬 실렌더로 채점 → 보완 항목 반영 → 재판정(라운드 상한 2)

## 재판정 결과 (완료 조건 10 — 독립 채점 에이전트, 로컬 정적 빌드 실렌더, 2026-09-19)
| 회차 | 총점 | 축 | 비고 |
|---|---|---|---|
| 1 | 82.0 | K1 16 · K2 23 · K3 25 · K4 18 | 핵심: 클래식 모드 섹션 "피오라" 65줄 오귀속(파서) → 공지 판정·원인 인용 오염 · 미공지 49/28 단위 병존 · 히어로 설명 문장 · 어휘 4건 |
| 2(델타) | 96.0 | K1 20 · K2 29 · K3 25 · K4 22 | FIX-3(6a9e5fc) 반영 확인. 잔여: 아트록스 LLM 요약 본문색 · PUBG 히어로 "KR 스쿼드" 사실 오류 |
| 3(델타·최종) | **98.0** | K1 20 · K2 30 · K3 25 · K4 23 | FIX-4(0a76768). 보류 1 = K4-3 LLM 원인 문장 길이·완곡 종결(`data/aggregated` LLM 산출물 — 재생성 사안) |

채점표 `docs/plan/RUBRIC-user-review-round6-2026-09-18.md` · 채점 지시 `scratchpad/r6/grader-prompt.md`(세션 한정). 완료 조건 1~9는 verify.sh --full PASS(0a76768)·acceptance-critic 3회차(V1~V6 ✅/V6 근거 재생성)·screen-critic(이탈 1 → 기준선 갱신)·실렌더 스모크로 확인.
