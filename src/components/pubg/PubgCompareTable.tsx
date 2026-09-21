// src/components/pubg/PubgCompareTable.tsx
// PUBG 판정표 — 상태 필터 + 정렬. LoL 대조표(`CompareExplorer`)와 **같은 자리, 다른 구현**이다.
//
// **왜 CompareExplorer를 제네릭화하지 않았나**(PLAN-game-switcher-2026-09-17 X3): 그 컴포넌트는
// `DeltaRecord`(챔피언·아이템 엔티티 + q값 + LLM causes + 라인)를 전제로 만들어졌다. PUBG 행에는 q도
// causes도 라인도 없다. 원자 컴포넌트(FilterPill·StatusBadge)만 공유하고 표는 따로 쓴다.
//
// 2026-09-18 라운드6(사용자 C1·C5·P1): **판정이 선 무기만** 올린다 — 바닥 미달·변화 없음·표본 부족은
// 표시하지 않는다(그 규칙은 방법론이 말한다). 칩은 전체/공지/미공지 3종, 배지는 표시 키(공지 / 공지 ·
// 이상 관측 / 미공지), 무기명은 상세 링크다(진입점 부재 지적).
//
// **없는 열은 만들지 않는다**: q(BH-FDR 보정 p) 열이 없는 이유는 PUBG 판정이 효과크기 바닥 + Wilson CI
// 방식이라 q를 계산하지 않기 때문이다.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FilterPill from "@/components/FilterPill";
import StatusBadge from "@/components/StatusBadge";
import { signedPct } from "@/components/pubg/shared";
import { isReportable, pubgDisplayStatus } from "@/pipeline/shared/pubg-status";
import { weaponHref } from "@/lib/pubgRoutes";
import type { PubgDeltaRow } from "@/pipeline/match/pubg-delta";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "announced", label: "공지" },
  { key: "unannounced", label: "미공지" },
] as const;

type SortKey = "effect" | "share" | "name";

function matches(row: PubgDeltaRow, key: string, submarine: boolean): boolean {
  if (key === "all") return true;
  // 잠수함은 수치 축 미공지다 — "미공지" 칩에 함께 든다(지표 축 미공지와 배지로만 갈린다).
  if (key === "announced") return !submarine && row.status.startsWith("announced-");
  return submarine || row.status === key;
}

export interface PubgCompareTableProps {
  rows: PubgDeltaRow[];
  /** 수치 축(F9)에서 잠수함 변경이 잡힌 무기의 정준키. 그 행은 배지가 `submarine`으로 덮인다. */
  submarineKeys?: readonly string[];
}

export default function PubgCompareTable({ rows, submarineKeys = [] }: PubgCompareTableProps) {
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("effect");
  const submarineSet = useMemo(() => new Set(submarineKeys), [submarineKeys]);

  // 노이즈 상태(바닥 미달·변화 없음·표본 부족)는 이 표에 없다(C1).
  const judged = useMemo(() => rows.filter((row) => isReportable(row.status)), [rows]);

  const visible = useMemo(() => {
    const filtered = judged.filter((row) => matches(row, filter, submarineSet.has(row.weaponKey)));
    const sorted = [...filtered];
    if (sort === "effect") sorted.sort((a, b) => Math.abs(b.relChange ?? 0) - Math.abs(a.relChange ?? 0));
    else if (sort === "share") sorted.sort((a, b) => (b.after ?? 0) - (a.after ?? 0));
    else sorted.sort((a, b) => a.weaponName.localeCompare(b.weaponName));
    return sorted;
  }, [judged, filter, sort, submarineSet]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of FILTERS)
      out[f.key] = judged.filter((row) => matches(row, f.key, submarineSet.has(row.weaponKey))).length;
    return out;
  }, [judged, submarineSet]);

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

      {/* 무기 수가 늘어도 페이지가 아니라 이 안에서 스크롤한다(@/lib/panelScroll). */}
      <div className={`overflow-x-auto ${PANEL_SCROLL_BODY}`}>
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
                <td className="py-2.5 pr-3 pl-1 font-display font-bold">
                  <Link href={weaponHref(row.weaponKey)} className="text-fg underline-offset-4 hover:text-accent hover:underline">
                    {row.weaponName} →
                  </Link>
                </td>
                {/* 점유율이 null인 행은 그 패치에 관측 자체가 없었다는 뜻이다 — 0%로 적지 않는다. */}
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">
                  {row.before === null ? "—" : `${(row.before * 100).toFixed(2)}%`}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">
                  {row.after === null ? "—" : `${(row.after * 100).toFixed(2)}%`}
                </td>
                <td
                  className={`py-2.5 pr-3 text-right font-mono font-bold tabular-nums ${
                    (row.relChange ?? 0) > 0 ? "text-success" : "text-danger"
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
                  <StatusBadge status={pubgDisplayStatus(row.status, submarineSet.has(row.weaponKey))} />
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
