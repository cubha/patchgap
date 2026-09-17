# VERIFY-SPEC — 게임 스위처 통합 (2026-09-17)

기준선: `docs/plan/PLAN-game-switcher-2026-09-17.md`

## 구현 결정

- **게임 = 경로 접두**(`/` = LoL, `/pubg/*` = PUBG). 클라이언트 토글이 아니라 라우팅이다 —
  `output:'export'`이고 서버 컴포넌트 우선 원칙이 있기 때문. 전환 경로 계산은 `src/lib/game.ts`
  순수 함수가 소유하고 단위테스트 9개가 고정한다(특히 `/item/*` → `/pubg/` 안전 착지).
- **`data-game`은 `GameRoot`(display:contents 래퍼)가 달고 `:root:has()`가 루트로 끌어올린다.**
  다중 root layout(route group)을 쓰지 않은 이유는 `<html>`/`<body>`와 공용 Header가 복제되기
  때문. 정적 프리렌더 HTML에 속성이 박히므로 FOUC 없음 — `out/pubg/index.html`에
  `data-game="pubg"`, `out/index.html`에 `data-game="lol"`이 실제로 들어간 것을 확인했다.
- 🔴 **위 서술은 2026-09-17 중 폐기됐다(정정)**. ~~PUBG 램프는 HANDOFF 문서값을 V4 기준으로
  재도출했다(`--border` `#3a2f20`→`#8f6a22`)~~ → 실제 Ground Truth는 승인 아티팩트
  「PUBG 테마 시안」 2차 개정(2026-09-15) §2 **튜닝값 열**이고, 출하값은
  `--bg:#0d0a08 --surface:#1a1512 --surface-warm:#2a221c --fg:#ede6df --fg-2:#c7beb4
  --muted:#8f8478 --border:#57473b --border-soft:#241d19 --game-glow:#c9a06a`다.
  근거·경위는 `PLAN-game-switcher-2026-09-17.md` §4-3.
- 🔴 **위 서술도 폐기됐다(정정)**. ~~PUBG 아트는 연결하지 않는다~~ → 승인 시안이 공식 대표
  키아트를 **전역 배경으로 확정**했고 아티팩트에 자산(`key_art.webp`)까지 동봉돼 있었다.
  구현은 `AmbientBackground.tsx`가 게임별로 **다른 레이어 스택**을 렌더한다 — LoL은 협곡
  3레이어, PUBG는 `.ambient-pubg-art` 한 장 + 강하 인트로(`@keyframes pubg-descend`, 3.4s).
  자산 라이선스는 마케팅 자산(content_creation_guideline) 적용, 문의 2026-09-16 발송.
- **헤더 표본 칩·패치쌍·n 캡션을 게임 소유로 옮겼다**(`GameChrome`). 안 옮기면 PUBG 화면이
  LoL의 `KR·Master+·솔로/듀오`와 LoL n을 주장한다.
- **`/pubg/` 한 장을 3라우트로 분할**: 브리핑(판정된 것) · 대조표(전체 47행) · 방법론(판정 규칙 +
  관측 축 없는 항목 + 버린 축 §8 반증표).
- **`CompareExplorer`를 제네릭화하지 않고 `PubgCompareTable`을 새로 썼다** — PUBG 행에는 q·causes·
  라인이 없고, 제네릭화하면 LoL 테스트 2종이 흔들린다. q 열은 **만들지 않았다**(없는 값을 빈칸으로
  채우면 무근거 회색 원칙 위반).
- **모바일 배경(9차 + 개정)**: 마스크 원점과 이미지 상단을 `var(--art-top)`으로 내린다. 값은
  Header의 ResizeObserver가 실측한 `--chrome-h`인데 **≤767px에서만** 적용된다 — 최초 구현이
  전 폭에 걸어 데스크톱 배경이 57px 내려갔고 사용자가 지적했다(결함이 좁은 화면에만 있으므로
  처방도 거기에만 건다).
- **인트로 재생 제어**(사용자 지적 "아직도 애니메이션은 안되는데? LOL, 배틀그라운드 둘다"):
  ① 자동 재생만 `prefers-reduced-motion`을 존중하고 재생 버튼은 통과 ② `globals.css`의 전역
  리셋(`animation-duration:.01ms !important`)이 강하 애니메이션을 즉시 끝내 클래스가 붙자마자
  벗겨지던 것을 `.ambient-pubg-art.is-descending` 한 선택자만 예외로 복구 ③ 브리핑 라우트를
  벗어나면 리셋해 재진입이 새 재생이 되게 함 ④ 재생 시작을 effect로 옮김(서버 렌더에는
  `window`가 없어 렌더 중 `reducedMotion`을 쓰면 정지 상태여야 할 HTML에 재생 클래스가 박힌다).
  **재생 버튼은 LoL에도 같이 붙였다** — 승인 시안에는 PUBG에만 있었으나 사용자가 "둘 다"를
  지적했고, 같은 자리 같은 어포던스가 게임 스위처의 전제와 맞는다.

## 미확인 사항

- **`/pubg/methodology/` 스냅샷 캡션** — 2026-09-17 축A가 잡은 잔여 결함(칩·n·패치쌍만 게임별로
  분기하고 이 캡션은 LoL 전용 계산이 남아 있었다). `GameChrome.snapshotCaption`으로 이전 완료.
- **`:root:has()` 브라우저 지원** — Baseline(Chrome 105+/Safari 15.4+/Firefox 121+)이라 실사용에는
  문제없지만, 미지원 브라우저에서는 PUBG 화면이 **LoL 색으로 렌더**된다(레이아웃·데이터는 정상).
  조용한 실패라 발견이 어렵다.
- **게임 드롭다운 추가로 모바일 헤더가 몇 줄이 되는지** — 실측 전 기준 393px에서 2줄(113px)이었다.
  드롭다운이 늘면 3줄이 될 수 있고, 그만큼 `--chrome-h`가 커져 배경 밴드가 줄어든다. ResizeObserver가
  값을 따라가므로 잘리지는 않지만 보이는 면적은 줄어든다 — 실측 필요.
- **`/pubg/methodology/`의 `AdapterMatrix` 재사용** — 이 컴포넌트는 LoL↔PUBG 대조 자체가 내용이라
  게임 무관으로 판단했으나, 내부 문구가 LoL 화면 기준으로 쓰였는지는 전수 확인하지 않았다.
- **PUBG 화면의 패널 대비** — 램프 토큰 단위 대비는 실측했지만, `.panel-surface`의 그라디언트
  합성 결과(실제 렌더 픽셀)는 측정하지 않았다.
