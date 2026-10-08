# PLAN — 모바일 고정 하단 CTA(브리핑 3곳)
생성: 2026-10-08 · 소스: /verify-impl 트랙 A Phase 4 사용자 결정 → `/sh-dev-loop --tdd --auto --ui`

## ① 사용자 요구사항 (원문)
- `/verify-impl` 잔여 UI 게이트 error 3건(D-UX-04: LoL·TFT·PUBG 브리핑 375px에서 주 행동 「디스코드 방 들어가기 →」가 첫 화면 아래 y 4146/4792/1348)에 대해 사용자 선택: **「지금 모바일 고정 하단 CTA 구현」**(제시 옵션: "세 게임 브리핑 375에 sticky 하단 바 추가. 트랙 A 범위 밖 신규 UI라 sh-dev-loop로 별도 진행").
- 같이 결정: 미커밋 `docs/design/UX-BRIEF.md`(§7-1 바인딩 표)는 ship 커밋에 **포함**.

## ② 확정 제약
- UX-BRIEF §7-1: 브리핑 3라우트 주 행동 라벨 = 「디스코드 방 들어가기 →」, selector `aside a[href*="discord"]`(사이드 패널은 그대로 둔다), 모바일 첫 화면 열 「권장」.
- design-lint: D-UX-01은 **같은 라벨 반복 = 1**로 세므로 사이드 버튼 + 하단 바의 라벨 중복은 허용. D-UX-04는 라벨이 같은 interactive 요소의 최소 y ≤ 812면 통과. D-UX-03은 fixed/sticky 하단 바의 선택지 수(≤ `uxBottomNavMax`)를 센다 — 선택지 1개. D-A11Y-02 탭 타깃 ≥44px.
- 초대 링크 부재(`DISCORD_INVITE_URL === null`)면 사이드 패널과 **같은 폴백**(「방송 규칙 보기 →」 방법론 링크) — 죽은 링크 금지(DiscordPanel.test 계약). 버튼 한 벌을 두 곳이 공유한다(`DiscordCta`를 DiscordPanel에서 추출).
- `lg` 이상에서는 숨김(사이드바 CTA가 담당). 바가 푸터를 가리지 않게 같은 높이의 인-플로우 여백을 둔다.
- 토큰만(`bg-surface`·`border-border-soft`·`bg-accent`·`text-accent-on`·간격 4/8/12/16). §8 동등성: 세 게임이 같은 컴포넌트, `screen-parity.test.ts`가 요구.
- 관측 전 TFT 선언 뷰(`TftDeclarationView`)도 브리핑이므로 포함. PUBG 관측 전 뷰(`PubgDeclarationView`)는 DiscordPanel을 두지 않으므로 제외(사이드 CTA 자체가 없다 — §7-1 바인딩은 라우트 단위라 게이트는 PUBG 관측 전에도 라벨을 찾겠지만, 그 상태는 지금 데이터에 없고 설계상 패널 부재와 일관).

## ③ SubTask
| ID | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-1 | [TDD] | `DiscordCta`(초대/폴백 버튼 한 벌) 추출 + `MobileActionBar`(fixed 하단, `lg:hidden`, 스페이서, `nav aria-label`) | `src/components/home/DiscordPanel.tsx`, `src/components/home/MobileActionBar.tsx`, `src/components/home/__tests__/MobileActionBar.test.tsx` |
| ST-2 | [TDD] | 세 브리핑(+TFT 선언 뷰)에 배치, `screen-parity.test.ts` §8-1에 「모바일 고정 하단 CTA」 행 추가 | `LolBriefing.tsx`, `TftBriefing.tsx`, `PubgBriefing.tsx`, `src/app/__tests__/screen-parity.test.ts` |
| ST-3 | — | UX-BRIEF §7-1 모바일 첫 화면 열 「권장」 → 「고정 하단 바(MobileActionBar)」 | `docs/design/UX-BRIEF.md` |

## ④ 라우팅
전량 `[S]`(의존 체인, 독립 후보 <4). 전제: git ✅ / verify.sh ✅(--ts-only 지원) / gbc 미설치.

## ⑤ UI 설계 명세
Ground Truth: `docs/design/DESIGN-TOKENS.md` · `docs/design/UX-BRIEF.md` §7·§8-1 · 시안 `01-briefing-home.html`(사이드 `.discord-panel` 버튼과 같은 변형 primary). 하단 바는 시안에 없는 **모바일 전용 상태**(시안은 1280 데스크톱) — 신규 화면이 아니라 기존 화면의 뷰포트 상태라 `/frontend-design` 생략. 레이아웃: `fixed inset-x-0 bottom-0 z-30 border-t border-border-soft bg-surface px-4 py-3`, 버튼 `w-full min-h-11`(44px) primary. 접근성: `<nav aria-label="주 행동">`, 링크 라벨 그대로.
