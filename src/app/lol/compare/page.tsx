// src/app/lol/compare/page.tsx
// LoL 대조표 — 최신 쌍. 본문은 `components/compare/LolCompareView.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍
// `/lol/history/[pair]/compare/`와 같은 본문을 쓰려고 옮겼다). 헤더는 src/app/layout.tsx가 전역 렌더한다.
import type { Metadata } from "next";

import LolCompareView from "@/components/compare/LolCompareView";
import { getDefaultPair } from "@/lib/data";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({ game: "lol", screen: "compare", path: "/lol/compare/" });

export default function ComparePage() {
  return <LolCompareView pair={getDefaultPair()} />;
}
