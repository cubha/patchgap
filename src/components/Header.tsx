// src/components/Header.tsx
// 헤더 — 로고 점 + "patchgap" + 내비 3개(브리핑/대조표/방법론) + 우측 스냅샷 캡션.
// 프로토타입 `.site-header`/`.brand`/`.site-nav`/`.snapshot-caption` 1:1
// (docs/design/prototype/01-briefing-home.html). 표면은 2026-09-12에 확정 시안 v5의 반투명
// `.topbar`로 교체했다(.glass-chrome — src/styles/ambient.css) — 뒤에 깔린 전역 앰비언트 배경이
// 비쳐야 해서 불투명 --surface를 쓸 수 없다. 하단 hairline도 시안대로 --border(골드)가 아니라
// --glass-border(border-soft 70%)다: 반투명 바 아래 진한 골드 선은 시안보다 무겁게 읽힌다.
// 현재 경로 강조에 usePathname이 필요해 클라이언트 컴포넌트로 둔다. snapshotCaption은 서버
// (layout.tsx)가 data.ts로 미리 계산해 prop으로 내려준다(이 컴포넌트 자신은 fs를 만지지 않는다).
//
// 2026-09-12(4차, R3): 그룹간 gap을 4(16px)→6(24px)로 넓혔다(내부 nav gap-5=20px보다 좁았던
// 위계 역전을 바로잡음 — 프로토타입 01-briefing-home.html .site-nav 규약: 내부 20px/분리 24px).
// nav 링크에 pt-1.5를 추가해 border-b-2 pb-1(하단 6px)이 만드는 광학적 처짐을 보정하고, 모든
// 그룹 래퍼를 min-h-8(=select의 기존 높이)로 통일해 로고 기준 수직 중앙이 실제로 맞도록 했다
// (items-center만으로는 그룹별 내부 높이가 달라 어긋나 보였다 — 사용자 실측 지적). min-h-8은
// 기존 select 높이와 같아 헤더 총 높이 57px가 바뀌지 않는다(.ambient-scrim 재보정 불필요).
//
// 2026-09-12(3차, 방향 제안 아티팩트 Q1 "안 N2"): 별도 필터 바(구 FilterBar.tsx, 2줄 144px)를
// 이 헤더 1줄로 흡수했다. 실측 근거 — 그 바의 컨트롤 4개 중 실제로 동작하는 게 0개였다: 티어·
// 지역·큐는 파이프라인이 KR·Master+·솔로/듀오 단일 표본만 수집해 disabled 고정 옵션 1개였고,
// 패치 쌍은 옵션이 2개 열려도 호출부가 pairHref를 넘기지 않아 선택해도 이동하지 않았다. 크롬
// 2줄이 표시용 88px을 더 쓰고 있었던 셈이라, 앰비언트 배경의 섬 지형이 실제로 존재하는 상단
// 밴드(y 0~560px)를 그만큼 가리고 있었다. 그래서:
//   - 패치 쌍만 실제 select로 남긴다. `next.config.ts`가 output:'export'이고 패치 쌍별 정적
//     라우트가 없어(`generateStaticParams`는 item/[id]에만 있고 델타 슬러그 기준) 이동할 다른
//     라우트가 원리적으로 없다 — 그래서 이번에도 라우팅은 배선하지 않는다(과도한 라우팅 인프라
//     신설 금지, 사용자 원문 명시). select는 표시/향후 확장용이고, 쌍별 브라우징 라우트가 생기면
//     그때 실제 이동 경로를 붙인다.
//   - 고정 표본(KR·Master+·솔로/듀오)은 disabled select 3개 대신 읽기전용 메타 칩으로 바꿨다 —
//     disabled select는 포커스 불가·스크린리더에 혼선을 준다.
//   - 패치 쌍 select·메타 칩·n/집계 캡션은 "패치 쌍을 소유하는 라우트"(`/lol/`·`/lol/compare/`)에서만
//     렌더한다. `/lol/item/*`·`/lol/methodology/`는 스냅샷 캡션만 그대로 — 이유: 항목상세의
//     `findDeltaForId`는 그 id를 가진 첫 패치 쌍을 쓰므로(item/[id]/page.tsx), 쌍이 여럿인
//     데이터에서 옛 쌍에만 있는 항목을 열면 이 헤더가 `getDefaultPair()` 기준 n·집계를 표시해
//     실제 보고 있는 쌍과 다른 숫자를 주장하게 된다("모든 판정문은 원천 링크를 가진다" 위반).
//
// 2026-09-17(게임 스위처): PUBG는 **4번째 내비 탭이 아니다**. 내비는 어느 게임에서도
// 브리핑·대조표·방법론 3개 그대로고, 게임은 로고 옆 드롭다운으로 바꾼다(사용자 원문:
// "pubg 메뉴가 신설되는게아니라, 모든메뉴는 동일하되 드롭다운으로 … 선택해서 내부 데이터랑
// 테마만 변경되는거야"). 이때 **표본 칩·패치쌍·n 캡션도 함께 게임을 따라가야 한다** — 예전
// 구조는 FIXED_SAMPLE=["KR","Master+","솔로/듀오"]과 LoL n 캡션이 하드코딩이라, 라우트만
// 넓히면 PUBG 화면이 LoL의 티어·큐·표본 수를 그대로 주장하게 된다(PUBG 표본은 전지역·전티어·
// 봇포함이다). 이 파일 아래쪽 주석이 스스로 경고했던 위반("실제 보고 있는 쌍과 다른 숫자를
// 주장")과 정확히 같은 결함이라 게임별 chrome 묶음(GameChrome)을 prop으로 받는다.
"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import { GAMES, gameFromPathname, gameHref, sectionHref, sectionOfPathname, type GameId } from "@/lib/game";
import { fmtInt, fmtKst } from "@/lib/format";

/** 내비 섹션 — 게임과 무관하게 항상 이 3개다. 게임은 아래 드롭다운이 바꾼다. */
const NAV_SECTIONS = [
  { section: "", label: "브리핑" },
  { section: "compare", label: "대조표" },
  { section: "methodology", label: "방법론" },
] as const;

/** 패치 쌍을 소유하는 섹션 — 여기서만 패치쌍 select·표본 칩·n/집계 캡션을 렌더한다(그 외
 * 라우트는 특정 패치 쌍에 묶여 있지 않거나, 항목상세처럼 다른 쌍을 보여줄 수 있어 이 헤더의
 * 전역 기본 쌍 캡션을 그대로 붙이면 틀린 숫자를 주장하게 된다). */
const PAIR_SCOPED_SECTIONS = ["", "compare"] as const;

export interface PatchPairOption {
  from: string;
  to: string;
}

/** 한 게임의 헤더 크롬 데이터 묶음. 게임마다 표본 성격이 달라 **칩까지 게임 소유**다 —
 * LoL은 KR·Master+·솔로/듀오 단일 표본, PUBG는 전지역·전티어·봇 포함이라 같은 칩을 쓰면
 * 화면이 거짓을 말한다. 서버(layout.tsx)가 각 게임의 집계에서 계산해 내려준다. */
export interface GameChrome {
  pairs: PatchPairOption[];
  currentPair: PatchPairOption | null;
  nBefore: number | null;
  nAfter: number | null;
  /** ISO 8601 — 집계 시각(요약 파일 meta.generatedAt). */
  aggregatedAt: string | null;
  /** 읽기전용 표본 칩(고정 조건). 비면 칩 그룹 자체를 렌더하지 않는다. */
  sampleChips: string[];
  /**
   * "2026-09-05 14:00 KST" 형태(fmtKst 출력). PAIR_SCOPED_SECTIONS **밖**(방법론 등)에서만
   * 쓰인다 — 그 라우트는 특정 패치 쌍에 묶여 있지 않아 n·집계 캡션 대신 이것을 보여준다.
   *
   * **이것도 게임 소유다**(2026-09-17 /verify-impl 축A 지적): 예전엔 Header가 게임 무관
   * `snapshotCaption` prop 하나를 받았고 그 값은 `listPatches()`/`loadSummary()`로 계산한
   * **LoL 전용**이었다. 그래서 `/pubg/methodology/`가 LoL의 집계 시각을 자기 것처럼 표시했다 —
   * 칩·n·패치쌍만 분기하고 이 캡션을 빠뜨린 잔여 결함이었다. 같은 파일 위쪽 주석이 경고한
   * "실제 보고 있는 쌍과 다른 숫자를 주장"과 같은 계열이다.
   */
  snapshotCaption: string | null;
}

export interface HeaderProps {
  /** 게임별 크롬 데이터. `pubg`가 null이면 **드롭다운에 배틀그라운드 옵션이 뜨지 않는다**
   * (출하 게이트 — 집계 산출물이 없거나 근거 딸린 판정이 0건인 경우). 정적 export라 라우트
   * 자체는 빌드되지만, 링크가 없으면 사용자는 도달하지 않고 그 라우트는 미연결 상태를
   * 정직하게 표시한다. */
  chrome: Record<GameId, GameChrome | null>;
}

/**
 * 이 헤더의 **실제 렌더 높이**를 `--chrome-h`로 발행한다. 소비처는 `src/styles/ambient.css`의
 * 이미지 레이어(.ambient-cam-inner · .ambient-reveal) — 배경 아트를 그만큼 아래로 내려서
 * 크롬이 이미지의 윗부분을 덮지 않게 한다.
 *
 * **왜 JS로 재는가**(2026-09-17·9차, 사용자 모바일 스크린샷 3회차 지적 "bg이미지가 또 위에 다
 * 잘려있네"): 이 헤더는 `flex-wrap`이라 높이가 뷰포트 폭에 따라 1~3줄로 **바뀐다**(393px에서
 * 실측 2줄 ≈157px, 게임 드롭다운 추가 후 더 늘 수 있다). 반면 배경 이미지 높이는 `128vw`에
 * 비례한다 — 393px에서는 283px까지 줄어든다. 즉 **크롬은 px, 이미지는 vw**라는 단위 불일치가
 * 있고, 좁은 화면일수록 크롬이 이미지에서 차지하는 비율이 커진다(393px에서 상단 55%가 덮였다).
 * 6차(vw 환산)·7차(380px 하한)는 마스크만 손댔기 때문에 이 불일치가 그대로 남아 재발했다.
 * 미디어쿼리 고정값으로는 줄바꿈 횟수를 예측할 수 없으므로 실측만이 답이다.
 *
 * 스크립트 이전/실패 시에는 tokens.css의 기본값(데스크톱 1줄 57px / 좁은 화면 110px)이 쓰인다 —
 * 값이 없어 배경이 사라지는 일은 없다.
 */
function useChromeHeight() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--chrome-h", `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function pairLabel(pair: PatchPairOption): string {
  return `${pair.from} → ${pair.to}`;
}

export default function Header({ chrome }: HeaderProps) {
  const pathname = usePathname();
  const headerRef = useChromeHeight();
  const router = useRouter();
  const game = gameFromPathname(pathname);
  const section = sectionOfPathname(pathname);
  const isPairScoped = section !== null && (PAIR_SCOPED_SECTIONS as readonly string[]).includes(section);

  // 드롭다운에는 크롬 데이터가 실제로 있는 게임만 올린다(출하 게이트). LoL이 없을 일은
  // 없지만 빈 데이터 빌드에서도 무너지지 않도록 같은 규칙을 적용한다.
  const available = GAMES.filter((g) => chrome[g.id] !== null);
  const current = game === null ? null : chrome[game];

  const pairs = current?.pairs ?? [];
  const currentPair = current?.currentPair ?? null;
  const pairDisabled = pairs.length <= 1;
  const currentIndex = currentPair
    ? pairs.findIndex((p) => p.from === currentPair.from && p.to === currentPair.to)
    : -1;

  const pairCaptionParts: string[] = [];
  if (current && current.nBefore !== null && current.nAfter !== null) {
    pairCaptionParts.push(`n=${fmtInt(current.nBefore)} / ${fmtInt(current.nAfter)} 매치`);
  }
  if (current?.aggregatedAt) {
    pairCaptionParts.push(`집계 ${fmtKst(current.aggregatedAt)}`);
  }
  const pairCaption = pairCaptionParts.length > 0 ? pairCaptionParts.join(" · ") : null;
  const sampleChips = current?.sampleChips ?? [];
  const snapshotCaption = current?.snapshotCaption ?? null;

  // 랜딩(게임 없음)은 크롬을 거의 갖지 않는다 — 확정 시안 05-landing-B.html은 브랜드 한 줄이
  // 전부다. 게임 드롭다운·내비·패치쌍·표본 칩·스냅샷 캡션은 **어느 게임 안에 있는지**를 전제로
  // 하는 컨트롤이라, 게임이 정해지지 않은 화면에서 그리면 LoL을 임의로 주장하게 된다
  // (이 파일 위 주석이 경고한 "실제 보고 있는 쌍과 다른 숫자를 주장"과 같은 결함군).
  if (game === null) {
    return (
      <header ref={headerRef} className="glass-chrome sticky top-0 z-20 border-b">
        <Container className="flex items-center justify-between gap-6 py-3">
          <Link href="/" className="flex min-h-8 items-center gap-2">
            <BrandMark />
            <span className="font-display text-lg font-bold tracking-tight text-fg">patchgap</span>
          </Link>
          <a href="#how" className="text-xs text-fg-2 hover:text-fg">
            어떻게 판정하나
          </a>
        </Container>
      </header>
    );
  }

  return (
    <header ref={headerRef} className="glass-chrome sticky top-0 z-20 border-b">
      <Container className="flex flex-wrap items-center gap-6 py-3">
        <Link href={sectionHref(game, "")} className="flex min-h-8 items-center gap-2">
          <BrandMark />
          <span className="font-display text-lg font-bold tracking-tight text-fg">patchgap</span>
        </Link>

        {/* 게임 드롭다운 — 내비 왼쪽(로고 바로 옆)에 둔다. 이건 "어느 화면을 볼까"(내비)가
            아니라 "무엇에 대한 사이트인가"(컨텍스트)라, 제품 식별자인 로고에 붙어야 위계가
            맞는다. 옵션이 1개뿐이면(PUBG 미출하) 선택할 게 없으므로 아예 렌더하지 않는다 —
            disabled select는 포커스 불가·스크린리더 혼선을 준다(2026-09-12 고정표본 칩 전환과
            같은 판단). 전환 경로 계산은 gameHref가 소유한다(src/lib/game.ts, 단위테스트 보유):
            /lol/item/* 처럼 대응 라우트가 없는 곳에서는 그 게임의 브리핑으로 떨어진다. */}
        {available.length > 1 ? (
          <label className="flex min-h-8 items-center gap-2">
            <span className="sr-only">게임</span>
            <select
              className="min-h-8 rounded-sm border border-border bg-surface px-2 text-xs font-bold text-fg"
              value={game}
              onChange={(e) => router.push(gameHref(e.target.value as GameId, pathname))}
            >
              {available.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav className="flex min-h-8 items-center gap-5" aria-label="주요 내비게이션">
          {NAV_SECTIONS.map((item) => {
            const active = section === item.section;
            return (
              <Link
                key={item.section}
                href={sectionHref(game, item.section)}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 pt-1.5 pb-1 text-sm font-bold ${
                  active
                    ? "border-accent text-fg"
                    : "border-transparent text-muted hover:text-fg-2"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isPairScoped ? (
          <>
            {/* 시각 라벨 "패치" — 사용자 요구 원문이 "Top nav에 라벨과 dropdown"이었고 방향 제안
                아티팩트의 N2 목업도 select 앞에 라벨을 그렸다. 3차 구현이 aria-label만 두고
                시각 라벨을 뺐던 것을 2026-09-12 /verify-impl 화면 대조로 잡아 보완했다.
                `<label>`로 감싸 클릭 시 select에 포커스가 가게 하고, 시각 라벨이 생겼으므로
                select의 중복 aria-label은 뺀다(라벨이 접근성 이름을 제공한다). */}
            <label className="flex min-h-8 items-center gap-2">
              <span className="text-xs font-bold text-muted">패치</span>
              <select
                className="min-h-8 rounded-sm border border-border bg-surface px-2 text-xs font-bold text-fg disabled:cursor-not-allowed disabled:opacity-70"
                disabled={pairDisabled}
                defaultValue={currentIndex >= 0 ? currentIndex : 0}
              >
                {pairs.length > 0 ? (
                  pairs.map((pair, i) => (
                    <option key={pairLabel(pair)} value={i}>
                      {pairLabel(pair)}
                    </option>
                  ))
                ) : (
                  <option>데이터 없음</option>
                )}
              </select>
            </label>

            {/* 2026-09-12(6차, /verify-impl 재검증): bg-[color-mix(...)](arbitrary bracket)를
                .meta-chip(src/styles/panel.css, --chip-fill 토큰)으로 교체 — verify.sh Spec
                arbitrary 값 정규식이 이 형태를 못 잡아 실제로는 다른 컴포넌트들과 함께 토큰을
                우회하고 있었다.
                2026-09-17: 칩 목록이 게임 소유가 됐다(GameChrome.sampleChips) — LoL의
                KR·Master+·솔로/듀오를 PUBG 화면에 그대로 띄우면 화면이 거짓을 말한다. */}
            {sampleChips.length > 0 ? (
              <div role="group" aria-label="고정 표본" className="hidden min-h-8 items-center gap-1.5 md:flex">
                {sampleChips.map((label) => (
                  <span
                    key={label}
                    className="meta-chip whitespace-nowrap rounded-pill border border-border-soft px-3 py-1 font-mono text-xs text-fg-2"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            {pairCaption ? (
              /* 2026-09-12(4차, R3): lg(1024px)→xl(1280px)로 상향 — gap 확대(gap-4→gap-6) 후
                 1024px에서 이 캡션까지 포함하면 한 줄에 다 안 들어가 헤더가 2줄로 줄바꿈되고
                 높이가 57px→113px로 늘어난다(실측). 캡션을 더 넓은 폭에서만 보이게 해 1024px
                 구간의 헤더 높이를 보존한다. */
              <span className="ml-auto hidden min-h-8 items-center whitespace-nowrap font-mono text-xs tabular-nums text-muted xl:flex">
                {pairCaption}
              </span>
            ) : null}
          </>
        ) : snapshotCaption ? (
          <span className="ml-auto flex min-h-8 items-center whitespace-nowrap font-mono text-xs tabular-nums text-muted">
            스냅샷 · {snapshotCaption}
          </span>
        ) : null}
      </Container>
    </header>
  );
}
