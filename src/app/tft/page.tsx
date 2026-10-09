// src/app/tft/page.tsx
// TFT 브리핑 홈(최신 쌍). 본문은 `components/tft/TftBriefing.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍
// `/tft/history/[pair]/`와 같은 본문을 쓰려고 옮겼다). 로드만 여기서 한다.
import TftBriefing from "@/components/tft/TftBriefing";
import { loadTft, loadTftDeclaration, newerTftDeclarations } from "@/lib/tftData";

export const metadata = { title: "전략적 팀 전투 — patchgap" };

export default function TftPage() {
  // 홈 = 관측이 있는 최신 쌍(PLAN-home-observed-pair, 2026-10-09). 더 새 패치노트(관측 stub)는 배너로 말한다.
  // 관측 쌍이 하나도 없을 때만 최신 stub의 선언 뷰가 홈이다(C13·C14 — 빈 화면보다 낫다).
  const bundle = loadTft();
  return <TftBriefing bundle={bundle} declaration={bundle ? null : loadTftDeclaration()} newer={bundle ? newerTftDeclarations() : []} />;
}
