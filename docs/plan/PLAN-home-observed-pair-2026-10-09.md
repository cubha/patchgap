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
- LoL도 같은 규칙(`getDefaultPair` = 관측이 있는 최신 쌍). **LoL은 배너를 두지 않는다** — LoL 파이프라인(collect.yml)은 관측 stub을 쓰지 않아(`write-observation-stub` 대상은 tft·pubg뿐) 배너가 설 상태가 없다. parity 행도 tft·pubg만 대상(V2 정정 2026-10-09: 아래 §8 줄의 「LoL·TFT」는 오기였다).
- PUBG는 `deltas.json` 한 파일이라 stub이 관측을 **덮는다** — 같은 결함이 43.2에서 재현된다. stub은 `declaration.json`으로 분리하고 관측 `deltas.json`은 남긴다(ST-9). PUBG는 과거 쌍 라우트가 없으므로 선언만 쌍의 노트는 홈 배너가 **패치노트 원문(노트 파일 `meta.source`)으로 보낸다** — 우리 화면에 그 노트를 그릴 자리가 없는데 "링크 없이 요약만"이면 노트가 사실상 숨는다(V3 정정 2026-10-09: 처음 적은 "링크 없이"는 노트 즉시 최신화 원칙과 어긋났다).
- 결정 7(세는 단위는 대상, 대상 수·값 수 나란히 금지): 선언 히어로 캡션에서 「공지 73건」 제거(타일 부제가 조항 수를 든다).
- 토큰만. §8 동등성: 배너는 공용 컴포넌트, parity 테스트 행 추가(TFT·PUBG 홈 소스가 `NewerPatchNotice`를 참조 — LoL은 위 줄의 이유로 제외).
- 테스트 약화 금지. 기존 `declaration-only.test`(관측 쌍 0)·`history-links.test`(평소 주소 주인) 는 의미를 **홈 쌍**으로 바꿔 유지.

## ③ SubTask
| ID | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-1 | [TDD] | `tftHomePair()`·`loadTft()` 기본 = 홈 쌍·`newerTftDeclarations()`·`latestObservedTftPair().isLatest` = 홈 여부 | `src/lib/tftData.ts`, `src/lib/__tests__/tftLatestPair.test.ts` |
| ST-2 | [TDD] | `homePairOf(game)`·`pastPairsOf` = 홈 제외·`resolvePastPair` 홈 제외·`pairHref(game, pair, home, section)` | `src/lib/pairPages.ts`, `src/lib/pairRoutes.ts`, `src/lib/data.ts`(getDefaultPair), `src/lib/__tests__/pairRoutes*.test.ts`, `src/app/tft/history/[pair]/__tests__/history-links.test.tsx` |
| ST-3 | [TDD] | `observationEta("tft", patch)` → ISO 또는 null + `fmtKstDay` 「10/10(금) 06:00 KST」 | `src/lib/observationEta.ts`, `src/lib/__tests__/observationEta.test.ts` |
| ST-4 | — | `NewerPatchNotice`(공용) · `DeclarationHero` 캡션 교정 + ETA · `ObservationPendingNotice` `eta` prop | `src/components/NewerPatchNotice.tsx`, `src/components/DeclarationOnly.tsx`, `src/components/ObservationPendingNotice.tsx` |
| ST-5 | — | `GameChrome.homePair`·`PatchPairOption.observed` → select 「선언만」·`pairSelectHref` 홈 기준 | `src/app/layout.tsx`, `src/components/Header.tsx` |
| ST-6 | — | TFT 홈에 `newer` 전달, 브리핑 관측 분기에 배너(과거 쌍 페이지는 배너 없음). LoL은 ST-2의 `getDefaultPair` 규칙만(배너 슬롯 없음 — ② 참조) | `src/app/tft/page.tsx`, `src/components/tft/TftBriefing.tsx` |
| ST-7 | [TDD] | 커밋 데이터 실측 테스트: `/tft/`가 관측 쌍(18.3)을 그리고 18.4 배너가 있다; 헤더 옵션 「선언만」; `/tft/history/18_3-18_4/`가 선언 뷰 | `src/app/__tests__/home-observed-pair.test.tsx`, `src/app/__tests__/screen-parity.test.ts` |
| ST-8 | — | UX-BRIEF §8-1 「홈 쌍」 행(§7-1은 주 행동 바인딩이라 건드릴 것이 없다 — V4 정정) | `docs/design/UX-BRIEF.md` |
| ST-9 | [TDD] | PUBG stub → `declaration.json`(관측 `deltas.json` 보존). `deltasStateOf`가 두 파일을 본다. `loadPubgDeclaration`은 declaration.json 우선 | `scripts/write-observation-stub.ts`, `scripts/pubg-determine.ts`, `src/pipeline/shared/observation-stub.ts`, `src/lib/pubgData.ts`, `scripts/__tests__/write-observation-stub.test.ts`, `src/components/pubg/PubgBriefing.tsx`(배너) |

## ④ 라우팅
전량 `[S]`(의존 체인). 전제: git ✅ / verify.sh ✅(--ts-only 지원) / gbc 미설치.

## ⑤ UI 설계 명세
Ground Truth: `docs/design/UX-BRIEF.md` §8-1(히어로 = 문장 1줄 + 캡션 + 3타일) · 시안 `01-briefing-home.html`. 배너는 `ObservationPendingNotice`와 같은 모양(`rounded-md border border-border-soft bg-surface px-4 py-3 text-sm text-muted`, 링크는 `font-bold text-accent`)으로 히어로 캡션 바로 아래 — 새 블록 유형이 아니라 기존 안내 문단의 재사용이라 `/frontend-design` 생략. 주 행동(§7-1 디스코드)은 그대로.

## ⑥ Phase 3 기록 (2026-10-09)
- 게이트: `verify.sh --full` ✅ ×2(FIX 전·후) · scope-critic ×4(1라운드 병렬, 묶음 ST-1·2 / ST-3·4 / ST-5~8 / ST-9) · acceptance-critic ×2(1회차 + 델타) · TDD RED 선커밋 2건(1a61d03·ffb87d2) · UI 게이트 `--ui`(probe /tft/·/tft/history/18_3-18_4/·/pubg/ × 1280·375 + design-lint `--gate --gate-layout --gate-ux --dispositions`) **PASS — error 0, warn 15 = D-LAYOUT-04 ×6 · D-A11Y-02 ×6 · D-SPACE-03 ×3(세 라우트 × 2뷰포트에 같은 수로 분포 — 배너가 없는 /pubg/에도 동일하므로 이번 변경 블록이 아니라 기존 warn)**.
- scope-critic ST-3·4 `DECISION_CHANGED: yes` → 3건 반영: ① `NewerPatchNotice`에 `reason` 게이트(대기일 때만 날짜, 그 외 「지금 멈춰 있습니다」) ② `etaOf`가 지난 예정 시각이면 null ③ 웹/스크립트 캘린더 합성 deep-equal 테스트. 2건 무시(사유): 요일 계산 지적은 실제 10/10이 토요일이라 오판 · 「공지 N건」 캡션 단언은 어느 테스트에도 없음(통과로 반증).
- scope-critic ST-9 `DECISION_CHANGED: yes` → 무시(사유): 「declaration 모드 매일 재실행·커밋 노이즈」는 `planPubgRun`이 `deltas.kind==="none"`일 때만 선언 모드라 성립하지 않는다(patch-calendar.ts:217-226, pubg-determine이 declaration.json을 읽어 kind=stub). run-notify는 선언 모드에서 실행되지 않는다(collect-pubg.yml:231).
- acceptance-critic 1회차 UNMET 4·UNKNOWN 4 → 델타 2회차 **전건 ✅**(UNMET 0). V1은 위 ① 수정, V2·V3·V4는 **기준선 정정**(② LoL 배너 없음·PUBG 원문 링크·§7-1 각주 삭제 — 처음 PLAN이 스스로 모순이었다), V5는 선언 뷰 링크 검사 추가(history-links.test).
- 테스트 변경 보고(스펙 변경): tftLatestPair.test 2곳(isLatest = 홈 여부), pair-routes.test(`pairHref` 3번째 인자 목록→홈), history-links.test(과거 쌍 = 홈 제외, 링크 검사는 관측 쌍만 + 선언만 쌍 별도 케이스), static-params.test·header-pair-select.test(fixture `homePair`), write-observation-stub.test(PUBG: deltas.json 보존·declaration.json). 약화 0 — 전부 ②의 홈 쌍 재정의.
- 실측(빌드 캡처): `/tft/` 1280 = 18.2→18.3 분석 + 배너 「18.4 패치노트가 반영됐습니다(52개 항목). 관측·판정은 10/10(토) 06:00 KST부터 시작합니다. 18.4 패치노트 보기 →」 · select 「18.3 → 18.4 · 선언만」 · `/tft/history/18_3-18_4/` 캡션 「18.3 → 18.4 · 관측 전」 + 「첫 관측은 10/10(토) 06:00 KST 예정」. 375도 동일, 하단 CTA 유지.
- 범위 밖 잔여: 선언 뷰 자체의 시각(타일 「—」·Gap 탭·평문 노트)은 손대지 않았다 — 이제 홈이 아니라 select/배너로만 닿는 화면이다.
