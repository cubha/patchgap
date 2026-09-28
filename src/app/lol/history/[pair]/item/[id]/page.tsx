// src/app/lol/history/[pair]/item/[id]/page.tsx
// 과거 패치쌍의 대상 상세(2026-09-28, 이월 R8). 본문은 `/lol/item/[id]/`와 같은 `LolItemDetail`이되 **이 쌍의 행만**
// 본다 — 평소 상세는 「판정이 선 첫 쌍」(대개 최신)을 골라서, 과거 쌍 화면에서 누른 링크가 다른 쌍의 관측을 그렸다.
//
// 정적 파라미터는 (쌍, 대상) 쌍이다 — 쌍마다 **그 쌍에서** 판정이 선 대상의 정준 슬러그만(`lib/pairPages.ts`).
// 과거 쌍 화면의 대상 링크는 전부 이 집합 안에 있어야 한다(`history/[pair]/__tests__`가 렌더로 잰다).
import type { Metadata } from "next";
import LolItemDetail from "@/components/detail/LolItemDetail";
import PairMissing from "@/components/PairMissing";
import { lolPastDetailParams, resolvePastPair } from "@/lib/pairPages";
import { pairBasePath } from "@/lib/pairRoutes";

interface HistoryItemProps {
  params: Promise<{ pair: string; id: string }>;
}

export function generateStaticParams(): Array<{ pair: string; id: string }> {
  return lolPastDetailParams();
}

export async function generateMetadata({ params }: HistoryItemProps): Promise<Metadata> {
  const { pair } = await params;
  const found = resolvePastPair("lol", pair);
  return { title: found ? `리그 오브 레전드 ${found.from} → ${found.to} 상세 · patchgap` : "리그 오브 레전드 — patchgap" };
}

export default async function LolHistoryItemPage({ params }: HistoryItemProps) {
  const { pair, id } = await params;
  const found = resolvePastPair("lol", pair);
  if (!found) return <PairMissing />;
  return <LolItemDetail id={id} pairs={[found]} pairBase={pairBasePath("lol", found)} />;
}
