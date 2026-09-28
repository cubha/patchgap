// src/app/lol/history/[pair]/page.tsx
// 과거 패치쌍 브리핑(2026-09-28, PR-C B3 · 사용자 결정 D3 — 「과도한 라우팅 인프라 신설 금지」 해제 후 10/6).
// 최신 쌍은 `/lol/`이 그리고, 여기는 **과거 쌍만**이다(같은 화면이 두 주소를 갖지 않게). 본문은 최신 쌍과
// 같은 `LolBriefing`이다 — 과거 쌍은 최신 쌍과 같은 품질 기준으로 재생성했다(명문화 규칙).
// 2026-09-28(이월 R8): 본문에 `pairBase`를 넘겨 대상 링크·미공지 타일이 **이 쌍의** 상세·대조표로 간다.
//
// output:'export'라 generateStaticParams가 필수이고 빈 배열이면 빌드가 죽는다 — 과거 쌍이 없으면
// `_placeholder` 한 장을 남긴다(`/lol/item/[id]`와 같은 규약). 목록 규칙은 `lib/pairPages.ts`가 소유한다.
import type { Metadata } from "next";
import LolBriefing from "@/components/home/LolBriefing";
import PairMissing from "@/components/PairMissing";
import { pastPairParams, resolvePastPair } from "@/lib/pairPages";
import { pairBasePath } from "@/lib/pairRoutes";

interface HistoryPageProps {
  params: Promise<{ pair: string }>;
}

export function generateStaticParams(): Array<{ pair: string }> {
  return pastPairParams("lol");
}

export async function generateMetadata({ params }: HistoryPageProps): Promise<Metadata> {
  const { pair } = await params;
  const found = resolvePastPair("lol", pair);
  return { title: found ? `리그 오브 레전드 ${found.from} → ${found.to} — patchgap` : "리그 오브 레전드 — patchgap" };
}

export default async function LolHistoryPage({ params }: HistoryPageProps) {
  const { pair } = await params;
  // 최신 쌍 슬러그는 여기서 그리지 않는다 — 그 쌍은 `/lol/`이 주인이다.
  const found = resolvePastPair("lol", pair);
  if (!found) return <PairMissing />;
  return <LolBriefing pair={found} pairBase={pairBasePath("lol", found)} />;
}
