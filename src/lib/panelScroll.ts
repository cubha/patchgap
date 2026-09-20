// src/lib/panelScroll.ts
// 패널 본문 스크롤 규약 — **이 숫자의 유일한 소유자**다.
//
// **왜 모듈로 빼는가**(2026-09-20, 사용자 지적). 지적 원문: "섹션높이가 고정이 안 되어 있어
// 항목이 폭발해 전체 스크롤이 폭발한다". 실측이 그대로였다:
//
//   /tft/compare/   91행 · 높이 제한 0건   ← 표 하나가 페이지 전체를 늘린다
//   /pubg/          47행 · 제한 0건
//   /lol/compare/   35행 · 제한 2건        ← 여기만 있었다
//
// 그 2건은 `NoteNavigator`와 `DeltaTable`에 640px 상한이 **각각 하드코딩**된 것이었고,
// 거의 같은 `design-lint-ignore` 주석이 두 벌 달려 있었다. 남은 화면에 그대로 복사하면 사본이
// 다섯이 된다 — 이 저장소가 반복해서 고쳐 온 "술어 복제" 결함군이다
// (`shared/headline.ts`·`shared/reportable.ts`가 같은 이유로 만들어졌다).
//
// **토큰을 새로 만들지 않는 이유**: 토큰 네임스페이스는 CLAUDE.md에 열거된 닫힌 목록이고
// `src/styles/tokens.css`의 `:root`는 카탈로그 verbatim 복사다. 값 하나를 위해 카탈로그·
// DESIGN-TOKENS.md·CLAUDE.md 세 곳을 건드리는 대신, 기존 선례(arbitrary 값 + 같은 줄
// `design-lint-ignore`)를 **한 곳에 모아** 따른다. `verify.sh` Spec 규칙은 줄 단위로
// ignore 주석을 보므로 이 파일의 각 줄이 그 형태를 지킨다.

/**
 * 단독 패널의 본문 스크롤러. 넘치면 페이지가 아니라 **이 안에서** 스크롤한다.
 *
 * 640px은 프로토타입 `.note-item-list{max-height:640px}`에서 온 값이고, 이미 LoL 대조표
 * 두 컴포넌트가 쓰던 수치다 — 새 숫자를 만들지 않고 그것을 정본으로 삼았다.
 */
export const PANEL_SCROLL_BODY = "max-h-[640px] overflow-auto"; // design-lint-ignore: 프로토타입 .note-item-list{max-height:640px}, 대응 토큰 없음

/**
 * 좌우 분할(대조표)의 **행 높이**. 데스크톱에서만 건다.
 *
 * `items-start`를 빼는 것만으로는 부족하다 — 두 열의 내용 높이가 애초에 다르기 때문이다
 * (실측 2026-09-20: 좌 809px = 머리 169 + 640, 우 773px = 머리 93 + 640 + 커버리지 40).
 * 행 높이를 고정하고 각 패널이 그것을 채우게 해야 아래 끝이 맞는다.
 *
 * 뷰포트 연동(`100vh`)을 섞은 이유: 800px 고정만 두면 세로 768px 노트북에서 패널이 화면을
 * 넘어 "고정했는데 페이지가 또 스크롤되는" 원래 증상으로 돌아간다.
 */
export const PANEL_SPLIT_HEIGHT = "lg:h-[min(800px,calc(100vh-14rem))]"; // design-lint-ignore: 뷰포트 연동 높이, 대응 토큰 없음

/** 분할 열의 패널 자체 — 행 높이를 채우고 내부를 세로로 쌓는다. */
export const PANEL_SPLIT_COLUMN = "lg:flex lg:h-full lg:flex-col";

/**
 * 분할 열 안의 스크롤 본문.
 *
 * **`min-h-0`이 load-bearing이다.** flex 자식의 기본 `min-height:auto`는 내용 크기 아래로
 * 줄어들지 않아, 이것이 없으면 `flex-1`을 줘도 스크롤이 생기지 않고 패널이 그냥 늘어난다.
 * 모바일(`lg` 미만)에서는 분할이 아니라 세로 적층이므로 `max-h`로 되돌아간다.
 */
export const PANEL_SPLIT_BODY = `${PANEL_SCROLL_BODY} lg:max-h-none lg:min-h-0 lg:flex-1`;
