# PLAN — 사이트 리뷰 트랙 B(sync·오타·이전 잔재) 전건 (2026-10-11, `/sh-dev-loop --tdd --auto`)

> 기준선: `docs/plan/PLAN-site-review-remediation-2026-10-08.md` 트랙 B(B1~B6, 68행) · 검증명세 원문 `docs/review/SITE-REVIEW-patchgap.vercel.app-20261008.md`.
> 리뷰 이후 머지: 트랙 A #80 · #81(상세 「방송 규칙 보기」 제거) · #82(홈 쌍 = 관측 최신 쌍) · #83. 현재 쌍: LoL 26.19→26.20 · TFT 18.3→18.4 · PUBG 42.3→43.1 — 리뷰의 특정 쌍·숫자는 현재 등가 화면으로 재해석한다.

## ① 사용자 요구사항 원문
- "트랙b전건 이월, 보류없이  /sh-dev-loop --tdd --auto 진행"
- 결정 질의 답(2026-10-11):
  - 내부 스크롤(lol-S13·pubg-S12) → **「패널 유지 + 더 보기」** — 패널 높이 제한 유지, 잘림 표시와 명시적 바로가기, PUBG 무기 격자 `h-80` 사본은 공용 상수로
  - 상세 폭(parity-S22) → **「셋 다 좁게」** — 9/12 LoL 폭(narrow) 기준으로 TFT·PUBG 상세를 맞춘다
  - 「유의한 관측 없음」 묶음(parity-S10) → **「현 상태 유지, 사유 기록」**
  - 노트 종류 탭 어휘(parity-S17) → **「시스템」**

## ② 확정 제약
- 기술 스택 고정 · 신규 의존성 0 · 판정 엔진(`MatchStatus`) 무변경 · 런타임 외부 호출 0.
- #78(대조표 숨김 상태 건수·사유 비노출) · 「세는 단위는 대상」 · 홈 = 관측 최신 쌍 · #81(대안 버튼 만들지 않음) · 「발견 먼저」 탭 순서 뒤집기 재제안 금지(두 번 기각) · UX-BRIEF §7-1 브리핑 주 행동 = 「디스코드 방 들어가기 →」(10/8 바인딩 하향 기각) 유지.
- 테스트 수정은 명세 변경일 때만, ⑥에 기록한다.

## ③ 이미 닫힌 행 (재작업 없음)
| ID | 근거 |
|---|---|
| lol-S12 · pubg-S9 | #81 — 상세 4종 채움 버튼 0개(사용자 결정: 대안 버튼 없음) |
| lol-S29 | 트랙 A ST-26 `not-found.tsx`(한국어 + 홈·세 브리핑 링크). title만 ST-1에서 고유화 |
| pubg-S26 | 현 빌드 맵 상세 콘솔 경고 0(preload는 실제 쓰는 맵 이미지 1개) |
| parity-S33 | #80 — 선언 뷰 푸터가 Container 밖. 가드 정규식만 래퍼 푸터까지 넓힌다(ST-27) |
| parity-S10 | **사용자 결정 기각** — 세 게임 모두 `AnnouncedCoverageLine`이 「공지된 대상 N개 중 M개」로 같은 사실을 말한다(9/23 V5). 묶음 신설은 #78·A6 재제안 금지와 충돌 |

## ④ SubTask (전량 `[S]`, 번호 순)
| ST | 태그 | 닫는 ID | 내용 | 주요 파일 |
|---|---|---|---|---|
| ST-1 | [TDD] | lol-S25·S26·S27·S28 · tft-S25·S26·S27 · parity-S30·S31 · pubg-S25 (+lol-S29 title) | `src/lib/meta.ts` `pageMeta({game, screen, pair?, entity?, path})` — title 틀 `{대상|화면} · {게임}[ {from} → {to}]`(루트 template `%s · patchgap`), 게임명은 `gameLabel` 단일 출처, 구분자 「·」 1종, description 라우트별, `openGraph{title,description,url,images}` + `alternates.canonical`(trailing slash). 루트 `metadataBase` + 게임 중립 description. `app/robots.ts`·`app/sitemap.ts`(force-static, 별칭 제외). og PNG 4장 `public/og/{landing,lol,tft,pubg}.png`(1200×630, 토큰 색). LoL 상세 별칭 라우트는 기본 대상 canonical. 404 title 「페이지 없음」 | `src/lib/meta.ts` · `src/app/layout.tsx` · 각 `page.tsx` · `src/app/{robots,sitemap}.ts` · `public/og/*` |
| ST-2 | [TDD] | pubg-S18 | PUBG 슬러그 = 표시 이름(무기 `weaponDisplayName` 기반 소문자 영숫자, 맵 `PUBG_MAPS` 명시 `slug`) + `vercel.json` 비영구 리다이렉트(구 → 신, 슬래시 유무 2형태). 디스코드로 나간 무기 링크 보존 | `src/lib/pubgRoutes.ts` · `src/pipeline/aggregate/pubg-{maps,weapons}.ts` · `vercel.json` |
| ST-3 | [TDD] | tft-S5 · parity-S5 · parity-S6 · lol-S15 (+LoL 대조표 커버리지 「관측 짝 94 > 17」) | 공지 **대상** 수 단일 함수(PUBG `pubgNoteTargets`·TFT 선언/랜딩 통합) → 히어로·타일·NewerPatchNotice·랜딩. 히어로 단위어 「N개 대상」(5곳). PUBG 타일 부제 `· N개 항목`. `computeCoverage` 관측 짝 = 대상 수 | `HeroSummary` · 브리핑 3종 · `DeclarationOnly` · `NewerPatchNotice` · `landing.ts` · `compare/logic.ts` |
| ST-4 | — | pubg-S6 | PUBG 「패치 내용」 탭에 조항 목록(측정 불가 조항 회색 + 사유) — 탭 배지 = 조항 수 = 부제 | `PubgBriefing.tsx` |
| ST-5 | [TDD] | tft-S20 · parity-S17 · parity-S16 · lol-S22 | `noteNav` 섹션 고정 순서(대상 → 아이템 → 시스템 → 기타) · 단일 라벨 맵(「시스템」, 폴백 「기타」) · 열 헤더 「엔티티」→「대상」 · 빈 상태 「델타」→「변화」 | `compare/noteNav.ts` · `compare/logic.ts` · `DeltaTable.tsx` · `TftCompareExplorer.tsx` |
| ST-6 | [TDD] | lol-S4 | 미공지 분포: 「전체」 → 「라인 무관」, 바닥에 「Gap N 중 라인 구분 n · 그 밖 m」(대상 기준) | `laneDistribution.ts` · `LaneGapPanel.tsx` · `LolBriefing.tsx` |
| ST-7 | [TDD] | lol-S14 | 랜딩 카드 매치 수 = 전후 합(세 게임 같은 정의), 히어로 「분석한 매치」 구성 표기 | `src/lib/landing.ts` · `src/app/page.tsx` |
| ST-8 | — | lol-S17 · parity-S32 | 한 화면의 시각 라벨: 표본 집계 시각 = 「표본 집계」, 판정 시각 = 「판정」(세 게임 헤더·푸터·디스코드 패널·LoL 방법론) | `layout.tsx` · `Header.tsx` · `SiteFooter.tsx` · `DiscordPanel.tsx` |
| ST-9 | [TDD] | parity-S21 | 부호 포맷 음수 기호 「−」 1종(`percent.ts` SIGNED_*) | `src/pipeline/shared/percent.ts` |
| ST-10 | — | parity-S25 | Gap 지표 축 제목 상수 1개(세 브리핑) · 렌더 문장 「홈」→「브리핑」 | 브리핑 3종 · `StatusDefinitionTable.tsx` · LoL 방법론 |
| ST-11 | — | parity-S19 · parity-S20 · pubg-S22 | 공용 `CompareNameCell`(이름 → + 유형 줄) 세 대조표 · 아이콘 없는 칸 같은 폭 자리표시 · TFT 노트 내비 아이콘(`game` prop) | `compare/*` · `TftCompareExplorer` · `PubgCompareExplorer` · `NoteNavPanel` |
| ST-12 | [TDD] | lol-S30 · pubg-S23 · parity-S26 · parity-S27 · lol-S19 · pubg-S14 · parity-S12 · lol-S18(문구) | 「탭로」 → 순수 문구 함수 · LoL 방법론 존댓말 · PUBG 방법론 파일명·필드명 → 사용자 말 · 픽률/승률 분모 · PUBG 「무기 상세는 판정이 선 무기만」 정정 · 대조표·방법론 「왼쪽/오른쪽」 방향어 제거(세 게임) | `ObservationSection.tsx` · `StatusDefinitionTable.tsx` · 방법론 3종 · compare 리드 3종 |
| ST-13 | — | parity-S9 | LoL 접힌 행에 유형 라벨 + 패치 내용 탭 머리 「공지된 변경은 실제로 그렇게 됐나」(공용 상수) | `ReleaseNoteRow.tsx` · `ReleaseNoteStream.tsx` |
| ST-14 | — | parity-S11 · tft-S11 | 세 브리핑 `SubmarineSection hrefOf` 전달(LoL 상세 있는 대상만) · TFT 선언 뷰 수치 행 링크 | `LolBriefing.tsx` · `TftBriefing.tsx` |
| ST-15 | — | parity-S13 | 「패치노트 원문 보기 ↗」 세 브리핑 같은 자리(`AnnouncedCoverageLine` `sourceUrl`) | `AnnouncedCoverageLine.tsx` · 브리핑 3종 |
| ST-16 | — | parity-S18 · parity-S29 | PUBG 대조표·방법론 머리를 LoL·TFT 틀로(eyebrow 제거·`pt-40`·방법론 H1 `{게임} — 어떻게 판정하나`) · PUBG 표본 콜아웃을 표본 슬롯으로 흡수 | `app/pubg/{compare,methodology}/page.tsx` · `pubg/shared.tsx` |
| ST-17 | — | parity-S22 · parity-S23 · pubg-S10 · parity-S24 · pubg-S16 · pubg-S15 · tft-S28 | 상세 폭 narrow 통일 + LoL 대조 카운터·소제목 · PUBG 상세 스플래시 제거 + 패널 막대 앞 문단 ≤1 · PUBG 맵 머리 쌍·「판정 규칙 보기 →」 · 기술통계 탭 배지 없음 · 비교 불가 맵 문구·description · CI 캡션 375 줄바꿈 | 상세 4종 · `ObservationTabs` · `ObservationSection` · `ObservationPanel` · `app/pubg/map/[key]/page.tsx` |
| ST-18 | [TDD] | tft-S15 | TFT 브리핑 목록 `topRows(…,15)` 상한 제거 — 머리 수 = 렌더 그룹 수 | `TftBriefing.tsx` |
| ST-19 | [TDD] | tft-S19 | 수치 축 원복 표시 — 직전 쌍 산출물에 같은 대상·필드의 반대 변경이 있으면 「{패치} 변경 원복」(빌드 타임, 산출물 재생성 없음) | `src/lib/gamedata.ts` · `SubmarineSection.tsx` |
| ST-20 | — | lol-S13 · pubg-S12 | 패널 유지 + 잘림 표시 + 「기타 변경 N건 ↓」 등 명시적 바로가기 · `PubgWeaponGrid` `h-80` → 공용 상수 | `panelScroll.ts` · `ReleaseNoteStream.tsx` · `PubgWeaponGrid.tsx` |
| ST-21 | — | pubg-S19 | 쌍 1개면 select 대신 정적 라벨 | `Header.tsx` |
| ST-22 | [TDD] | lol-S23 · pubg-S8 | 공용 `GapPreview` — Gap 타일 아래 미공지 상위 2~3건(이름 → · 지표 · 변화, 텍스트 링크, 채움 금지). 주 행동 바인딩은 유지(pubg-S8 「채색 강조」 부분은 10/8 결정으로 마감) | `src/lib/headline.ts` · `GapPreview.tsx` · 브리핑 3종 |
| ST-23 | — | lol-S16 | 랜딩 「확장성」 표를 `<details>`로 접기 | `src/app/page.tsx` |
| ST-24 | [TDD] | tft-S10 | 대조표 칩에 「잠수함 패치」·「공지값 불일치」 추가 — 칩 합(전체 제외) = 전체, Gap 타일 착지 정합 게이트 | `toolbarRules.ts` · compare 칩 · `StatTiles.tsx` |
| ST-25 | [TDD] | pubg-S13 | 경계 판정(CI가 효과크기 바닥을 가로지름) 보조 표기 「경계」 — 대조표 행·상세 머리, §8 동등성으로 세 게임 | 판정 표시 공용 · 대조표 3종 · 상세 |
| ST-26 | — | tft-S14 · pubg-S11 | TFT 대조표 판정 열을 마지막 고정 열로(세 대조표 마지막 열 = 판정) · PUBG 모바일 이름 칸 아이콘 숨김 | `TftCompareExplorer.tsx` · `PubgCompareExplorer.tsx` |
| ST-27 | — | parity-S33(가드) · ③ 기록 | screen-parity 푸터 가드 래퍼까지 · 정적 가드 추가(②의 결정들) | `src/app/__tests__/screen-parity.test.ts` |

## ⑤ 라우팅 · UI 설계
- 하드 전제: git ✅ · `verify.sh` ✅(`--ts-only`·`--full`) · gbc 미설치. **전량 `[S]`** — 브리핑 3종·대조표 공용·상세 공용을 여러 ST가 겹쳐 고친다(worktree 병합 충돌 > 병렬 이득).
- Ground Truth 존재 → `/frontend-design` 생략. 전부 기존 화면 수정: `docs/design/UX-BRIEF.md` §8 · `DESIGN-TOKENS.md` · `prototype/{01-home,02-comparison-table,03-item-detail}.html`. 색은 기존 토큰만(경계 표기 `--muted` 테두리, 원복 `--fg-2`).

## ⑥ 명세 변경한 기존 테스트 (구현 중 기록)
- `src/lib/__tests__/pubgRoutes.test.ts` — `mapSlug("Baltic_Main")` "baltic"→"erangel", `mapHref` 기대값(ST-2, pubg-S18 슬러그 = 화면 이름).
- `src/components/compare/__tests__/logic.test.ts` `computeCoverage` — 「관측 짝」이 공지 행 수에서 공지 대상 중 관측이 선 대상 수로(ST-3, 실측 「17대상 중 94」). 픽스처 행에 노트 짝 부여.
- `src/components/home/__tests__/render.test.tsx` — 히어로 「0개 항목」→「0개 대상」(ST-3, tft-S5).
- `src/app/pubg/__tests__/page-order.test.tsx` — 타일 부제 「(43.1 패치노트)」→「(43.1 패치노트 · N개 항목)」(ST-3, parity-S6).
- `src/components/compare/__tests__/render.test.tsx` 2곳 — 빈 상태 「표시할 델타가 없습니다」→「표시할 변화가 없습니다」(ST-5, lol-S22·parity-S16 사용자 어휘).
- `src/components/home/__tests__/render.test.tsx` — 디스코드 패널 「마지막 집계」→「마지막 판정」(ST-8, lol-S17·parity-S32 — 값이 판정 파일 시각).
