// src/components/item/StatsGatePanel.tsx
// 항목 상세 "통계 게이트"(ST-12 ③) — n(전/후)·CI·q·판정 규칙 링크 + 승률이면 게이트 값 표시.
//
// 편차: 프로토타입 03은 "Wilson 95% CI(전)"/"Wilson 95% CI(후)"를 각각 표시하지만, DeltaRecord
// 스키마엔 전/후 개별 CI가 없고 "차이(delta)"의 CI 하나만 있다(ST-08 확정 계약) — 그래서 이
// 패널은 "관측 델타 CI(95%)" 한 줄로 표시한다(ST-12.md에 편차로 기록).

import { fmtCiHalf, fmtInt } from "@/lib/format";
import { WIN_RATE_MIN_N, passesSampleGate } from "@/pipeline/aggregate/stats";
import type { DeltaRecord, Interval } from "@/pipeline/types";
import type { MetricKind } from "./metricFormat";

export interface StatsGatePanelProps {
  delta: DeltaRecord;
  kind: MetricKind;
}

function scaledCi(ci: Interval, kind: MetricKind): Interval {
  const scale = kind === "pp" ? 100 : 1;
  return [ci[0] * scale, ci[1] * scale];
}

export default function StatsGatePanel({ delta, kind }: StatsGatePanelProps) {
  const ciUnit = kind === "pp" ? "%p" : kind === "sec" ? "s" : "";
  const digits = kind === "pp" ? 1 : 0;
  const ci = scaledCi(delta.ci, kind);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">n(전)</span>
          <span className="font-mono text-base tabular-nums text-fg">{fmtInt(delta.n.before)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">n(후)</span>
          <span className="font-mono text-base tabular-nums text-fg">{fmtInt(delta.n.after)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">관측 델타 CI(95%)</span>
          <span className="font-mono text-base tabular-nums text-fg">
            {fmtCiHalf(ci, digits)}
            {ciUnit}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">BH-FDR q</span>
          <span className="font-mono text-base tabular-nums text-fg">
            {delta.q === null ? "—" : delta.q.toFixed(3)}
          </span>
        </div>
        {delta.metric === "winRate" ? (
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted">승률 최소 표본 게이트</span>
            <span className="font-mono text-sm tabular-nums text-fg">
              n≥{WIN_RATE_MIN_N} ·{" "}
              {passesSampleGate(delta.n.before, delta.n.after) ? "통과" : "미달"}
            </span>
          </div>
        ) : null}
      </div>
      <div className="px-5 pb-5">
        <a href="/lol/methodology/#gates" className="text-sm font-bold text-accent hover:underline">
          판정 규칙 보기 →
        </a>
      </div>
    </div>
  );
}
