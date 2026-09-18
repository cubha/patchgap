// src/components/compare/CoverageBar.tsx
// 하단 커버리지 바 — 프로토타입 `.summary-bar` 1:1(docs/design/prototype/02-comparison-table.html).
// 순수 렌더(상태 없음) — 부모(CompareExplorer)가 필터/검색과 무관하게 전체 델타 기준으로
// 미리 계산한 수치를 그대로 받는다(ST-11.md "구현 결정" 참고 — 프로토타입의 값도 현재 필터와
// 무관한 고정 총계다).

import { fmtInt } from "@/lib/format";
import type { CoverageStats } from "./logic";

export interface CoverageBarProps {
  stats: CoverageStats;
}

export default function CoverageBar({ stats }: CoverageBarProps) {
  return (
    <div className="border-t border-border-soft px-5 py-4 text-sm text-muted">
      노트 <strong className="font-bold text-fg">{fmtInt(stats.noteEntityCount)}</strong>엔티티(
      <strong className="font-bold text-fg">{fmtInt(stats.noteItemCount)}</strong>항목) 중 관측 짝{" "}
      <strong className="font-bold text-fg">{fmtInt(stats.matchedCount)}</strong> · 미공지{" "}
      <strong className="font-bold text-fg">{fmtInt(stats.unannouncedCount)}</strong> · 간접 영향{" "}
      <strong className="font-bold text-fg">{fmtInt(stats.indirectEffectCount)}</strong> · 표본 부족{" "}
      <strong className="font-bold text-fg">{fmtInt(stats.lowSampleCount)}</strong> · 바닥 미달{" "}
      <strong className="font-bold text-fg">{fmtInt(stats.belowThresholdCount)}</strong>
    </div>
  );
}
