// src/components/compare/CoverageBar.tsx
// LoL 대조표 커버리지 — 2026-10-08(ST-18)부터 **세 게임 공용 `CoverageSection`**의 얇은 어댑터다. `CoverageStats`(LoL 집계)를
// 공용 블록의 네 수로 옮길 뿐, 문구·모양은 `CoverageSection`이 소유한다(전에는 LoL만 표 바닥 한 줄이라 브리핑이 가리키는
// "대조표 아래 커버리지"가 게임마다 다른 모양이었다 — site-review parity-S14).
//
// 2026-09-18 라운드6(사용자 C5·C1): 미공지 = `unannounced` + `indirect-effect`(같은 뿌리) 한 숫자. 표본 부족·바닥 미달은 표에
// 올리지 않으므로 여기서도 세지 않는다 — 방법론이 그 규칙을 말한다. 단위는 **엔티티**(재판정 보완 4).

import type { CoverageStats } from "./logic";
import CoverageSection from "./CoverageSection";

export interface CoverageBarProps {
  stats: CoverageStats;
}

export default function CoverageBar({ stats }: CoverageBarProps) {
  return (
    <CoverageSection
      noteEntities={stats.noteEntityCount}
      noteItems={stats.noteItemCount}
      matched={stats.matchedCount}
      gap={stats.gapEntityCount}
    />
  );
}
