// src/app/tft/history/[pair]/page.tsx
// TFT 과거 패치쌍 브리핑(2026-09-28, 이월 R8). LoL `/lol/history/[pair]/`와 같은 규칙이다 — 최신 쌍은 `/tft/`가
// 그리고 여기는 과거 쌍만, 본문은 최신 쌍과 같은 `TftBriefing`이며 `pairBase`로 링크가 이 쌍 안에 머문다.
// output:'export'라 과거 쌍이 없으면 `_placeholder` 한 장을 남긴다(목록 규칙은 `lib/pairPages.ts`).
import type { Metadata } from "next";
import PairMissing from "@/components/PairMissing";
import TftBriefing from "@/components/tft/TftBriefing";
import { pastPairParams, resolvePastPair } from "@/lib/pairPages";
import { pairBasePath } from "@/lib/pairRoutes";
import { loadTft, loadTftDeclaration } from "@/lib/tftData";

interface HistoryPageProps {
  params: Promise<{ pair: string }>;
}

export function generateStaticParams(): Array<{ pair: string }> {
  return pastPairParams("tft");
}

export async function generateMetadata({ params }: HistoryPageProps): Promise<Metadata> {
  const { pair } = await params;
  const found = resolvePastPair("tft", pair);
  return { title: found ? `전략적 팀 전투 ${found.from} → ${found.to} — patchgap` : "전략적 팀 전투 — patchgap" };
}

export default async function TftHistoryPage({ params }: HistoryPageProps) {
  const { pair } = await params;
  const found = resolvePastPair("tft", pair);
  if (!found) return <PairMissing />;
  const bundle = loadTft(found);
  return (
    <TftBriefing
      bundle={bundle}
      declaration={bundle ? null : loadTftDeclaration(found)}
      pairBase={pairBasePath("tft", found)}
    />
  );
}
