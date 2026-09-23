// src/components/tft/TftCompareExplorer.tsx
// TFT 대조표 인터랙션 경계 — LoL `CompareExplorer`와 **같은 골격**(UX-BRIEF §8-3).
//
// 이 화면에는 칩도 검색도 정렬도 좌 내비도 없었다(§8-7 #7: 「상태 칩 … TFT 0」). 노트는 163건
// 있는데 「패치노트가 뭘 말했나」에서 출발하는 길만 없었던 것이다. 도구모음·내비·골격을 공용
// 컴포넌트로 받고, 표 본문(엔티티 행 × 지표 열)만 TFT 몫으로 남긴다 — 지표가 게임마다 다르므로
// 표까지 공용화하면 없는 열을 지어내야 한다(§8-0).
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import CompareSplit from "@/components/compare/CompareSplit";
import CompareToolbar from "@/components/compare/CompareToolbar";
import { useFilterHash } from "@/components/compare/useFilterHash";
import NoteNavPanel from "@/components/compare/NoteNavPanel";
import { useRowFocus } from "@/components/compare/useRowFocus";
import {
  countByFilter,
  matchesFilter,
  searchRows,
  sortRows,
  type CompareFilterKey,
  type CompareSortKey,
} from "@/components/compare/toolbarRules";
import {
  filterNoteNavGroups,
  groupNoteNavItems,
  noteNavSections,
  type NoteNavGroup,
  type NoteNavItem,
} from "@/components/compare/noteNav";
import ExternalLink from "@/components/ExternalLink";
import EntityIcon from "@/components/EntityIcon";
import StatusBadge from "@/components/StatusBadge";
import SubmarineCell from "@/components/gamedata/SubmarineCell";
import { TFT_METRICS, type TftEntityRow } from "@/components/tft/entityRows";
import { deltaDisplay, formatMetricValue } from "@/components/tft/shared";
import { entityTypeLabel, isLowerBetter, metricLabel } from "@/lib/format";
import { PANEL_SPLIT_BODY } from "@/lib/panelScroll";
import { tftEntityHref } from "@/lib/tftRoutes";
import { DISPLAY_SORT_PRIORITY, type DisplayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import type { DeltaMetric, PatchNoteItem } from "@/pipeline/types";

/** TFT 노트 섹션 → 화면 라벨. 「챔피언」이 아니라 「유닛」이다 — 이 게임의 어휘를 쓴다. */
const SECTION_LABEL: Record<string, string> = {
  champion: "유닛",
  item: "아이템",
  system: "체계",
};

export interface TftCompareExplorerProps {
  rows: TftEntityRow[];
  notes: PatchNoteItem[];
  /**
   * 자산이 실재하는 대상 키(`unit:DA_18_Rakan`). 배열로 받는다 — `Set`은 서버→클라이언트
   * 직렬화가 안 된다. 없는 자산은 요청조차 하지 않는다(404는 설계된 상태가 아니다).
   */
  assetKeys?: readonly string[];
}

/** 이 행의 지표들에 붙은 **검증된** LLM 원인 후보 수 — 미검증은 회색으로 떨어지므로 세지 않는다. */
function verifiedCauseCount(row: TftEntityRow): number {
  return TFT_METRICS.reduce(
    (sum, metric) => sum + (row.cells[metric]?.causes.filter((c) => c.verified).length ?? 0),
    0
  );
}

function MetricCell({ row, metric }: { row: TftEntityRow; metric: DeltaMetric }) {
  const record = row.cells[metric];
  if (!record) {
    // 관측이 없는 것과 0인 것은 다르다 — 빈 칸으로 그 사실을 말한다.
    return <span className="px-1 font-mono text-xs text-muted">—</span>;
  }
  const d = deltaDisplay(metric, record.delta ?? 0);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-fg-2">
        {formatMetricValue(metric, record.before ?? 0)} → {formatMetricValue(metric, record.after ?? 0)}
      </span>
      <span
        className={`whitespace-nowrap font-mono text-xs font-bold tabular-nums ${
          d.improved ? "text-success" : "text-danger"
        }`}
      >
        {d.text}
      </span>
    </div>
  );
}

/** 이 행이 짝지은 노트 id 전부 — 좌 내비 선택과 표 행을 잇는 열쇠. */
function matchedNoteIdsOf(row: TftEntityRow): string[] {
  const out = new Set<string>();
  for (const record of Object.values(row.cells)) {
    for (const id of record?.matchedNoteIds ?? []) out.add(id);
  }
  return [...out];
}

export default function TftCompareExplorer({ rows, notes, assetKeys = [] }: TftCompareExplorerProps) {
  const haveAssets = useMemo(() => new Set(assetKeys), [assetKeys]);
  const [filter, setFilter] = useState<CompareFilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CompareSortKey>("priority");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoteNavGroup | null>(null);

  // 타일 → 칩 착지(§8-1). 이 화면에만 없어서 TFT만 「전체」에 떨어졌다(2026-09-23 렌더 실측).
  useFilterHash(setFilter);

  const counts = useMemo(() => countByFilter(rows, (r) => r.status), [rows]);

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => matchesFilter(r.status, filter));
    const searched = searchRows(filtered, query, (r) => r.name);
    return sortRows(searched, sort, {
      statusOf: (r) => r.status,
      effectOf: (r) => r.strength,
      nameOf: (r) => r.name,
    });
  }, [rows, filter, query, sort]);

  const navGroups = useMemo(() => {
    const items: NoteNavItem[] = notes.map((n) => ({
      id: n.id,
      entity: n.entity,
      section: n.section,
      sectionLabel: SECTION_LABEL[n.section] ?? n.section,
      summary: n.summary,
      detail: n.skill ?? n.stat,
    }));
    return groupNoteNavItems(items);
  }, [notes]);

  const sections = useMemo(() => noteNavSections(navGroups), [navGroups]);
  const visibleNav = useMemo(
    () => filterNoteNavGroups(navGroups, activeSection, query),
    [navGroups, activeSection, query]
  );

  /** 노트 id → 그 노트를 짝지은 행 — 내비 배지와 포커스가 같은 색인을 본다. */
  const rowByNoteId = useMemo(() => {
    const map = new Map<string, TftEntityRow>();
    for (const row of rows) for (const id of matchedNoteIdsOf(row)) if (!map.has(id)) map.set(id, row);
    return map;
  }, [rows]);

  const focusKey = useMemo(() => {
    if (!selected) return null;
    for (const item of selected.items) {
      const row = rowByNoteId.get(item.id);
      if (row && visible.some((r) => r.key === row.key)) return row.key;
    }
    return null;
  }, [selected, rowByNoteId, visible]);

  /**
   * 내비 묶음의 배지 — **보고 가능한 관측만** 본다(LoL `navBadgeStatus`와 같은 잣대).
   * 표와 내비가 서로 다른 중요도를 주장하면 화면이 스스로를 반박한다.
   */
  const navStatusOf = (group: NoteNavGroup): DisplayStatus | null => {
    let best: DisplayStatus | null = null;
    for (const item of group.items) {
      const row = rowByNoteId.get(item.id);
      if (!row) continue;
      const reportable = Object.values(row.cells).some((r) => r && isReportableRecord(r));
      if (!reportable) continue;
      if (best === null || DISPLAY_SORT_PRIORITY[row.status] < DISPLAY_SORT_PRIORITY[best]) {
        best = row.status;
      }
    }
    return best;
  };

  const showSubmarine = rows.some(
    (row) => row.submarineChanges.length > 0 || row.mismatchChanges.length > 0
  );
  const { scrollerRef, headRef } = useRowFocus<HTMLDivElement, HTMLTableSectionElement>(focusKey);

  const thBase =
    "sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-3 text-left shadow-[inset_0_-1px_0_var(--border-soft)] font-body text-xs font-bold text-muted";

  return (
    <div className="flex flex-col gap-6">
      <CompareToolbar
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="유닛·아이템 검색"
        sort={sort}
        onSortChange={setSort}
      />
      <CompareSplit
        title="선언 ↔ 관측"
        meta={`${visible.length}개 대상`}
        nav={
          <NoteNavPanel
            groups={visibleNav}
            sections={sections}
            activeSection={activeSection}
            onSectionChange={(section) =>
              setActiveSection((current) => (current === section ? null : section))
            }
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            statusOf={navStatusOf}
          />
        }
        notice={
          selected !== null && focusKey === null
            ? `${selected.entity} — 이 표에 행이 없습니다(보고 자격을 얻은 관측이 없거나 현재 필터에서 빠졌습니다).`
            : null
        }
      >
        <div ref={scrollerRef} className={`overflow-x-auto ${PANEL_SPLIT_BODY}`}>
          <table className="w-full border-collapse text-sm">
            <thead ref={headRef}>
              <tr>
                <th className={thBase}>대상</th>
                {TFT_METRICS.map((m) => (
                  <th key={m} className={thBase}>
                    {metricLabel(m)}
                    {isLowerBetter(m) ? <span className="ml-1 font-normal">(낮을수록 좋음)</span> : null}
                  </th>
                ))}
                {/* 「바뀐 것」 — 수치 축(F9). 지표 열이 "지표가 어떻게 움직였나"를 말하면
                    이 열은 "게임사가 무엇을 바꿨나"를 말한다. */}
                {(showSubmarine ? ["바뀐 것", "판정", "근거"] : ["판정", "근거"]).map((h) => (
                  <th key={h} className={thBase}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.key}
                  data-entity-key={row.key}
                  className={`border-t border-border-soft align-top ${
                    row.key === focusKey ? "row-highlight" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    {/* 아이콘은 LoL 대조표(`DeltaTable`)와 같은 자리다 — TFT만 비어 있었다. */}
                    <Link href={tftEntityHref(row.key)} className="flex items-center gap-3 group">
                      <EntityIcon
                        game="tft"
                        entityType={row.entityType}
                        entityKey={row.key.slice(row.key.indexOf(":") + 1)}
                        name={row.name}
                        size={40}
                        assetMissing={!haveAssets.has(row.key)}
                      />
                      {/* `whitespace-nowrap`이 표를 넓히는 장치다 — 표는 이미
                          `overflow-auto` 안에 있으므로 min-content가 뷰포트를 넘으면 **가로로
                          스크롤**된다. 없으면 390px에서 칸이 16px로 눌려 이름이 세로로 한 글자씩
                          쌓였다(2026-09-23 렌더 실측). `min-width` 하한만으로는 못 막는다 —
                          640px÷열수가 이름 길이보다 작아 같은 증상이 남는다. */}
                      <span className="flex flex-col gap-0.5">
                        <span className="font-bold whitespace-nowrap text-fg group-hover:text-accent">{row.name}</span>
                        <span className="font-mono text-xs tracking-wider whitespace-nowrap text-muted uppercase">
                          {entityTypeLabel(row.entityType)}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {TFT_METRICS.map((m) => (
                    <td key={m} className="px-4 py-3">
                      <MetricCell row={row} metric={m} />
                    </td>
                  ))}
                  {showSubmarine ? (
                    <td className="px-4 py-3">
                      <SubmarineCell changes={row.submarineChanges} mismatchChanges={row.mismatchChanges} />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {row.noteAnchor ? (
                        <ExternalLink href={row.noteAnchor} className="font-mono text-xs text-accent hover:underline">
                          원문 ↗
                        </ExternalLink>
                      ) : (
                        // 무근거 회색 — 지어낸 근거를 만들지 않는다.
                        <span className="font-mono text-xs text-muted">—</span>
                      )}
                      {/* 원인 **문장**은 표에 넣지 않는다 — 산문을 칸에 밀어넣으면 행 높이가
                          제각각이 된다. "있다"는 사실만 알리고 읽을 자리(상세)로 보낸다. */}
                      {verifiedCauseCount(row) > 0 ? (
                        <Link href={tftEntityHref(row.key)} className="font-mono text-xs whitespace-nowrap text-accent hover:underline">
                          추정 원인 {verifiedCauseCount(row)}
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">이 조건에 해당하는 대상이 없습니다.</p>
          ) : null}
        </div>
      </CompareSplit>
    </div>
  );
}
