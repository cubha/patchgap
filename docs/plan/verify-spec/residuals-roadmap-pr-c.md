# VERIFY-SPEC — 잔여 로드맵 PR-C (2026-09-28, 10/6 머지 대기)

기준선: `docs/plan/PLAN-residuals-roadmap-2026-09-28.md` §PR-C · `BRAINTRUST-residuals-2026-09-28.md` §3 PR-C · §4 D2·D3·D4.
브랜치: `feature/residuals-prc`(PR-B 위에 누적, 미푸시). **10/6 전 머지 금지**(D4 — 출품 스크린샷 보호).

## C1 — B1 섹션 순서 뒤집기(발견 먼저)
- 변경: `BriefingTabs.tsx` `BRIEFING_TAB_ORDER=["gap","content"]`·`DEFAULT_BRIEFING_TAB="gap"`, LoL `ReleaseNoteStream`도 같은 기본값. UX-BRIEF에 브랜치 준비 기록(표 행 갱신은 머지 시점).
- 명세 변경한 기존 테스트: `screen-parity.test.ts` 탭 순서 검사, `home/__tests__/render.test.tsx` 기본 탭 전제 5건(패치 내용 탭은 먼저 누른다), `pubg/__tests__/page-order.test.tsx` 순서 검사(패치 내용 탭을 연 뒤).
- 미확인: 이 순서는 2026-09-21 사용자 재확인(「읽는 순서가 맞다」)을 뒤집는다 — D4 채택으로 준비했지만 **머지 시 사용자 확인**이 필요하다.

## C2 — B2 TFT·PUBG 탭을 LoL식(카드 안)
- 변경: `BriefingTabs`가 유리 카드를 소유하고 탭 바를 그 첫 자식으로(LoL 스트림과 같은 `px-5 pt-4` 탭 행), 카드·사이드 한 행. `SectionCard variant="embedded"`(표면 없음) — TFT·PUBG 탭 패널이 사용. 수치 축 섹션은 LoL처럼 카드 안 위쪽 갈래(`p-5` + 아래 테두리).
- 명세 변경: `screen-parity` 「2컬럼 골격」 검사(행 분할 → 카드·사이드 한 행). 신설 `tabs-in-card.test.tsx`(세 게임 동일 구조).
- 미확인: 렌더 스크린샷 대조는 하지 않았다(축B 대상). 카드 높이·스크롤(`PANEL_SCROLL_BODY`)이 LoL 카드와 같게 보이는지 확인 필요.

## C3 — D2 타일=탭 합집합
- 변경: 세 게임 홈 모두 `gapUnionCount(gapEntityKeys(통계 Gap 대상), submarine)`를 타일과 탭에 같이. LoL `HeroSummary gapCount` prop, LoL 스트림 지표 축 머리 숫자는 `metricGapCount`(뺄셈 제거).
- 실측(렌더): LoL 타일 36 = 탭 36, TFT 34 = 34, PUBG 같음(수치 축 0). 신설 `gap-tile-tab.test.tsx`.
- 후속(같은 날): 랜딩 카드도 같은 라벨(`TILE_LABELS.gap`)이라 같은 수여야 한다 — `lib/gapTotals.ts`(`lolGapTotal`·`tftGapTotal`·`pubgGapTotal`)가 정의의 단일 소유자, 세 게임 홈과 `landing.ts`가 모두 부른다. TFT 랜딩은 원시 status 행 수 → 대조표 표시 상태 기준 대상 ∪ 수치 축, PUBG는 홈이 `status==="unannounced"` → `isGapStatus`(현 데이터 간접 영향 0건이라 수 변화 없음).
- 명세 변경: `lib/__tests__/landing.test.ts` 「미공지 ⊆ 유의한 관측」 불변식 삭제(수치 축 대상은 통계 관측이 아니라 부분집합이 아니다) → 관측 전 null 대칭만 유지. `gap-tile-tab.test.tsx`에 「랜딩 카드 = 홈 타일」 단언 추가(test-after — 구 정의면 LoL 35≠36으로 실패).
- 미확인: 랜딩 합산 타일(세 게임 합)은 게임 간 대상 합이라 중복이 없다(게임별 키 공간이 다름) — 별도 검사는 없다.

## C4 — B3 과거 쌍 라우트 + select
- 변경: LoL 브리핑 본문을 `components/home/LolBriefing.tsx`(쌍 인자)로 옮기고 `/lol/`은 최신 쌍, `app/lol/history/[pair]/page.tsx`가 과거 쌍(정적, 없으면 `_placeholder`). `lib/pairRoutes.ts`(슬러그·href·경로 해석). 헤더 select: LoL이고 쌍이 여럿이면 열려 `router.push`, 과거 쌍 경로면 그 쌍이 선택되고 기본 쌍 n·집계 캡션은 숨김. 그 밖의 게임은 닫고 이유를 말한다.
- 선행: 과거 LoL 쌍(26.16→26.17·26.17→26.18) 재생성 — LLM 호출 0, 판정 변화 0(대상 선정 규칙상 비대상 행의 llm 79·59건 제거).
- 실측: `next build` → `out/lol/history/26.16-26.17/`·`26.17-26.18/` 생성, 각 쌍의 헤드라인 숫자가 다름.
- 명세 변경: `screen-parity` 상세 계약에서 `history` 제외(대상 상세가 아니라 브리핑), 헤더 select 테스트(F3 표시 전용 → LoL 실제 이동).
- 미확인: 과거 쌍 화면의 대상 링크(`/lol/item/[id]`)는 그 id가 처음 나오는 쌍의 상세로 간다 — 과거 쌍 문맥이 상세에서 이어지지 않는다. `/lol/compare/`는 기본 쌍만. TFT(쌍 2개)는 라우트를 만들지 않았다(D3 범위 = LoL).
