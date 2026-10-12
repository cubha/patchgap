// src/app/pubg/page.tsx
// PUBG 브리핑 홈. 본문은 `components/pubg/PubgBriefing.tsx`에 있다(2026-10-06 — LoL·TFT와 같은 구조). 로드만 여기서 한다.
import type { Metadata } from "next";
import PubgBriefing from "@/components/pubg/PubgBriefing";
import { pageMeta } from "@/lib/meta";
import { loadPubg, loadPubgDeclaration, newerPubgDeclaration } from "@/lib/pubgData";

export const metadata: Metadata = pageMeta({ game: "pubg", screen: "briefing", path: "/pubg/" });

export default function PubgPage() {
  const bundle = loadPubg();
  // 홈 = 관측 쌍(PLAN-home-observed-pair). 더 새 패치노트(stub)는 배너로, 관측이 없을 때만 선언 뷰가 홈이다(C13·C14).
  return <PubgBriefing bundle={bundle} declaration={bundle ? null : loadPubgDeclaration()} newer={bundle ? newerPubgDeclaration() : null} />;
}
