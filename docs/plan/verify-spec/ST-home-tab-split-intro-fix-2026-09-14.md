# VERIFY-SPEC — 홈 스트림 탭 분리 + 앰비언트 인트로 매 로드 재생 (2026-09-14)

PLAN: `docs/plan/PLAN-home-tab-split-intro-fix-2026-09-14.md`

## SubTask A — 인트로 localStorage 게이트 제거

- 파일: `src/components/AmbientBackground.tsx`
- 변경: `INTRO_SEEN_KEY` 상수·localStorage try/catch 제거, `useIntroReveal`은 `enabled`시 즉시
  `setPlaying(true)`만 수행. 리빌 JSX에 `isHome &&` 가드 추가(재생 중 라우트 이탈 시 즉시 정리).
- 구현 결정: "매 홈 진입마다"가 아니라 "마운트당 최대 1회"로 확정 — `introEnded`(재생 종료 후
  정지 이미지 유지) 리셋 없이 삭제만으로 F5 재생·딥링크 최초진입 재생·왕복 미재생 3조건 동시
  만족(PLAN 근거 절 참고). 새 분기 코드 없음.
- 테스트: 미작성(TDD 미적격 — 삭제 위주, 기존 테스트 전례 없음). Playwright로 실측(아래).
- 미확인 사항: `prefers-reduced-motion: reduce` 환경에서의 회귀 테스트는 자동화하지 않음(기존
  로직 무변경이라 저위험으로 판단, 수동 확인도 생략).

## SubTask 1 — releaseStream 분리 [TDD]

- 파일: `src/components/home/releaseStream.ts`, `src/components/home/__tests__/releaseStream.test.ts`
- 변경: `interleave()` 삭제, `buildReleaseStream` = `[...matched, ...unannounced]`.
- RED→GREEN 확인: RED 1건(신규 불변식 테스트)이 무효 RED 아님(사유=구현 미변경) 확인 후 GREEN
  전환, 13/13 통과.
- 구현 결정: `{matched, unannounced}` 객체 분리 대신 기존 `ReleaseStreamGroup[]` 유지(concat) —
  page.tsx/ReleaseNoteStream.tsx 무변경으로 SubTask 경계 독립성 확보.
- 미확인 사항: 없음(순수 함수, 전수 케이스 커버).

## SubTask 2 — 탭 UI + 배선

- 파일: `src/components/home/ReleaseNoteStream.tsx`, `src/app/page.tsx`,
  `src/components/home/__tests__/render.test.tsx`
- 변경: `ReleaseNoteStream`에 탭 상태(`useState<"content"|"gap">`) + `NoteNavigator.tsx` 패턴의
  `role="tablist"`/`role="tab"` 탭 UI, `panelSurfaceClass("glass")`를 `<ul>`에서 `<section>`
  래퍼로 이동, 빈 상태를 tab-aware 문구로 교체(early-return 제거 — 탭 바 상시 렌더).
  `page.tsx`는 `headline.noteItemCount`/`headline.unannouncedCount`를 `contentCount`/`gapCount`
  props로 전달(새 집계 없음).
- 기존 테스트 수정: `render.test.tsx:100~135`(라인 엔티티 아이콘) — 기본 탭이 "패치 내용"이라
  unannounced 엔트리가 필터링되므로 Gap 탭 클릭 후 단언하도록 변경. 사유는 테스트 파일 내
  주석으로 명시.
- 신규 테스트 4건: 빈 상태(탭 바 유지)·Gap 탭 빈 상태 문구·기본 탭 필터링(matched만 렌더)·
  배지 숫자가 props 그대로 표시.
- Playwright 실측(1440px, 로컬 dev):
  - 패치 내용 탭: 홀 오브 레전드·바드·카시오페아·에코 등 matched 카드만 렌더, 좌/우 컬럼
    상단(y) 정렬 육안 확인(스크린샷 `/tmp/verify-content-tab.png`)
  - 미공지 Gap 탭 클릭: 니코·조이·파이크·오공(실데이터, |delta| 내림차순) 렌더, 좌측 골드
    레일(`border-l-accent`) 유지 확인(스크린샷 `/tmp/verify-gap-tab.png`)
  - 콘솔 에러 0건
- 미확인 사항: 태블릿/모바일 폭에서 탭 행의 줄바꿈 여부는 육안 확인하지 않음(탭 라벨이 짧고
  Tailwind 기본 flex-wrap 없음 — 폭 393px 기준으로도 두 버튼 합쳐 200px 미만이라 저위험 판단,
  스크린샷 별도 촬영 안 함).

## 공통 검증

- `bash verify.sh --full` 전체 통과(Spec/tsc/ESLint/vitest/build/design-lint) — arbitrary-value
  경고 2건은 기존부터 있던 것(ItemChart.tsx·DiscordEmbedPreview.tsx), 이번 변경과 무관.
- 인트로 새로고침 재생: Playwright로 동일 페이지 연속 2회 새로고침(F5 시뮬레이션) 모두
  mount→재생→종료(약 1.7초) 확인 — `patchgap:ambient-intro-seen` localStorage 게이트가
  더 이상 존재하지 않아 반복 재생됨을 실측 확인.
