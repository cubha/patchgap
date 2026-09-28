// src/app/tft/history/[pair]/unit/[key]/page.tsx
// TFT 과거 패치쌍의 대상 상세(2026-09-28, 이월 R8). 본문은 `/tft/unit/[key]/`와 같은 `TftUnitDetail`이되 **이 쌍의
// 번들만** 본다. 정적 파라미터는 (쌍, 대상) — 쌍마다 그 쌍의 대조표 행(`tftDetailRows`)과 같은 집합이라, 과거 쌍
// 화면의 상세 링크가 없는 페이지를 가리키지 않는다(`history/[pair]/__tests__`가 렌더로 잰다).
import type { Metadata } from "next";
import PairMissing from "@/components/PairMissing";
import TftUnitDetail from "@/components/tft/TftUnitDetail";
import { resolvePastPair, tftDetailRows, tftPastDetailParams } from "@/lib/pairPages";
import { pairBasePath } from "@/lib/pairRoutes";
import { loadTft, loadTftDeclaration } from "@/lib/tftData";
import { entityKeyFromSlug as unslug } from "@/lib/tftRoutes";

interface HistoryUnitProps {
  params: Promise<{ pair: string; key: string }>;
}

export function generateStaticParams(): Array<{ pair: string; key: string }> {
  return tftPastDetailParams();
}

export async function generateMetadata({ params }: HistoryUnitProps): Promise<Metadata> {
  const { pair, key } = await params;
  const found = resolvePastPair("tft", pair);
  const bundle = found ? loadTft(found) : null;
  const row = bundle ? tftDetailRows(bundle).find((r) => r.key === unslug(key)) : undefined;
  return {
    title: row && found ? `${row.name} — TFT ${found.from} → ${found.to} · patchgap` : "TFT 상세 — patchgap",
  };
}

export default async function TftHistoryUnitPage({ params }: HistoryUnitProps) {
  const { pair, key } = await params;
  const found = resolvePastPair("tft", pair);
  if (!found) return <PairMissing />;
  const bundle = loadTft(found);
  return (
    <TftUnitDetail
      slug={key}
      bundle={bundle}
      declaration={bundle ? null : loadTftDeclaration(found)}
      pairBase={pairBasePath("tft", found)}
    />
  );
}
