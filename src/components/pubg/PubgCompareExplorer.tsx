// src/components/pubg/PubgCompareExplorer.tsx
// PUBG 대조표 인터랙션 경계 — LoL·TFT 대조표와 **같은 골격**(UX-BRIEF §8-3).
//
// 전신은 `PubgCompareTable.tsx`였고, 그 파일은 자기 칩(3종)·자기 정렬 셀렉트를 직접 들고 있었다.
// 그래서 같은 메뉴인데 칩 수도 정렬 키도 게임마다 달랐고 검색은 아예 없었다(§8-7 #7). 이제 칩·
// 개수·검색·정렬은 `CompareToolbar`가, 좌 내비와 2컬럼 골격은 `NoteNavPanel`·`CompareSplit`이
// 소유한다. 여기 남는 것은 **PUBG 고유의 연결**이다 — 무기 행, 점유율 열, 잠수함 색인.
//
// **없는 열은 만들지 않는다**: q(BH-FDR 보정 p) 열이 없는 이유는 PUBG 판정이 효과크기 바닥 +
// Wilson CI 방식이라 q를 계산하지 않기 때문이다.
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
} from "@/components/compare/noteNav";
import { pubgNoteNavItems, weaponKeyOfNavItem } from "@/components/pubg/noteNav";
import StatusBadge from "@/components/StatusBadge";
import SubmarineCell from "@/components/gamedata/SubmarineCell";
import { signedPct } from "@/components/pubg/shared";
import { isReportable, pubgDisplayStatus } from "@/pipeline/shared/pubg-status";
import { weaponHref } from "@/lib/pubgRoutes";
import { publicWeaponPath } from "@/pipeline/pubg/asset-path";
import type { GameDataChange } from "@/pipeline/gamedata/types";
import type { PubgDeltaRow, PubgNoteItem } from "@/pipeline/match/pubg-delta";
import { PANEL_SPLIT_BODY } from "@/lib/panelScroll";
import type { DisplayStatus } from "@/pipeline/shared/display-status";

export interface PubgCompareExplorerProps {
  rows: PubgDeltaRow[];
  notes: PubgNoteItem[];
  fromLabel: string;
  toLabel: string;
  /**
   * 공식 렌더를 가진 무기 정준키. LoL·TFT 대조표 행에는 아이콘이 있는데 이 표만 없었다 —
   * 자산은 이미 조달돼 있었다(`public/pubg/weapon/`). 없는 무기는 요청하지 않는다.
   */
  assetKeys?: readonly string[];
  /**
   * 수치 축(F9)에서 잡힌 **잠수함 변경 그 자체**. 배지만 덮는 게 아니라 무엇이 바뀌었는지 말한다.
   * 서버가 넘기는 평문 배열이라 클라이언트 경계를 그대로 건넌다(색인은 여기서 만든다).
   */
  submarineChanges?: readonly GameDataChange[];
  /** 노트가 말했는데 값이 어긋난 변경. 잠수함과 같은 칸에 그린다. */
  mismatchChanges?: readonly GameDataChange[];
}

function byEntityKey(changes: readonly GameDataChange[]): Map<string, GameDataChange[]> {
  const map = new Map<string, GameDataChange[]>();
  for (const change of changes) {
    const list = map.get(change.entityKey);
    if (list) list.push(change);
    else map.set(change.entityKey, [change]);
  }
  return map;
}

export default function PubgCompareExplorer({
  rows,
  notes,
  fromLabel,
  toLabel,
  assetKeys = [],
  submarineChanges = [],
  mismatchChanges = [],
}: PubgCompareExplorerProps) {
  const [filter, setFilter] = useState<CompareFilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CompareSortKey>("priority");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoteNavGroup | null>(null);

  // 타일 → 칩 착지는 `useFilterHash`가 소유한다(세 게임 공통 — 사본 금지).
  useFilterHash(setFilter);

  const haveAssets = useMemo(() => new Set(assetKeys), [assetKeys]);
  const submarineByKey = useMemo(() => byEntityKey(submarineChanges), [submarineChanges]);
  const mismatchByKey = useMemo(() => byEntityKey(mismatchChanges), [mismatchChanges]);
  const showSubmarine = submarineByKey.size > 0 || mismatchByKey.size > 0;

  // 노이즈 상태(바닥 미달·변화 없음·표본 부족)는 이 표에 없다(라운드6 C1).
  const judged = useMemo(() => rows.filter((row) => isReportable(row.status)), [rows]);

  /** 표시 키 — 잠수함이면 수치 축 미공지로 덮는다(증거 등급이 더 높다). */
  const statusOf = useMemo(
    () => (row: PubgDeltaRow): DisplayStatus =>
      pubgDisplayStatus(row.status, submarineByKey.has(row.weaponKey)),
    [submarineByKey]
  );

  const counts = useMemo(() => countByFilter(judged, statusOf), [judged, statusOf]);

  const visible = useMemo(() => {
    const filtered = judged.filter((row) => matchesFilter(statusOf(row), filter));
    const searched = searchRows(filtered, query, (r) => r.weaponName);
    return sortRows(searched, sort, {
      statusOf,
      effectOf: (r) => r.relChange ?? 0,
      nameOf: (r) => r.weaponName,
    });
  }, [judged, filter, query, sort, statusOf]);

  const nameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.weaponKey, row.weaponName);
    return map;
  }, [rows]);

  const navGroups = useMemo(
    () => groupNoteNavItems(pubgNoteNavItems(notes, (k) => nameByKey.get(k) ?? null)),
    [notes, nameByKey]
  );
  const sections = useMemo(() => noteNavSections(navGroups), [navGroups]);
  const visibleNav = useMemo(
    () => filterNoteNavGroups(navGroups, activeSection, query),
    [navGroups, activeSection, query]
  );

  /** 내비 묶음 → 표 행. PUBG는 노트가 **무기 키**를 직접 들고 있어 이름이 아니라 키로 잇는다. */
  const rowOfGroup = (group: NoteNavGroup): PubgDeltaRow | null => {
    for (const item of group.items) {
      const key = weaponKeyOfNavItem(item.id);
      const hit = key === null ? null : judged.find((r) => r.weaponKey === key);
      if (hit) return hit;
    }
    return null;
  };

  const focusRow = selected ? rowOfGroup(selected) : null;
  const focusKey = focusRow && visible.some((r) => r.weaponKey === focusRow.weaponKey)
    ? focusRow.weaponKey
    : null;
  const { scrollerRef, headRef } = useRowFocus<HTMLDivElement, HTMLTableSectionElement>(focusKey);

  const thBase =
    "sticky top-0 z-10 whitespace-nowrap bg-surface px-3 py-2 shadow-[inset_0_-1px_0_var(--border-soft)] font-mono text-xs font-bold text-muted";

  return (
    <div className="flex flex-col gap-6">
      <CompareToolbar
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="무기 검색"
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
            statusOf={(group) => {
              const row = rowOfGroup(group);
              return row ? statusOf(row) : null;
            }}
          />
        }
        notice={
          selected !== null && focusKey === null
            ? `${selected.entity} — 이 표에 행이 없습니다(판정이 서지 않았거나 현재 필터에서 빠졌습니다).`
            : null
        }
      >
        <div ref={scrollerRef} className={`overflow-x-auto ${PANEL_SPLIT_BODY}`}>
          <table className="w-full border-collapse text-sm" style={{ minWidth: "var(--table-min)" }}>
            <thead ref={headRef}>
              <tr className="text-left">
                <th className={`${thBase} pl-4`}>무기</th>
                <th className={`${thBase} text-right`}>{fromLabel} 점유율</th>
                <th className={`${thBase} text-right`}>{toLabel} 점유율</th>
                <th className={`${thBase} text-right`}>변화</th>
                <th className={`${thBase} text-right`}>95% CI</th>
                <th className={`${thBase} text-right`}>n (전→후)</th>
                {showSubmarine ? <th className={thBase}>바뀐 것</th> : null}
                <th className={`${thBase} pr-4`}>판정</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  data-entity-key={row.weaponKey}
                  className={`border-b border-border-soft ${
                    row.weaponKey === focusKey ? "row-highlight" : ""
                  }`}
                >
                  <td className="py-2.5 pr-3 pl-4 font-display font-bold">
                    <Link
                      href={weaponHref(row.weaponKey)}
                      className="flex items-center gap-3 text-fg underline-offset-4 hover:text-accent hover:underline"
                    >
                      {haveAssets.has(row.weaponKey) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={publicWeaponPath(row.weaponKey)}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="h-8 w-16 object-contain"
                        />
                      ) : null}
                      <span>{row.weaponName} →</span>
                    </Link>
                  </td>
                  {/* 점유율이 null인 행은 그 패치에 관측 자체가 없었다는 뜻이다 — 0%로 적지 않는다. */}
                  <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap text-xs tabular-nums text-fg-2">
                    {row.before === null ? "—" : `${(row.before * 100).toFixed(2)}%`}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap text-xs tabular-nums text-fg-2">
                    {row.after === null ? "—" : `${(row.after * 100).toFixed(2)}%`}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right font-mono whitespace-nowrap font-bold tabular-nums ${
                      (row.relChange ?? 0) > 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {signedPct(row.relChange ?? 0)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap text-xs tabular-nums text-muted">
                    [{signedPct(row.relCi[0])}, {signedPct(row.relCi[1])}]
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap text-xs tabular-nums text-muted">
                    {row.n.before.toLocaleString()}→{row.n.after.toLocaleString()}
                  </td>
                  {showSubmarine ? (
                    <td className="py-2.5 pr-3">
                      <SubmarineCell
                        changes={submarineByKey.get(row.weaponKey) ?? []}
                        mismatchChanges={mismatchByKey.get(row.weaponKey) ?? []}
                      />
                    </td>
                  ) : null}
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={statusOf(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">이 조건에 해당하는 무기가 없습니다.</p>
          ) : null}
        </div>
      </CompareSplit>
    </div>
  );
}
