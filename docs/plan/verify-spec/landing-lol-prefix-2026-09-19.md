# VERIFY-SPEC — 랜딩 신설 + LoL URL 재배치 (2026-09-19)

기준선: `docs/plan/PLAN-landing-lol-prefix-2026-09-19.md`
라우팅: 전량 `[S]` 인라인 · `--tdd --auto`

## ST1 — `game.ts` 경로 해석 단일화 [TDD]

- **구현 결정**
  - `gameFromPathname` 반환형을 `GameId | null`로 바꿨다. 랜딩·구 경로가 `null`이다.
  - `Header.sectionOf`(로컬 함수, `"pubg"` 하드코딩)를 제거하고 `sectionOfPathname`으로 대체.
  - `AmbientBackground`의 `pathname === "/"` / `startsWith("/item/")`를 `isGameHome` /
    `isItemDetailPath`로 대체. 경로 문자열을 파싱하는 곳은 이제 `game.ts` 하나다.
  - `GameDef`에 `tag`(영문 라벨)·`art`(키아트 경로)를 추가했다 — 랜딩 패널이 게임별 표시 자산을
    필요로 하는데, 그것을 랜딩 컴포넌트에 두면 "게임을 모르는 화면"이 성립하지 않는다.
- **RED 확인**: 14건 실패(커밋 `bb83db8`), 전부 구현 누락 사유. import 해상은 정상이었다(5건 통과).
- **미확인 사항**
  - `gameHref`가 랜딩(`/`)에서 호출되는 경로는 현재 없다(랜딩 헤더에 스위처를 안 그린다).
    테스트로만 계약을 고정해 뒀다 — 향후 랜딩에 스위처를 붙이면 그때 실사용이 생긴다.

## ST2 — `itemHref` 접두 [TDD]

- **구현 결정**: 접두를 문자열로 박지 않고 `sectionHref("lol", "item")`에서 가져온다. 디스코드
  embed(`webhook.ts`의 `${siteUrl}${itemHref(id)}`)는 이 함수를 재사용하므로 자동 반영된다.
- **테스트 변경 보고(명세 변경)**: `format.test.ts`의 기대값 `/item/...` → `/lol/item/...`,
  `webhook.test.ts`의 하드코딩 URL 동일. 테스트를 통과시키려는 약화가 아니라 **경로 명세 자체가
  사용자 지시로 바뀐** 경우다.
- **미확인 사항**: 없음.

## ST3 — 라우트 물리 이동

- **구현 결정**: `git mv`로 이력을 보존했다(`src/app/{page,compare,item,methodology}` → `src/app/lol/**`).
  하드코딩 내부 링크 4곳(`item/[id]/page.tsx` 2곳, `DiscordPanel`, `HeroSummary`, `StatsGatePanel`)을
  `/lol/**`로 갱신.
- **미확인 사항**
  - `src/app/lol/**` 아래 페이지들의 주석에는 아직 구 경로(`/`·`/compare/`)를 가리키는 서술이
    남아 있을 수 있다. 동작에는 영향이 없으나 다음 독자를 오도할 수 있다.

## ST4 — `landing.ts` 데이터 층 [TDD]

- **구현 결정**
  - `LANDING_LOADERS: Record<GameId, LandingLoader>` — GAMES에 게임을 추가하고 로더를 안 붙이면
    **타입 에러**다. "게임 수를 단언하지 않는다"를 컴파일러가 강제하는 지점.
  - LoL 수치는 홈 히어로가 쓰는 `computeHeadline`을 **그대로 재사용**했다. 따로 세면 랜딩과
    브리핑이 다른 숫자를 주장하게 된다(채점표 B2 "페이지 간 수치 정합").
  - `landing.ts`가 `@/components/home/logic`을 import한다 — lib이 components를 참조하는 방향이라
    층위상 거꾸로 보이지만, 그 모듈은 React·fs 의존 0의 순수 함수이고 **수치 단일 소스**가 층
    분리보다 우선한다고 판단했다.
  - `분석한 매치`는 수집한 **모든 패치**의 합(LoL 30,000)이다. 현재 쌍만 세면 이미 쌓은 표본을
    작게 말하게 된다.
- **RED 확인**: 스텁(`throw new Error("TODO(landing): …")`)으로 유효 RED를 만든 뒤 구현.
- **미확인 사항**
  - **[해소 — 사용자 결정 2026-09-19]** PUBG의 `announced`는 `notes.length`(패치노트 항목 수),
    LoL은 `noteEntityCount`(엔티티 수)로 세는 단위가 다르다. 사용자 판정: "의미는 동일하다 —
    공지사항은 패치내용이고, 유의한 관측도 미공지도 동일한 의미다." 랜딩 라벨이 답하는 질문은
    게임과 무관하게 같고(무엇이 바뀐다고 했나 / 통계가 뭘 잡았나 / 그중 안 적힌 건 얼마나),
    세는 단위는 랜딩이 답할 필요 없는 내부 사정이라 **그대로 둔다**. 각 카드 숫자는 그 게임의
    브리핑 화면과 정확히 일치하므로 클릭 후 숫자가 달라지는 일은 없다.
  - **남은 사실(수정 아님)**: `significant`는 LoL이 `isSignificantDelta`(유의 전부, 403),
    PUBG가 `isReportable`(효과크기 바닥까지 통과, 7)이라 거르는 단계가 한 칸 다르다. 세 번째
    게임을 붙일 때 이 단계를 맞추는 편이 낫다.

## ST5 — 랜딩 UI

- **구현 결정**
  - 겹친 배경 레이어는 Tailwind 유틸이 아니라 `src/styles/landing.css`로 뺐다 — 유틸로 쓰면
    arbitrary 값 범벅이 되어 토큰 게이트를 우회한다(`ambient.css`와 같은 이유).
  - 암막은 raw rgba가 아니라 `color-mix(in oklab, var(--bg) N%, transparent)`로 토큰에서 파생.
  - 스플래시 월은 **한 장으로 합성**했다(`public/bg/splash-wall.jpg`, 315KB). 합성 스크립트는
    `docs/design/tools/build-splash-wall.py`. 타일 15장을 CSS로 각각 부르면 요청이 그만큼 는다.
  - 자산 원칙: **우리가 실제로 판정하는 게임의 아트만** 쓴다. 다루지 않는 게임의 키아트를 얹으면
    없는 커버리지를 주장하게 되고 표시 목적 사용 범위(README 고지)를 벗어난다.
- **미확인 사항**
  - 모바일(393px) 실측을 아직 안 했다. `grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]`라 1열로
    떨어질 것으로 보이나 패널 `min-height: 24rem`가 세로로 길어질 수 있다.
  - `WHO'S NEXT?` 슬롯은 링크가 아니라 정적 블록이다(갈 곳이 없다). 스크린리더에서 앞의 패널
    링크들과 나란히 읽힐 때 혼선 여지가 있는지 미확인.

## ST6 — 크롬 분기

- **구현 결정**
  - `GameRoot`: `data-game={game ?? "none"}`. 속성을 빼지 않고 `"none"`을 박는 이유는 DOM에서
    "랜딩이라 없음"과 "GameRoot가 안 감쌈"을 구분하기 위해서다. 토큰 계약은 `pubg`만 매칭한다.
  - `AmbientBackground`: `game === null`이면 **아무것도 렌더하지 않는다**. 처음 구현에서는 전역
    앰비언트가 그대로 그려져 랜딩 전체에 협곡 워시의 녹색 캐스트가 씌워졌다(실측 후 수정).
  - `Header`: 랜딩에서 브랜드 + "어떻게 판정하나" 앵커만. 게임 드롭다운·내비·패치쌍·표본 칩·
    스냅샷 캡션은 전부 "어느 게임 안"을 전제하는 컨트롤이라 랜딩에서 그리면 LoL을 임의로 주장한다.
- **미확인 사항**
  - 랜딩 헤더의 `어떻게 판정하나`는 `#how` 프래그먼트다. `link-fragments.test.ts`는 `href=`
    패턴만 수집하므로 이 앵커도 검사 대상에 들어간다 — 통과는 확인했으나 앵커가 랜딩 페이지에
    있고 링크는 Header(공용)에 있어, **다른 게임 화면에서는 이 링크가 존재하지 않는 앵커를
    가리킬 위험**은 구조적으로 없다(랜딩 분기 안에서만 렌더). 그래도 명시해 둔다.

## ST7 — 구 경로 리다이렉트 [TDD]

- **구현 결정**: `vercel.json`에 6줄(각 경로의 슬래시 유무 2형태 × 3경로). `permanent: false`(307)
  — 되돌릴 여지를 남긴다. 계약은 `legacy-redirects.test.ts`가 센다(루트·health.txt를 넘기지
  않는지, 슬러그를 보존하는지, 목적지가 실재 접두인지).
- **미확인 사항**
  - **정적 `out/` 로컬 서빙에서는 리다이렉트가 검증되지 않는다** — Vercel 엣지 기능이라 실배포
    후에만 실측 가능하다. 지금은 설정 파일의 형태만 기계로 고정한 상태다.
  - Vercel의 `trailingSlash: true`가 리다이렉트보다 먼저 적용되는지(즉 `/compare` 요청이
    `/compare/`로 먼저 정규화되는지) 순서를 문서로 확인하지 않았다. 그래서 두 형태를 모두 넣었다.

## ST8 — 산출물 갱신

- **구현 결정**: README 화면 표를 새 경로로 갱신하고 접두 규약·리다이렉트를 한 문단 추가.
  스크린샷은 실배포 후 재촬영이 맞다(로컬 `out/`은 리다이렉트가 없고 도메인도 다르다).
- **미확인 사항**
  - 스크린샷 재촬영 시점 — 배포 전 로컬 `out/` 기준으로 찍을지, ship 후 프로덕션에서 찍을지.
    제출 마감(9/20)과 심사 시작(9/21)을 고려하면 **배포 후 프로덕션**이 맞다고 보나 미확정.
