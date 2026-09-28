// src/app/lol/page.tsx
// LoL 브리핑 홈 — **최신 쌍**. 본문은 `components/home/LolBriefing.tsx`가 소유한다(과거 쌍 라우트
// `/lol/history/[pair]/`와 같은 본문을 쓰려고 2026-09-28 PR-C B3에서 옮겼다).
// 헤더는 ST-10부터 src/app/layout.tsx가 전역 렌더한다(여기서 다시 렌더하면 중복).
import LolBriefing from "@/components/home/LolBriefing";
import { getDefaultPair } from "@/lib/data";

export default function Home() {
  return <LolBriefing pair={getDefaultPair()} />;
}
