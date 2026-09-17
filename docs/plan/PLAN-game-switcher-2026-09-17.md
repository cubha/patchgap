# PLAN — 게임 스위처 통합 (LoL ⇄ PUBG 동일 사이트)

- 작성: 2026-09-17 · 브랜치 `feature/silver_sh`
- 성격: **신규 설계가 아니라 유보 해제**. 아래 §2가 근거다.

---

## 1. 사용자 요구사항 (원문)

> 너 지금 구현해놓은게 말이안되는데, lol이랑 배틀그라운드랑 동일한사이트야. pubg 메뉴가
> 신설되는게아니라, 모든메뉴는 동일하되 드롭다운으로 리그오브레전드, 배틀그라운드
> 선택해서 내부 데이터랑 테마만 변경되는거야. 이해햇어?
> 지금배틀그라운드 시안도 반영이 전혀안되어잇는데;;

> 그리고 분명히 내가 얘기햇는데 모바일에서 보는데 bg이미지가 또위에 다잘려잇네

요구는 셋이다:

- **R1.** PUBG는 **4번째 메뉴가 아니다**. 내비는 브리핑·대조표·방법론 3개 그대로 두고,
  **게임 드롭다운**(리그 오브 레전드 / 배틀그라운드)으로 전환한다.
- **R2.** 전환 시 바뀌는 것은 **내부 데이터 + 테마**뿐이다. PUBG 시안
  (`HANDOFF-redesign-2026-09-10.md` §3 `[data-game="pubg"]` 램프)을 실제로 연결한다.
- **R3.** 모바일에서 앰비언트 배경 이미지 상단이 잘린다(재발 3회차). 실측으로 원인을
  특정하고 고친다.

## 2. 이 작업이 "유보 해제"인 근거 (새 결정이 아님)

`HANDOFF-redesign-2026-09-10.md` §3이 **이미 이 구조를 설계해 놨다**:

- `[data-game="pubg"]` 속성 하나로 중립 8종 + 워시 2종만 스왑
- "저장하지 않는다(사용자 결정). 진입 시 항상 LoL. 다른 게임은 **선택으로만 전환**"
- "컴포넌트는 이미 전부 토큰 참조라 **컴포넌트 코드 수정 없이** 램프 추가만으로 전환된다"

그런데 `PLAN-pubg-gate-2026-09-16.md` §9-5가 "게임 스위처 통합 · `[data-game="pubg"]`
램프 연결"을 **범위 밖으로 유보**했고, 그 결과 9/16 구현이 `/pubg/`를 4번째 네비로 붙였다.
사용자 지적은 그 유보를 해제하라는 것이다. 설계문서가 사용자 편이다.

## 3. 제외 합의 (요청했지만 하지 않는 것)

- **X1. `/lol/` 접두 신설 안 함.** LoL은 현재 URL(`/`·`/compare/`·`/methodology/`)을
  그대로 유지한다. 접두를 새로 만들면 배포 URL·UptimeRobot 감시 대상·기존 공유 링크가
  전부 깨진다. PUBG만 `/pubg/*` 접두를 쓴다.
- **X2. PUBG 무기 상세 페이지(`/pubg/item/*`) 안 만듦.** 내비는 3개이고 `/item/[id]`는
  메뉴가 아니라 링크로 도달하는 상세 라우트다 — 패리티 요건이 아니다. 게다가 PUBG는
  패치가 2개(42.3·43.1)뿐이라 시계열 차트의 점이 2개다(LoL은 3패치).
- **X3. `CompareExplorer` 제네릭화 안 함.** LoL 테스트 2종(`logic.test.ts`·
  `render.test.tsx`)이 `DeltaRecord`에 걸려 있다. 원자 컴포넌트(`StatusBadge`·
  `SectionCard`·`DeltaValue`)만 재사용하고 PUBG 표는 따로 쓴다.
- **X4. 상태 4색(`--accent --danger --warn --success`) 재정의 안 함.** HANDOFF §1-2
  불변식 — 판정 색은 게임이 바뀌어도 불변이다.
- **X5. localStorage에 게임 저장 안 함.** HANDOFF §3 사용자 결정. 진입 시 항상 LoL.
- **X6. `DeltaEntityType` 확장 안 함.** PUBG는 `pubg-delta.ts` 자체 네임스페이스 유지
  (LoL 화면 데이터 오염 금지 — `PLAN-pubg-gate` R7).

## 4. 구현 결정 (Ground Truth 확인 결과)

### 4-1. 게임 상태는 URL에 둔다

`next.config.ts`가 `output:'export'`(정적)이라 런타임 리다이렉트가 없고, 양 게임 데이터를
동시에 번들해 클라이언트에서 토글하는 방식은 "서버 컴포넌트 우선"(프로젝트 CLAUDE.md)과
충돌한다. 따라서 게임 = 경로 접두이고, 드롭다운은 `<select>` + 라우터 이동이다.

`gameHref(game, pathname)`를 **순수 함수로 분리하고 단위테스트를 붙인다** — `/item/*`에서
PUBG로 전환하면 존재하지 않는 `/pubg/item/*`가 아니라 `/pubg/`로 떨어져야 한다.

### 4-2. `data-game`은 `:root:has()`로 끌어올린다

Next 16에서 `<html>`에 라우트별 속성을 주려면 route group 다중 root layout이 필요하고
(`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:407` 확인),
그러려면 최상위 `layout.tsx`를 지우고 `<html>`/`<body>`를 그룹마다 복제해야 한다 —
공용 Header까지 갈라져 비용이 크다.

대신 클라이언트 래퍼(`GameRoot`)가 `usePathname()`으로 `<div data-game="pubg">`를 렌더하고
(정적 프리렌더 HTML에 속성이 박히므로 **FOUC 없음** — 기존 Header의 `usePathname` 활성탭
강조가 이미 같은 방식으로 동작한다), tokens.css가

```css
:root:has([data-game="pubg"]) { --bg: …; … }
```

로 변수를 **루트까지 끌어올린다**. 이렇게 하면 `body`의 `bg-bg`·오버스크롤 영역까지 전부
PUBG 값을 쓴다(래퍼 div에만 걸면 body는 LoL 배경이라 iOS 바운스에서 색이 어긋난다).

특정도는 `:root:has([data-game])` = (0,2,0)으로 `[data-palette="v4"]`(0,1,0)를 이긴다 —
HANDOFF §3이 말한 "같은 특정도 + 소스 순서"보다 강하지만 승패 결과는 동일하고, 소스 순서
의존이 없어져 더 안전하다.

### 4-3. 램프·배경의 Ground Truth는 승인 시안 아티팩트다 (2026-09-17 정정)

🔴 **최초 구현이 여기서 틀렸다.** HANDOFF §3만 보고 그 절의 램프를 넣었는데, 그 값은
2026-09-10 **에란겔 항공뷰 1차안** 시절 것이고 사용자가 이미 반려한 방향이다. 실제 기준은
사용자가 승인한 아티팩트 **「PUBG 테마 시안」 2차 개정(2026-09-15)** —
https://claude.ai/artifact/CXqUtUXTXyfmDHH8gnUMys

그 시안이 확정한 것 3가지:

| 항목 | 시안 내용 | 최초 구현 |
|---|---|---|
| **전역 배경** | 공식 대표 키아트(비행기 잔해 앞 생존자 무리, Steam CDN `library_hero.jpg`) — 아티팩트에 `key_art.webp`로 동봉 | ❌ "아트 미연결"로 판단해 배경을 **껐다** |
| **색 램프** | §2 튜닝값 — 그 사진을 14색 양자화해 최빈값 추출 후 대비 보정 | ❌ HANDOFF의 폐기값 사용(9개 토큰 전부 불일치) |
| **인트로** | §3 — 공식 재배포 가능 영상이 없음을 실측 확인(press.krafton 401 · media 이미지뿐 · api-assets 영상 0 · 유튜브 라이선스 불명). 대체로 **키아트 줌인 CSS 애니메이션** `hero-descend`(3.4s, scale 1.55→1.08→1) | ❌ 만들지 않음 |

**교훈**: repo 문서(`docs/design/*`)는 아티팩트 승인 시점에 자동으로 갱신되지 않는다. 시안
승인 이력이 있는 화면을 건드릴 때는 **`Artifact list`로 해당 아티팩트를 먼저 찾는다**.
이번 건은 HANDOFF §3이 "V4 기준으로 재도출할 것"이라고 경고까지 하고 있었는데도, 그 재도출이
이미 아티팩트에서 끝나 있다는 사실을 놓쳤다.

출하값(= 시안 §2 튜닝값 그대로):
`--bg:#0d0a08 --surface:#1a1512 --surface-warm:#2a221c --fg:#ede6df --fg-2:#c7beb4
--muted:#8f8478 --border:#57473b --border-soft:#241d19 --game-glow:#c9a06a`
대비 실측(surface 대비): fg 14.64 · fg-2 9.87 · muted 4.95 → 본문 4.5:1 통과.
`--border`는 2.04로 비텍스트 3.0:1 미달이나 시안이 지정한 무채색 테두리(목적은 border-soft와의
2단 분리이지 정보 전달이 아님)라 승인값을 유지한다.

### 4-4. 🔴 헤더가 PUBG 화면에서 LoL 표본을 주장하는 결함

`Header.tsx`의 `FIXED_SAMPLE = ["KR","Master+","솔로/듀오"]`와 `pairCaption`
(`n=… 매치 · 집계 …`)은 LoL 하드코딩이다. `PAIR_SCOPED_ROUTES`를 `/pubg/*`로 확장하면
**PUBG 화면 헤더가 LoL의 티어·큐·n을 그대로 표시한다**. PUBG 표본은 전지역·전티어·봇포함이고
패치 쌍은 42.3 ⇒ 43.1이다.

이건 Header.tsx 주석이 스스로 경고한 위반("실제 보고 있는 쌍과 다른 숫자를 주장")이자
프로젝트 원칙("모든 판정문은 원천 링크를 가진다") 위반이다. 칩·캡션·패치쌍 옵션을
**게임별로 분기**한다.

### 4-5. 출하 게이트 문구 정정

`hasPubg`는 이제 "네비 링크"가 아니라 **드롭다운 옵션**을 가린다. 그리고 정적 export에선
`/pubg/*` 라우트가 빌드 시 항상 생성되므로 "집계가 없으면 라우트도 생기지 않는다"는
주석·`PLAN-pubg-gate` R2 문구는 **거짓**이다 → "선택 옵션이 생기지 않고, 라우트는 미연결
상태를 정직하게 표시한다"로 정정한다.

### 4-6. 모바일 배경 잘림 — 실측 원인

`island.webp` 종횡비 ≈ 1.776(16:9, `intro-still.jpg` 1080×608 동일 프레이밍).

| | 393px(모바일) | 1440px(데스크톱) |
|---|---|---|
| `.ambient-cam-inner` 폭 `128vw` | 503px | 1843px |
| 이미지 렌더 높이 | **283px** | **1038px** |
| 마스크 세로 반경 `max(38.89vw,380px)` | **380px** | **560px** |
| 크롬(헤더) 높이 | **≈157px**(flex-wrap 2줄) | 57px(1줄) |
| 이미지 중 실제로 보이는 구간 | **55%~100%**(하단부만) | **5%~54%**(상단부) |

즉 모바일에서는 이미지가 작아져(283px) 크롬(157px)이 **상단 55%를 덮고** 남은 하단만
보인다 — 사용자가 본 "위가 다 잘린" 그림이다. 데스크톱은 정반대로 상단만 보인다.

근본 원인은 **이미지 높이는 `vw`에 비례하는데 크롬 높이는 비례하지 않는다**는 단위
불일치다. 6차(vw 환산)·7차(380px 하한)는 마스크만 손댔고 이 불일치는 그대로 남았다.

**처방(2026-09-17 개정)**: 크롬 높이(`--chrome-h`, Header의 ResizeObserver 실측)만큼 아트
레이어를 내리되 **좁은 화면(≤767px)에만 적용**한다(`--art-top`). 9차 최초 구현은 이것을 전
폭에 걸어 데스크톱 배경까지 57px 내려갔고 사용자가 "우물 이미지가 너무 밑으로 내려가있다"고
지적했다 — **결함이 좁은 화면에만 있으므로 처방도 거기에만 건다**는 것이 정정된 원칙이다.

---

## 5. SubTask

| ID | 내용 | 대상 파일 |
|---|---|---|
| **ST-1** | `gameHref`/`GAMES` 순수 함수 + 단위테스트 (**[TDD]**) | `src/lib/game.ts` · `src/lib/__tests__/game.test.ts` |
| **ST-2** | `[data-game="pubg"]` 램프 + `:root:has()` 배선 · 대비 실측 | `src/styles/tokens.css` · `docs/design/DESIGN-TOKENS.md` |
| **ST-3** | `GameRoot` 래퍼 + 헤더 게임 드롭다운 + **표본 칩·캡션 게임별 분기**(§4-4) | `src/components/GameRoot.tsx` · `src/components/Header.tsx` · `src/app/layout.tsx` |
| **ST-4** | `/pubg/compare/` 신설 — 전체 47행 판정표(상태 필터) | `src/app/pubg/compare/page.tsx` |
| **ST-5** | `/pubg/methodology/` 신설 + `/pubg/` 브리핑 재구성(한계·버린축을 방법론으로 이관) | `src/app/pubg/methodology/page.tsx` · `src/app/pubg/page.tsx` |
| **ST-6** | 모바일 배경 프레이밍 — Playwright 실측 → 처방 → 재실측 | `src/styles/ambient.css` |
| **ST-7** | 문서 동반 갱신(§6) | 아래 목록 |

## 6. 동반 갱신할 문서 (코드와 같은 커밋)

안 하면 다음 `acceptance-critic`이 허위 MISSING을 낸다 — 이 프로젝트가 반복해서 다친 지점이다.

- `docs/design/HANDOFF-redesign-2026-09-10.md` §6 "여전히 하지 말 것: 게임 스위처 통합 ·
  `[data-game="pubg"]` 램프 연결" ← 이제 코드와 정면 모순
- `docs/plan/PLAN-pubg-gate-2026-09-16.md` §9-5 동일 항목 + R2 문구(§4-5)
- `docs/design/DESIGN-TOKENS.md` `[data-game]` 계약 주석 "미출하 — 문서화만" → 출하
- `docs/design/UX-BRIEF.md` 헤더 행(29줄)에 게임 드롭다운 추가 · `결과 화면 /pubg/` 서술
- 메모리 `project_hackathon_topic_2026.md`

## 7. 완료 기준

- [ ] 내비는 어느 게임에서도 브리핑·대조표·방법론 **3개**이고 PUBG 탭이 없다
- [ ] 게임 드롭다운으로 `/` ⇄ `/pubg/`, `/compare/` ⇄ `/pubg/compare/`,
      `/methodology/` ⇄ `/pubg/methodology/` 상호 이동
- [ ] `/item/*`에서 게임 전환 시 `/pubg/`로 안전 착지(단위테스트로 고정)
- [ ] PUBG 라우트에서 배경·표면·테두리·텍스트가 PUBG 램프로 바뀐다(상태 4색은 불변)
- [ ] PUBG 라우트 헤더가 LoL 표본(KR·Master+·솔로/듀오·n)을 주장하지 않는다
- [ ] 393px에서 배경 이미지 상단이 크롬에 잘리지 않는다(Playwright 전후 캡처)
- [ ] **데스크톱 배경 프레이밍은 2026-09-16 이전과 동일**하다(이미지 상단 y=0)
- [ ] PUBG 배경이 승인 시안의 공식 키아트이고, 강하 인트로(3.4s CSS)가 재생된다
- [ ] PUBG 램프 9개 토큰이 승인 시안 §2 튜닝값과 **정확히** 일치한다
- [ ] `bash verify.sh --full` PASS
