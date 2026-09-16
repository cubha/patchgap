import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Roboto_Mono } from "next/font/google";
import AmbientBackground from "@/components/AmbientBackground";
import { AmbientProvider } from "@/components/AmbientContext";
import Header from "@/components/Header";
import { loadPubg } from "@/lib/pubgData";
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
 * 클라이언트 컴포넌트라 fs를 못 만지므로 여기서 계산해 prop으로 내려준다. */
function getPairChromeData() {
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
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const snapshotCaption = getSnapshotCaption();
  const pairChrome = getPairChromeData();
  // 출하 게이트(SCOPE 2026-09-16) — PUBG 집계가 없거나 근거 딸린 판정이 0건이면 네비에
  // 링크 자체를 만들지 않는다. loadPubg()는 빌드 타임 파일 읽기라 런타임 호출이 아니다.
  const hasPubg = loadPubg() !== null;
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${robotoMono.variable} dark h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col bg-bg text-fg">
        <AmbientProvider>
          <AmbientBackground />
          <div className="relative z-[1] flex min-h-full flex-1 flex-col">
            <Header snapshotCaption={snapshotCaption} hasPubg={hasPubg} {...pairChrome} />
            {children}
          </div>
        </AmbientProvider>
      </body>
    </html>
  );
}
