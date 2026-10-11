// src/app/lol/history/[pair]/compare/page.tsx
// 과거 패치쌍 대조표(2026-09-28, 이월 R8). 본문은 최신 쌍 `/lol/compare/`와 같은 `LolCompareView`이고, 쌍만
// 고정한다 — 과거 쌍 브리핑에서 헤더 「대조표」를 눌렀을 때 최신 쌍 대조표로 튀던 맥락 이탈을 닫는다.
// 부모 `[pair]/page.tsx`의 generateStaticParams는 자식 라우트로 이어지지 않는다(레이아웃이 아니다) — 여기서 다시 낸다.
import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import LolCompareView from "@/components/compare/LolCompareView";
import PairMissing from "@/components/PairMissing";
import { pastPairParams, resolvePastPair } from "@/lib/pairPages";
import { pairBasePath } from "@/lib/pairRoutes";

interface HistoryCompareProps {
  params: Promise<{ pair: string }>;
}

export function generateStaticParams(): Array<{ pair: string }> {
  return pastPairParams("lol");
}

export async function generateMetadata({ params }: HistoryCompareProps): Promise<Metadata> {
  const { pair } = await params;
  const found = resolvePastPair("lol", pair);
  return pageMeta({ game: "lol", screen: "compare", pair: found, path: `/lol/history/${pair}/compare/` });
}

export default async function LolHistoryComparePage({ params }: HistoryCompareProps) {
  const { pair } = await params;
  const found = resolvePastPair("lol", pair);
  if (!found) return <PairMissing />;
  return <LolCompareView pair={found} pairBase={pairBasePath("lol", found)} />;
}
