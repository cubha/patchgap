import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Roboto_Mono } from "next/font/google";
import AmbientBackground from "@/components/AmbientBackground";
import { AmbientProvider } from "@/components/AmbientContext";
import GameRoot from "@/components/GameRoot";
import Header, { type GameChrome } from "@/components/Header";
import type { GameId } from "@/lib/game";
import { loadPubg } from "@/lib/pubgData";
import { loadTft } from "@/lib/tftData";
import { getDefaultPair, listPatchPairs, listPatches, loadSummary } from "@/lib/data";
import { fmtKst } from "@/lib/format";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "patchgap",
  description: "패치노트가 말한 것 vs 통계가 말하는 것 — LoL 패치 미공지 변화 브리핑",
};

// 실측(2026-09-05): create-next-app 기본 `LayoutProps<"/">`는 `.next/types`가 생성된 뒤에만
// 존재하는 앰비언트 타입이라, verify.sh 순서(tsc --noEmit → build)상 최초 실행 시 `next build`가
// 아직 안 돌아 `.next/types`가 없으면 `tsc`가 항상 실패한다(Cannot find name 'LayoutProps'). 이
// 순서 의존을 없애기 위해 명시 타입으로 대체한다.

/** 헤더 우측 "스냅샷 · YYYY-MM-DD HH:mm KST" 캡션 — 가장 최신 패치 summary.json의
 * meta.generatedAt에서 계산한다. 빌드 타임 fs 호출(data.ts)은 서버 컴포넌트인 이 레이아웃에서만
 * 하고, 클라이언트 컴포넌트인 Header에는 계산된 문자열만 prop으로 내려준다. 집계 산출물이
 * 하나도 없으면(빈 데이터 빌드) null — Header는 null이면 캡션을 렌더하지 않는다. */
function getSnapshotCaption(): string | null {
  const latestPatch = listPatches()[0];
  if (!latestPatch) return null;
  const summary = loadSummary(latestPatch);
  if (!summary) return null;
  return fmtKst(summary.meta.generatedAt);
}

/** 헤더 1줄 통합(2026-09-12·3차, Q1)이 흡수한 구 FilterBar 데이터 — page.tsx/compare/page.tsx가
 * 각자 getDefaultPair()로 계산하던 것과 정확히 같은 계산이다(중복이지만 그 두 페이지도 자기
 * 렌더에 pair가 필요해 각자 다시 계산한다 — snapshotCaption과 같은 기존 패턴). Header는
 * 클라이언트 컴포넌트라 fs를 못 만지므로 여기서 계산해 prop으로 내려준다.
 *
 * **표본 칩이 여기 있는 이유**(2026-09-17): 예전엔 Header가 ["KR","Master+","솔로/듀오"]를
 * 상수로 들고 있었는데, 게임 스위처가 붙으면 그 하드코딩이 PUBG 화면에서 **LoL 표본을 주장**
 * 하게 된다. 표본 성격은 집계 산출물의 속성이므로 그것을 읽는 이 서버 레이아웃이 소유한다. */
function getLolChrome(): GameChrome {
  const pairs = listPatchPairs();
  const pair = getDefaultPair();
  const summaryFrom = pair ? loadSummary(pair.from) : null;
  const summaryTo = pair ? loadSummary(pair.to) : null;
  return {
    pairs,
    currentPair: pair,
    nBefore: summaryFrom?.data.matches ?? null,
    nAfter: summaryTo?.data.matches ?? null,
    aggregatedAt: summaryTo?.meta.generatedAt ?? null,
    sampleChips: ["KR", "Master+", "솔로/듀오"],
    snapshotCaption: getSnapshotCaption(),
  };
}

/**
 * PUBG 크롬 — **출하 게이트**(SCOPE 2026-09-16). 집계가 없거나 근거 딸린 판정이 0건이면
 * null을 돌려주고, Header는 그 게임을 드롭다운 옵션에서 뺀다.
 *
 * 정적 export라 `/pubg/*` 라우트 자체는 빌드 시 항상 생성된다 — "집계가 없으면 라우트도
 * 생기지 않는다"는 옛 서술은 거짓이었다(PLAN-game-switcher-2026-09-17 §4-5 정정). 정확히는
 * **선택 옵션이 생기지 않고**, 그 라우트를 직접 열면 `loadPubg()`가 null이라 페이지가
 * "미연결"을 정직하게 표시한다.
 *
 * 칩이 LoL과 정반대인 점에 주의 — PUBG API는 지역 샤드가 폐지돼 한국 한정 표본을 뽑을 수
 * 없고, /samples는 전 티어 무작위이며 봇이 섞인다(PLAN-pubg-gate §9-2 R5).
 */
function getPubgChrome(): GameChrome | null {
  const bundle = loadPubg();
  if (!bundle) return null;
  const pair = { from: bundle.deltas.meta.from, to: bundle.deltas.meta.to };
  return {
    pairs: [pair],
    currentPair: pair,
    nBefore: bundle.before.nMatches,
    nAfter: bundle.after.nMatches,
    aggregatedAt: bundle.deltas.meta.generatedAt,
    sampleChips: ["Steam", "전 지역·전 티어", "봇 포함"],
    // PUBG의 스냅샷 시각은 PUBG 집계 산출물에서 온다 — LoL의 listPatches()를 쓰면
    // `/pubg/methodology/`가 LoL 집계 시각을 자기 것처럼 표시한다(축A 지적).
    snapshotCaption: fmtKst(bundle.deltas.meta.generatedAt),
  };
}

/**
 * TFT 크롬 — PUBG와 같은 출하 게이트. 집계가 없으면 null이고 드롭다운에서 빠진다.
 *
 * 표본 칩이 LoL과 같은 어휘인 이유: TFT도 `tft-league-v1` 챌린저~마스터 래더에서 시드를
 * 뽑고 KR 플랫폼만 조회한다. 다만 **표본 단위가 매치가 아니라 보드(참가자)**라 크롬의
 * n은 매치 수를 쓰되, 화면의 등장률 분모가 보드임을 방법론에서 밝힌다.
 */
function getTftChrome(): GameChrome | null {
  const bundle = loadTft();
  if (!bundle) return null;
  const pair = { from: bundle.deltas.meta.from, to: bundle.deltas.meta.to };
  return {
    pairs: [pair],
    currentPair: pair,
    nBefore: bundle.before.matches,
    nAfter: bundle.after.matches,
    aggregatedAt: bundle.deltas.meta.generatedAt,
    sampleChips: ["KR", "Master+", "랭크"],
    snapshotCaption: fmtKst(bundle.deltas.meta.generatedAt),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const chrome: Record<GameId, GameChrome | null> = {
    lol: getLolChrome(),
    pubg: getPubgChrome(),
    tft: getTftChrome(),
  };
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${robotoMono.variable} dark h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col bg-bg text-fg">
        {/* GameRoot는 display:contents라 레이아웃에 참여하지 않는다 — 현재 라우트의 게임을
            data-game 속성으로 표시할 뿐이고, tokens.css의 :root:has()와 ambient.css의
            아트 차단 규칙이 그것을 읽는다. AmbientBackground가 **안쪽**에 있어야 협곡 아트
            레이어에 그 규칙이 걸린다. */}
        <GameRoot>
          <AmbientProvider>
            <AmbientBackground />
            <div className="relative z-[1] flex min-h-full flex-1 flex-col">
              <Header chrome={chrome} />
              {children}
            </div>
          </AmbientProvider>
        </GameRoot>
      </body>
    </html>
  );
}
