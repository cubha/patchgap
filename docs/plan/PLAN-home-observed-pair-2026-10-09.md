# PLAN — 홈 쌍 = 관측이 있는 최신 쌍 (TFT 18.3→18.4 선언 뷰 노출 결함)
생성: 2026-10-09 · 소스: 사용자 지적(세션 대화) → `/sh-dev-loop --tdd --auto --ui` 인라인

## ① 사용자 요구사항 (원문)
- "관측전인데 왜 올라가있는건데그럼? 관측전인상태가 저따구로 표현되는데 배포서버에 올라가서 사용자한테 노출되는게 맞아?"
- "내가 말한 사용자한테 최신데이터를 보여줘야 한다는 거는 그냥 **최신 상태의 분석내용**을 보여줘야 된다는 거지" — 9/24 결정 8을 "노트만이라도 즉시 홈에"로 확대 해석한 것은 **내 오독**. 기본 화면은 언제나 완성된 분석(관측이 있는 쌍)이어야 한다.
- 같은 세션 앞선 결정: 상세 「방송 규칙 보기 →」 제거(PR #81 완료, 이 PLAN 범위 밖).

## ② 확정 제약
- **홈 쌍(평소 주소 `/tft/`·`/tft/compare/`·상세·방법론 기준 쌍) = 관측 번들이 실재하는 가장 최근 쌍.** 그보다 새 stub 쌍은 「선언만」 쌍이다.
- 선언만 쌍은 숨기지 않는다(패치노트 즉시 최신화는 유지): ① 홈 히어로 아래 **배너** 「{to} 패치노트 {n}건 반영 · 관측은 {eta}부터 · {to} 패치노트 보기 →」 ② 헤더 패치 select에 `18.3 → 18.4 · 선언만` ③ 그 쌍의 선언 뷰는 `/tft/history/{slug}/`(기존 선언 뷰 그대로, 어휘·ETA만 보강).
- ETA는 캘린더 창 시작 + 관측 N일차(`observationDayOf`) 이후 첫 cron(TFT 21:00 UTC)으로 계산한다. 계산 불가(창 없음)면 날짜 없이 「관측 대기」.
- `pairHref` 계열의 「평소 주소」 판정은 `pairs[0]`이 아니라 **홈 쌍**이다(목록 순서는 최신순 유지 — select엔 18.4가 맨 위).
- 관측 쌍이 하나도 없으면 지금처럼 최신 stub의 선언 뷰가 홈이다(빈 화면보다 낫다 — `declaration-only.test`의 전제).
- LoL도 같은 규칙(`getDefaultPair` = 관측이 있는 최신 쌍). LoL은 stub 노트 로더가 없어 배너는 두지 않는다(stub이 실재하면 select 「선언만」만).
- PUBG는 `deltas.json` 한 파일이라 stub이 관측을 **덮는다** — 같은 결함이 43.2에서 재현된다. stub은 `declaration.json`으로 분리하고 관측 `deltas.json`은 남긴다(ST-9). PUBG는 과거 쌍 라우트가 없으므로 선언만 쌍의 노트는 홈 배너가 링크 없이 요약만 말한다(원문 링크는 노트 자체가 가진다).
- 결정 7(세는 단위는 대상, 대상 수·값 수 나란히 금지): 선언 히어로 캡션에서 「공지 73건」 제거(타일 부제가 조항 수를 든다).
- 토큰만. §8 동등성: 배너는 공용 컴포넌트, parity 테스트 행 추가(LoL·TFT 홈 소스가 `NewerPatchNotice`를 참조 — PUBG는 ST-9로 같은 컴포넌트).
- 테스트 약화 금지. 기존 `declaration-only.test`(관측 쌍 0)·`history-links.test`(평소 주소 주인) 는 의미를 **홈 쌍**으로 바꿔 유지.

## ③ SubTask
| ID | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-1 | [TDD] | `tftHomePair()`·`loadTft()` 기본 = 홈 쌍·`newerTftDeclarations()`·`latestObservedTftPair().isLatest` = 홈 여부 | `src/lib/tftData.ts`, `src/lib/__tests__/tftLatestPair.test.ts` |
| ST-2 | [TDD] | `homePairOf(game)`·`pastPairsOf` = 홈 제외·`resolvePastPair` 홈 제외·`pairHref(game, pair, home, section)` | `src/lib/pairPages.ts`, `src/lib/pairRoutes.ts`, `src/lib/data.ts`(getDefaultPair), `src/lib/__tests__/pairRoutes*.test.ts`, `src/app/tft/history/[pair]/__tests__/history-links.test.tsx` |
| ST-3 | [TDD] | `observationEta("tft", patch)` → ISO 또는 null + `fmtKstDay` 「10/10(금) 06:00 KST」 | `src/lib/observationEta.ts`, `src/lib/__tests__/observationEta.test.ts` |
| ST-4 | — | `NewerPatchNotice`(공용) · `DeclarationHero` 캡션 교정 + ETA · `ObservationPendingNotice` `eta` prop | `src/components/NewerPatchNotice.tsx`, `src/components/DeclarationOnly.tsx`, `src/components/ObservationPendingNotice.tsx` |
| ST-5 | — | `GameChrome.homePair`·`PatchPairOption.observed` → select 「선언만」·`pairSelectHref` 홈 기준 | `src/app/layout.tsx`, `src/components/Header.tsx` |
| ST-6 | — | TFT 홈·과거 쌍 페이지에 `newer` 전달, 브리핑 관측 분기에 배너. LoL 홈 규칙 적용 | `src/app/tft/page.tsx`, `src/components/tft/TftBriefing.tsx`, `src/components/home/LolBriefing.tsx`(배너 슬롯) |
| ST-7 | [TDD] | 커밋 데이터 실측 테스트: `/tft/`가 관측 쌍(18.3)을 그리고 18.4 배너가 있다; 헤더 옵션 「선언만」; `/tft/history/18_3-18_4/`가 선언 뷰 | `src/app/__tests__/home-observed-pair.test.tsx`, `src/app/__tests__/screen-parity.test.ts` |
| ST-8 | — | UX-BRIEF §8-1 「홈 쌍」 행 + §7-1 각주 | `docs/design/UX-BRIEF.md` |
| ST-9 | [TDD] | PUBG stub → `declaration.json`(관측 `deltas.json` 보존). `deltasStateOf`가 두 파일을 본다. `loadPubgDeclaration`은 declaration.json 우선 | `scripts/write-observation-stub.ts`, `scripts/pubg-determine.ts`, `src/pipeline/shared/observation-stub.ts`, `src/lib/pubgData.ts`, `scripts/__tests__/write-observation-stub.test.ts`, `src/components/pubg/PubgBriefing.tsx`(배너) |

## ④ 라우팅
전량 `[S]`(의존 체인). 전제: git ✅ / verify.sh ✅(--ts-only 지원) / gbc 미설치.

## ⑤ UI 설계 명세
Ground Truth: `docs/design/UX-BRIEF.md` §8-1(히어로 = 문장 1줄 + 캡션 + 3타일) · 시안 `01-briefing-home.html`. 배너는 `ObservationPendingNotice`와 같은 모양(`rounded-md border border-border-soft bg-surface px-4 py-3 text-sm text-muted`, 링크는 `font-bold text-accent`)으로 히어로 캡션 바로 아래 — 새 블록 유형이 아니라 기존 안내 문단의 재사용이라 `/frontend-design` 생략. 주 행동(§7-1 디스코드)은 그대로.

## ⑥ Phase 3 기록
(구현 후 기입)
