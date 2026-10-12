// src/app/tft/compare/page.tsx
// TFT 대조표(최신 쌍). 본문은 `components/tft/TftCompareView.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍
// `/tft/history/[pair]/compare/`와 같은 본문을 쓰려고 옮겼다). 로드만 여기서 한다.
import TftCompareView from "@/components/tft/TftCompareView";
import { pageMeta } from "@/lib/meta";
import { pairSectionLink } from "@/lib/pairRoutes";
import { latestObservedTftPair, loadTft, loadTftDeclaration } from "@/lib/tftData";

export const metadata = pageMeta({ game: "tft", screen: "compare", path: "/tft/compare/" });

export default function TftComparePage() {
  const bundle = loadTft();
  if (bundle) return <TftCompareView bundle={bundle} declaration={null} />;
  // 관측 전(ST-16): 관측이 있는 최신 쌍의 대조표로 가는 링크를 함께 준다 — 헤더 select 말고도 길이 있어야 한다.
  const observed = latestObservedTftPair();
  return (
    <TftCompareView
      bundle={null}
      declaration={loadTftDeclaration()}
      observed={observed ? pairSectionLink("tft", observed.pair, observed.isLatest, "compare", "대조표") : null}
    />
  );
}
