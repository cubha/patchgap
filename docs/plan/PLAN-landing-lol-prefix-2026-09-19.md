# PLAN — 랜딩 신설 + LoL URL 재배치 (2026-09-19)

> `/sh-dev-loop --tdd --auto` 기준선. Phase 3 `acceptance-critic`이 이 파일만 보고 판정하므로
> 요구사항은 **원문**을 싣는다.

## 1. 사용자 요구사항 (원문)

> 그리고 필요한 스크린샷은 전부 니가 찍어두고, 지금 url이 리그오브레전드는 root로 되어잇는데
> 추후에 다른게임도 추가될수잇어.
>
> 그렇기때문에 랜딩페이지를 신설하고, 랜딩을 루트 --> 시작하기로 들어가면 리그오브레전드로
> 접근되도록 (리그오브레전드도 pubg처럼 url배정)
>
> 우선 랜딩페이지를 현재 리그오브레전드, 배틀그라운드 시안처럼 이미지 기반의 무드테마
> 디자인으로 시안뽑아보고, 요약정보제공 할 수 잇도록해줘. 이때 추후 게임이 추가될수잇으니
> 두가지종류만 단언해서 작성하지는마

후속 지시(원문):

> 다음게임 이렇게 표현하지말고 who is next? to be continue같은 문구잇잖아
>
> 그리고 배경자체도 너무 단색이다 약간 무드잇는? 아니면 게임을 대표할만한 이런저런 이미지들의
> 집합체의 스플레시아트? 약간 그런거잇잖아 이해하니?

> 스플래시아트 원색이 좀더잘보이게

> 시안확정!

**확정 시안** = `docs/design/prototype/05-landing-B.html` (무드 패널형). A안(`05-landing-A.html`)은
미채택이나 파일은 남긴다.

## 2. 확정 제약 (깨면 안 됨)

- 판정 엔진·`MatchStatus`·`EFFECT_SIZE_FLOORS`·`verdict.ts` 판정 규칙·`pubg-delta.ts` `classify()` **무수정**
- 데이터 재생성·LLM 재호출 금지 — `data/aggregated/**`·`data/cache/llm/**` 불변
- `harvest.py`/`telemetry.py` 무수정
- `any` 타입 금지, 미구현 함수는 `throw new Error("TODO(...)")`
- 디자인 토큰 Ground Truth 준수 — 임의 색·간격 추가 금지, 필요하면 `tokens.css`를 먼저 갱신
- `git add -A` 금지 — `mobile-check.png`·`todo-preview.png`는 모든 커밋에서 영구 제외
- `data/raw/*`·`.env`·API 키·웹훅 URL 커밋 금지
- 런타임(브라우저)에서 Riot/Claude API 직접 호출 금지 — 랜딩도 빌드 타임 데이터만 읽는다
- 파괴적 변경·시스템 목표/틀 수정이 불가피하면 **사용자 확인 후** 진행

## 3. 설계 결정 (구현 전 확정)

### 3-1. 경로 체계

| 이전 | 이후 |
|---|---|
| `/` (LoL 브리핑) | `/lol/` |
| `/compare/` | `/lol/compare/` |
| `/item/{slug}/` | `/lol/item/{slug}/` |
| `/methodology/` | `/lol/methodology/` |
| `/pubg/**` | 그대로 |
| `/health.txt` | 그대로(루트 유지 — UptimeRobot 감시 대상) |
| — | `/` = **랜딩 신설** |

### 3-2. "게임에 속하지 않는 경로"라는 새 상태

지금까지 `gameFromPathname`은 **항상** 게임을 돌려줬다(무접두 = LoL). 랜딩이 생기면 그 전제가
깨진다 → 반환형을 `GameId | null`로 바꾸고, 경로 해석을 전부 `src/lib/game.ts` 한 곳으로 모은다.
현재 `AmbientBackground.tsx`(`pathname === "/"`, `startsWith("/item/")`)와 `Header.tsx`(`sectionOf`에
`"pubg"` 하드코딩)가 각자 문자열을 파싱하고 있는데, 이 중복이 이미 한 번 회귀를 냈다
(`game.ts` 주석의 `sectionHref` 사고). 이번에 단일화한다.

### 3-3. 랜딩에서의 크롬·테마

- `GameRoot`: 게임이 `null`이면 `data-game="none"`. 토큰 계약은 `:root:has([data-game="pubg"])`
  하나뿐이라 그 외 값은 전부 기본(브랜드=LoL) 팔레트로 떨어진다 — **안전**.
- `AmbientBackground`: 랜딩에서는 라인 카메라(LAYER 2)·인트로 리빌(LAYER 3)·상세 스플래시
  (LAYER 4)를 전부 끈다. 랜딩은 자기 배경(스플래시 월)을 갖는다.
- `Header`: 랜딩에서는 **최소 변형** — 브랜드만 렌더하고 게임 스위처·내비·패치쌍·표본 칩·스냅샷
  캡션을 내린다(확정 시안 B와 동일). 게임 안에서는 지금 그대로.

### 3-4. 확장성 계약 — "게임 수를 단언하지 않는다"

- **UI 층**: 랜딩 컴포넌트는 게임을 하나도 알지 못한다. `landingCards()`가 돌려준 배열을
  `map`으로 그릴 뿐이고, 문구에 "두 게임"류 숫자 단언을 쓰지 않는다.
- **데이터 층**: 게임마다 집계 산출물 모양이 달라 로더는 게임별로 존재할 수밖에 없다. 이를
  `Record<GameId, LandingLoader>`로 두어 **GAMES에 게임을 추가하면 로더를 안 붙인 순간 타입
  에러**가 나게 한다(조용한 누락 차단).
- 합산 타일은 카드 배열을 reduce한 값이다 — 게임이 늘면 자동으로 포함된다.
- 마지막 슬롯은 `WHO'S NEXT?` (사용자 지정 문구). "다음 게임"이라는 표현은 쓰지 않는다.

### 3-5. 구 링크 보전

`output:'export'`라 런타임 리다이렉트가 없으므로 `vercel.json`에 `redirects`를 넣는다.
심사 기간(9/21~10/5)에 이미 공유된 `/compare/`·`/item/{id}/`·`/methodology/` 링크가 404가 되면
**평가 제외** 사유가 된다. `permanent: false`(307) — 되돌릴 여지를 남긴다.

## 4. SubTask

| # | 내용 | 파일 | TDD | 라우팅 |
|---|---|---|---|---|
| ST1 | `game.ts` 경로 해석 단일화 — lol prefix `/lol`, `gameFromPathname → GameId \| null`, `sectionOfPathname`·`isGameHome`·`isItemDetail` 신설, `GameDef`에 `tag`(영문 이벤트 라벨)·`art`(키아트 경로) 추가 | `src/lib/game.ts` · `src/lib/__tests__/game.test.ts` | ✅ | [S] |
| ST2 | `itemHref` → `/lol/item/...`. 디스코드 embed는 `itemHref`를 재사용하므로 자동 반영 | `src/lib/format.ts` · `src/lib/__tests__/format.test.ts` · `src/pipeline/discord/__tests__/webhook.test.ts` | ✅ | [S] |
| ST3 | 라우트 물리 이동 — `src/app/{page,compare,item,methodology}` → `src/app/lol/**`. 하드코딩 내부 링크 4곳 갱신 | `src/app/lol/**` · `src/components/home/HeroSummary.tsx` · `src/components/home/DiscordPanel.tsx` · `src/components/item/StatsGatePanel.tsx` · `src/components/methodology/AdapterMatrix.tsx` | — | [S] |
| ST4 | 랜딩 데이터 층 — `landingCards()`/`landingTotals()`, 게임별 로더 레지스트리 | `src/lib/landing.ts` · `src/lib/__tests__/landing.test.ts` | ✅ | [S] |
| ST5 | 랜딩 UI — 시안 B 구현(스플래시 월·합산 타일·게임 패널·`WHO'S NEXT?`·수집/판정/근거 3열) | `src/app/page.tsx` · `src/components/landing/*` | — | [S] |
| ST6 | 크롬 분기 — `GameRoot`(`data-game="none"`), `AmbientBackground`(랜딩에서 레이어 2·3·4 off), `Header` 최소 변형 | `src/components/{GameRoot,AmbientBackground,Header}.tsx` | — | [S] |
| ST7 | 구 경로 리다이렉트 + 계약 테스트 | `vercel.json` · `src/app/__tests__/legacy-redirects.test.ts` | ✅ | [S] |
| ST8 | 산출물 갱신 — 스크린샷 5장 재촬영, README 화면 표 URL 갱신 | `docs/submission/screenshots/*` · `README.md` | — | [S] |

**라우팅 판정**: 전량 `[S]`. ST1이 ST3·ST6의 입력이고 ST4가 ST5의 입력이라 독립 후보가
4개 미만이다(impl-handoff §5 임계값).

## 5. 완료 조건

- `bash verify.sh --full` 전 게이트 통과
- 전 라우트가 새 구조로 빌드된다 — `out/lol/index.html`·`out/index.html`·`out/lol/item/**` 존재
- 랜딩이 `GAMES`를 순회해 렌더되고, 문구에 게임 수 단언이 없다
- `vercel.json`이 구 3경로를 `/lol/**`로 넘긴다
- 스크린샷 5장이 새 URL 기준으로 갱신된다

## 6. UI 설계 명세 경로

- 확정 시안: `docs/design/prototype/05-landing-B.html`
- 토큰 Ground Truth: `docs/design/DESIGN-TOKENS.md` · `src/styles/tokens.css`
- 배경 자산: `public/bg/splash-wall.jpg`(이번에 생성, 1920×900) — 합성 스크립트는 ST8에서 레포에 보존
