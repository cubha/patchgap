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
- **PUBG 램프는 문서값을 그대로 쓰지 않고 V4 기준으로 재도출**했다. `--border`만
  `#3a2f20` → `#8f6a22`(V4가 border를 보이는 골드 레일로 승격시킨 뒤라 원안은 레일이 사라진다).
  대비 실측 전부 기재 — tokens.css 주석 참고.
- **PUBG에서 협곡 아트 3레이어를 끈다**(`.ambient-wash`·`.ambient-camera`·`.ambient-reveal`).
  `.ambient-glow`는 `--game-glow`를 소비하므로 PUBG 앰버로 자동 전환된다. PUBG 아트는 연결하지
  않는다(크래프톤 자산 문의 회신 전).
- **헤더 표본 칩·패치쌍·n 캡션을 게임 소유로 옮겼다**(`GameChrome`). 안 옮기면 PUBG 화면이
  LoL의 `KR·Master+·솔로/듀오`와 LoL n을 주장한다.
- **`/pubg/` 한 장을 3라우트로 분할**: 브리핑(판정된 것) · 대조표(전체 47행) · 방법론(판정 규칙 +
  관측 축 없는 항목 + 버린 축 §8 반증표).
- **`CompareExplorer`를 제네릭화하지 않고 `PubgCompareTable`을 새로 썼다** — PUBG 행에는 q·causes·
  라인이 없고, 제네릭화하면 LoL 테스트 2종이 흔들린다. q 열은 **만들지 않았다**(없는 값을 빈칸으로
  채우면 무근거 회색 원칙 위반).
- **모바일 배경(9차)**: 마스크 원점과 이미지 상단을 둘 다 `var(--chrome-h)`로 내렸다. 값은
  Header의 ResizeObserver 실측. 폴백은 tokens.css 57px / ambient.css ≤767px 110px.

## 미확인 사항

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
