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
//   - 패치 쌍 select·메타 칩·n/집계 캡션은 "패치 쌍을 소유하는 라우트"(`/`·`/compare/`)에서만
//     렌더한다. `/item/*`·`/methodology/`는 스냅샷 캡션만 그대로 — 이유: 항목상세의
//     `findDeltaForId`는 그 id를 가진 첫 패치 쌍을 쓰므로(item/[id]/page.tsx), 쌍이 여럿인
//     데이터에서 옛 쌍에만 있는 항목을 열면 이 헤더가 `getDefaultPair()` 기준 n·집계를 표시해
//     실제 보고 있는 쌍과 다른 숫자를 주장하게 된다("모든 판정문은 원천 링크를 가진다" 위반).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Container from "@/components/Container";
import { fmtInt, fmtKst } from "@/lib/format";

const NAV_ITEMS = [
  { href: "/", label: "브리핑" },
  { href: "/compare/", label: "대조표" },
  { href: "/methodology/", label: "방법론" },
] as const;

/** PUBG 탭은 **집계 산출물이 있을 때만** 네비에 붙는다(SCOPE 2026-09-16 출하 게이트).
 * 빈 껍데기 탭이 배포되면 LoL 본편 신뢰도까지 깎이므로 "데이터가 없으면 링크도 없다"가
 * 기본값이다 — 판정 여부는 서버(layout.tsx)에서 loadPubg()로 확인해 prop으로 내려온다. */
const PUBG_NAV_ITEM = { href: "/pubg/", label: "PUBG" } as const;

/** 패치 쌍을 소유하는 라우트 — 이 목록에 있을 때만 패치 쌍 select·고정 표본 칩·n/집계 캡션을
 * 렌더한다(그 외 라우트는 특정 패치 쌍에 묶여 있지 않거나, 항목상세처럼 다른 쌍을 보여줄 수
 * 있어 이 헤더의 전역 기본 쌍 캡션을 그대로 붙이면 틀린 숫자를 주장하게 된다). */
const PAIR_SCOPED_ROUTES = ["/", "/compare/"] as const;

const FIXED_SAMPLE = ["KR", "Master+", "솔로/듀오"] as const;

export interface PatchPairOption {
  from: string;
  to: string;
}

export interface HeaderProps {
  /** "2026-09-05 14:00 KST" 형태(fmtKst 출력). 산출 데이터가 아직 없으면 null.
   * PAIR_SCOPED_ROUTES 밖에서만 쓰인다(그 안에서는 아래 nBefore/nAfter/aggregatedAt 캡션이
   * 대신한다 — 두 캡션이 동일 패치를 가리키는 경우가 많지만 소스가 달라(listPatches vs
   * listPatchPairs) aggregate 완료·match 미완 구간에서 갈라질 수 있어 합치지 않는다). */
  snapshotCaption?: string | null;
  pairs?: PatchPairOption[];
  currentPair?: PatchPairOption | null;
  nBefore?: number | null;
  nAfter?: number | null;
  /** ISO 8601 — 집계 시각(요약 파일 meta.generatedAt). */
  aggregatedAt?: string | null;
  /** PUBG 집계 산출물이 존재하고 근거 딸린 판정이 1건 이상인가(출하 게이트). */
  hasPubg?: boolean;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

function pairLabel(pair: PatchPairOption): string {
  return `${pair.from} → ${pair.to}`;
}

export default function Header({
  snapshotCaption = null,
  pairs = [],
  currentPair = null,
  nBefore = null,
  nAfter = null,
  aggregatedAt = null,
  hasPubg = false,
}: HeaderProps) {
  const pathname = usePathname();
  const isPairScoped = (PAIR_SCOPED_ROUTES as readonly string[]).includes(pathname);
  const pairDisabled = pairs.length <= 1;
  const currentIndex = currentPair
    ? pairs.findIndex((p) => p.from === currentPair.from && p.to === currentPair.to)
    : -1;

  const pairCaptionParts: string[] = [];
  if (nBefore !== null && nAfter !== null) {
    pairCaptionParts.push(`n=${fmtInt(nBefore)} / ${fmtInt(nAfter)} 매치`);
  }
  if (aggregatedAt) {
    pairCaptionParts.push(`집계 ${fmtKst(aggregatedAt)}`);
  }
  const pairCaption = pairCaptionParts.length > 0 ? pairCaptionParts.join(" · ") : null;

  return (
    <header className="glass-chrome sticky top-0 z-20 border-b">
      <Container className="flex flex-wrap items-center gap-6 py-3">
        <Link href="/" className="flex min-h-8 items-center gap-2">
          <span className="h-2 w-2 rounded-pill bg-accent" aria-hidden="true" />
          <span className="font-display text-lg font-bold tracking-tight text-fg">patchgap</span>
        </Link>
        <nav className="flex min-h-8 items-center gap-5" aria-label="주요 내비게이션">
          {(hasPubg ? [...NAV_ITEMS, PUBG_NAV_ITEM] : NAV_ITEMS).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
                우회하고 있었다. */}
            <div role="group" aria-label="고정 표본" className="hidden min-h-8 items-center gap-1.5 md:flex">
              {FIXED_SAMPLE.map((label) => (
                <span
                  key={label}
                  className="meta-chip whitespace-nowrap rounded-pill border border-border-soft px-3 py-1 font-mono text-xs text-fg-2"
                >
                  {label}
                </span>
              ))}
            </div>

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
