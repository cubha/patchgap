// src/components/home/LaneGapPanel.tsx
// 라인별 미공지 분포 패널 — HANDOFF-redesign-2026-09-10.md §4-1 "라인별 미공지 분포 패널 —
// 사이드". 순수 렌더(서버 컴포넌트) — 집계는 src/components/home/laneDistribution.ts(ST-C)가
// 담당하고, 이 컴포넌트는 이미 계산된 LaneDistributionRow[]만 받는다.
//
// variant="glass"(2026-09-12·5차, R6 재지적): 카메라 밴드 한정 유리화(옵션 B)가 인접 패널과
// 이질감을 만든다는 지적으로 홈의 모든 패널을 유리화하는 쪽으로 바뀌었다 — ReleaseNoteStream.tsx
// 주석 참고.

import LaneGlyph from "@/components/LaneGlyph";
import SectionCard from "@/components/SectionCard";
import { fmtInt } from "@/lib/format";
import type { LaneDistributionRow } from "./laneDistribution";

export interface LaneGapPanelProps {
  rows: LaneDistributionRow[];
  /** 분포가 Gap 총계 중 다루는 범위(`laneDistributionScope`) — 바닥 한 줄. 없으면 그리지 않는다. */
  scope?: { gapTotal: number; covered: number; other: number } | null;
}

export default function LaneGapPanel({ rows, scope = null }: LaneGapPanelProps) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <SectionCard eyebrow="라인별 괴리" title="미공지 분포" variant="glass">
      {total === 0 ? (
        <p className="p-5 text-sm text-muted">이 패치 쌍에서는 라인별로 집계할 미공지 변화가 없습니다</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.lane}
              className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-3 last:border-b-0"
            >
              <span className="flex items-center gap-2 text-sm text-fg-2">
                <LaneGlyph lane={row.lane} size={16} labelled />
                {row.label}
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-fg">{fmtInt(row.count)}</span>
            </li>
          ))}
        </ul>
      )}
      {scope ? (
        <p data-lane-scope className="border-t border-border-soft px-5 py-3 text-xs leading-relaxed text-muted">
          미공지 Gap <strong className="text-fg-2">{fmtInt(scope.gapTotal)}</strong> 중 라인 구분{" "}
          <strong className="text-fg-2">{fmtInt(scope.covered)}</strong>대상 · 그 밖(밴률·아이템·수치 축){" "}
          <strong className="text-fg-2">{fmtInt(scope.other)}</strong>대상
        </p>
      ) : null}
    </SectionCard>
  );
}
