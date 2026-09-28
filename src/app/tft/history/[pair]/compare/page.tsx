// src/app/tft/history/[pair]/compare/page.tsx
// TFT 과거 패치쌍 대조표(2026-09-28, 이월 R8). 본문은 `/tft/compare/`와 같은 `TftCompareView`이고 쌍만 고정한다.
// 부모 `[pair]/page.tsx`의 generateStaticParams는 자식 라우트로 이어지지 않는다 — 여기서 다시 낸다.
import type { Metadata } from "next";
import PairMissing from "@/components/PairMissing";
import TftCompareView from "@/components/tft/TftCompareView";
import { pastPairParams, resolvePastPair } from "@/lib/pairPages";
import { pairBasePath } from "@/lib/pairRoutes";
import { loadTft, loadTftDeclaration } from "@/lib/tftData";

interface HistoryCompareProps {
  params: Promise<{ pair: string }>;
}

export function generateStaticParams(): Array<{ pair: string }> {
  return pastPairParams("tft");
}

export async function generateMetadata({ params }: HistoryCompareProps): Promise<Metadata> {
  const { pair } = await params;
  const found = resolvePastPair("tft", pair);
  return {
    title: found ? `전략적 팀 전투 ${found.from} → ${found.to} 대조표 · patchgap` : "전략적 팀 전투 대조표 · patchgap",
  };
}

export default async function TftHistoryComparePage({ params }: HistoryCompareProps) {
  const { pair } = await params;
  const found = resolvePastPair("tft", pair);
  if (!found) return <PairMissing />;
  const bundle = loadTft(found);
  return (
    <TftCompareView
      bundle={bundle}
      declaration={bundle ? null : loadTftDeclaration(found)}
      pairBase={pairBasePath("tft", found)}
    />
  );
}
