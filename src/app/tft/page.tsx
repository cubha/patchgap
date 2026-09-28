// src/app/tft/page.tsx
// TFT 브리핑 홈(최신 쌍). 본문은 `components/tft/TftBriefing.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍
// `/tft/history/[pair]/`와 같은 본문을 쓰려고 옮겼다). 로드만 여기서 한다.
import TftBriefing from "@/components/tft/TftBriefing";
import { loadTft, loadTftDeclaration } from "@/lib/tftData";

export const metadata = { title: "전략적 팀 전투 — patchgap" };

export default function TftPage() {
  const bundle = loadTft();
  // 최신 쌍이 관측 stub이면 선언 축을 그린다(C13·C14).
  return <TftBriefing bundle={bundle} declaration={bundle ? null : loadTftDeclaration()} />;
}
