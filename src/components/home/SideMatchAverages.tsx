// src/components/home/SideMatchAverages.tsx
// 사이드: 매치 평균 — 프로토타입 `.side-metric-row` 1:1(docs/design/prototype/01-briefing-home.html).
// ST-11 프롬프트 범위: summary.avgDurationSec + objectives(dragon/herald/baron/tower firstSec
// 평균) 전 패치 대비 델타 5행(프로토타입은 골드@14를 포함한 5행이지만, 이 SubTask 프롬프트가
// 명시한 데이터 집합은 avgDurationSec + 오브젝트 4종뿐이라 라인 골드 행은 제외했다 — ST-11.md
// "구현 결정" 참고). 서버 컴포넌트.

import type { ObjectiveStat, PatchSummary } from "@/pipeline/types";
import { fmtSec } from "@/lib/format";
import SectionCard from "@/components/SectionCard";
import DeltaValue from "@/components/DeltaValue";

export interface SideMatchAveragesProps {
  summaryTo: PatchSummary | null;
  summaryFrom: PatchSummary | null;
  objectivesTo: ObjectiveStat | null;
  objectivesFrom: ObjectiveStat | null;
}

interface Row {
  label: string;
  to: number | null;
  from: number | null;
}

export default function SideMatchAverages({
  summaryTo,
  summaryFrom,
  objectivesTo,
  objectivesFrom,
}: SideMatchAveragesProps) {
  const rows: Row[] = [
    { label: "경기 시간", to: summaryTo?.avgDurationSec ?? null, from: summaryFrom?.avgDurationSec ?? null },
    {
      label: "첫 용 평균 시각",
      to: objectivesTo?.firstDragonSecAvg ?? null,
      from: objectivesFrom?.firstDragonSecAvg ?? null,
    },
    {
      label: "첫 전령 평균 시각",
      to: objectivesTo?.firstHeraldSecAvg ?? null,
      from: objectivesFrom?.firstHeraldSecAvg ?? null,
    },
    {
      label: "첫 바론 평균 시각",
      to: objectivesTo?.firstBaronSecAvg ?? null,
      from: objectivesFrom?.firstBaronSecAvg ?? null,
    },
    {
      label: "첫 포탑 평균 시각",
      to: objectivesTo?.firstTowerSecAvg ?? null,
      from: objectivesFrom?.firstTowerSecAvg ?? null,
    },
  ];

  return (
    <SectionCard title="매치 평균" variant="glass">
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-3 last:border-b-0"
          >
            <span className="text-sm text-fg-2">{row.label}</span>
            {row.to === null ? (
              <span className="font-mono text-sm tabular-nums text-muted">—</span>
            ) : (
              <span className="inline-flex items-baseline gap-2 font-mono text-sm tabular-nums">
                {fmtSec(row.to)}
                {row.from !== null ? (
                  <DeltaValue delta={row.to - row.from} kind="sec" endpoints={{ before: row.from, after: row.to }} />
                ) : null}
              </span>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
