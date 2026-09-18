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
  // 2026-09-18 라운드6(사용자 C5·C1): 미공지 = `unannounced` + `indirect-effect`(같은 뿌리) 한 숫자.
  // 표본 부족·바닥 미달은 표에 올리지 않으므로 여기서도 세지 않는다 — 방법론이 그 규칙을 말한다.
  const gapCount = stats.unannouncedCount + stats.indirectEffectCount;
  return (
    <div className="border-t border-border-soft px-5 py-4 text-sm text-muted">
      노트 <strong className="font-bold text-fg">{fmtInt(stats.noteEntityCount)}</strong>엔티티(
      <strong className="font-bold text-fg">{fmtInt(stats.noteItemCount)}</strong>항목) 중 관측 짝{" "}
      <strong className="font-bold text-fg">{fmtInt(stats.matchedCount)}</strong> · 미공지{" "}
      <strong className="font-bold text-fg">{fmtInt(gapCount)}</strong>
    </div>
  );
}
