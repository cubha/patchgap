// src/components/pubg/PubgCompareTable.tsx
// PUBG 전체 판정표 — 상태 필터 + 정렬. LoL 대조표(`CompareExplorer`)와 **같은 자리, 다른 구현**이다.
//
// **왜 CompareExplorer를 제네릭화하지 않았나**(PLAN-game-switcher-2026-09-17 X3): 그 컴포넌트는
// `DeltaRecord`(챔피언·아이템 엔티티 + q값 + LLM causes + 라인)를 전제로 만들어졌고 테스트 2종
// (`compare/__tests__/logic.test.ts`·`render.test.tsx`)이 그 형태에 걸려 있다. PUBG 행에는 q도
// causes도 라인도 **없다**. 제네릭화하면 양쪽 다 옵셔널투성이가 되고 LoL 테스트가 흔들린다.
// 원자 컴포넌트(FilterPill·StatusBadge)만 공유하고 표는 따로 쓴다.
//
// **없는 열은 만들지 않는다**: q(BH-FDR 보정 p) 열이 없는 이유는 PUBG 판정이 효과크기 바닥 +
// Wilson CI 방식이라 q를 계산하지 않기 때문이다. 0이나 빈칸으로 채우면 "무근거 문장은 회색"
// 원칙 위반(있지도 않은 값을 있는 척)이라 열 자체를 두지 않는다.
"use client";

import { useMemo, useState } from "react";
import FilterPill from "@/components/FilterPill";
import StatusBadge from "@/components/StatusBadge";
import { signedPct } from "@/components/pubg/shared";
import type { PubgDeltaRow } from "@/pipeline/match/pubg-delta";

/** PUBG에 실제로 나타나는 상태만 올린다 — LoL의 `indirect-effect`는 PUBG 판정기에 없다. */
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "unannounced", label: "미공지" },
  { key: "announced", label: "공지 대조" },
  { key: "below-threshold", label: "바닥 미달" },
  { key: "no-change", label: "변화 없음" },
  { key: "insufficient-sample", label: "표본 부족" },
] as const;

type SortKey = "effect" | "share" | "name";

function matches(row: PubgDeltaRow, key: string): boolean {
  if (key === "all") return true;
  if (key === "announced") return row.status.startsWith("announced-");
  return row.status === key;
}

export interface PubgCompareTableProps {
  rows: PubgDeltaRow[];
}

export default function PubgCompareTable({ rows }: PubgCompareTableProps) {
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("effect");

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => matches(row, filter));
    const sorted = [...filtered];
    if (sort === "effect") sorted.sort((a, b) => Math.abs(b.relChange ?? 0) - Math.abs(a.relChange ?? 0));
    else if (sort === "share") sorted.sort((a, b) => (b.after ?? 0) - (a.after ?? 0));
    else sorted.sort((a, b) => a.weaponName.localeCompare(b.weaponName));
    return sorted;
  }, [rows, filter, sort]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of FILTERS) out[f.key] = rows.filter((row) => matches(row, f.key)).length;
    return out;
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="상태 필터">
          {FILTERS.map((f) => (
            <FilterPill key={f.key} selected={f.key === filter} onClick={() => setFilter(f.key)}>
              {f.label} {counts[f.key] ?? 0}
            </FilterPill>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2">
          <span className="text-xs font-bold text-muted">정렬</span>
          <select
            className="min-h-8 rounded-sm border border-border bg-surface px-2 text-xs font-bold text-fg"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="effect">변화 크기순</option>
            <option value="share">43.1 점유율순</option>
            <option value="name">이름순</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: "var(--table-min)" }}>
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 pl-1 font-mono text-xs font-bold text-muted">무기</th>
              <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">42.3 점유율</th>
              <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">43.1 점유율</th>
              <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">변화</th>
              <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">95% CI</th>
              <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">n (전→후)</th>
              <th className="py-2 pr-1 font-mono text-xs font-bold text-muted">판정</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b border-border-soft">
                <td className="py-2.5 pr-3 pl-1 font-display font-bold text-fg">{row.weaponName}</td>
                {/* 점유율이 null인 행은 그 패치에 관측 자체가 없었다는 뜻이다 — 0%로 적으면
                    "0번 주웠다"는 관측 주장이 되므로 값 없음(—)으로 구분한다. */}
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">
                  {row.before === null ? "—" : `${(row.before * 100).toFixed(2)}%`}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">
                  {row.after === null ? "—" : `${(row.after * 100).toFixed(2)}%`}
                </td>
                <td
                  className={`py-2.5 pr-3 text-right font-mono font-bold tabular-nums ${
                    row.status === "no-change" || row.status === "insufficient-sample"
                      ? "text-muted"
                      : (row.relChange ?? 0) > 0
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {signedPct(row.relChange ?? 0)}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-muted">
                  [{signedPct(row.relCi[0])}, {signedPct(row.relCi[1])}]
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-muted">
                  {row.n.before.toLocaleString()}→{row.n.after.toLocaleString()}
                </td>
                <td className="py-2.5 pr-1">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">이 상태에 해당하는 무기가 없습니다.</p>
      ) : null}
    </div>
  );
}
