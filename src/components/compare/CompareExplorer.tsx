// src/components/compare/CompareExplorer.tsx
// LoL 대조표 인터랙션 경계 — 도구모음(칩·검색·정렬)·좌 내비·우 표가 공유하는 상태를 여기서만
// 소유한다. 데이터는 서버 컴포넌트가 props로 준다.
//
// **2026-09-23 §8-3 정렬**: 칩·검색·정렬·좌 내비·2컬럼 골격을 전부 공용 컴포넌트로 내렸다
// (`CompareToolbar`·`NoteNavPanel`·`CompareSplit`). 전에는 이 파일이 LoL 전용으로 그 넷을 다
// 들고 있었고, 그래서 TFT·PUBG는 같은 도구를 가질 방법이 없었다(§8-7 #7·#8 실측).
// 여기 남는 것은 **LoL 고유의 연결**뿐이다 — 라인 축, 노트 아이콘, 엔티티 행 조립.
//
// 필터·검색·정렬은 **엔티티 행에 건다**(델타 행이 아니라). 칩 숫자가 표의 행 수와 같아야 하고,
// 검색은 사용자가 보는 이름(엔티티)으로 도는 것이 맞기 때문이다.
"use client";

import { useMemo, useState } from "react";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import Container from "@/components/Container";
import LaneFilter from "@/components/LaneFilter";
import type { StreamEntityIcon } from "@/components/home/releaseStreamEntity";
import type { LaneAxis } from "@/lib/lane";
import DeltaTable from "./DeltaTable";
import CoverageBar from "./CoverageBar";
import FocusToast from "./FocusToast";
import CompareToolbar from "./CompareToolbar";
import { useFilterHash } from "./useFilterHash";
import CompareSplit from "./CompareSplit";
import NoteNavPanel from "./NoteNavPanel";
import {
  countByFilter,
  matchesFilter,
  searchRows,
  sortRows,
  type CompareFilterKey,
  type CompareSortKey,
} from "./toolbarRules";
import {
  filterNoteNavGroups,
  groupNoteNavItems,
  noteNavSections,
  type NoteNavGroup,
} from "./noteNav";
import {
  buildNoteMismatchIndexFromChanges,
  buildSubmarineIndexFromChanges,
} from "@/pipeline/gamedata/submarine";
import type { GameDataChange } from "@/pipeline/gamedata/types";
import { buildEntityRows } from "./entityRows";
import { lolNoteNavItems, navBadgeStatus, type CoverageStats } from "./logic";

export interface CompareExplorerProps {
  pair: { from: string; to: string } | null;
  notes: PatchNoteItem[];
  rows: DeltaRecord[];
  coverage: CoverageStats;
  /** note.id → EntityIcon 계약 — 부모(compare/page.tsx)가 ddragon으로 빌드 타임에 해석. */
  noteIcons?: Record<string, StreamEntityIcon>;
  /** deltas.meta.qAlpha — 표시 상태 판정에 쓴다. */
  qAlpha?: number;
  /**
   * 수치 축(F9) — 패치노트에 없는 원본 수치 변경. **평문 배열로 받는다**: 색인은 메서드를 가져
   * 서버→클라이언트 직렬화가 안 되므로 여기서 만든다.
   */
  gameDataChanges?: readonly GameDataChange[];
}

export default function CompareExplorer({
  pair,
  notes,
  rows,
  coverage,
  noteIcons = {},
  qAlpha,
  gameDataChanges = [],
}: CompareExplorerProps) {
  const [filter, setFilter] = useState<CompareFilterKey>("all");
  const [laneFilter, setLaneFilter] = useState<LaneAxis>("all");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CompareSortKey>("priority");
  const [selectedGroup, setSelectedGroup] = useState<NoteNavGroup | null>(null);
  // toast를 "다시 띄우기" 위한 선택 일련번호 — 같은 항목을 두 번 눌러도 새 key가 되어 다시 뜬다.
  const [selectSeq, setSelectSeq] = useState(0);

  // 타일 → 칩 착지는 `useFilterHash`가 소유한다(세 게임 공통 — 사본 금지).
  useFilterHash(setFilter);

  const submarine = useMemo(
    () => buildSubmarineIndexFromChanges(gameDataChanges),
    [gameDataChanges]
  );
  const mismatch = useMemo(
    () => buildNoteMismatchIndexFromChanges(gameDataChanges),
    [gameDataChanges]
  );

  /** 라인 축까지만 건 전체 행 — 칩 숫자는 이것을 센다(필터를 걸기 **전**). */
  const allRows = useMemo(
    () => buildEntityRows(rows, laneFilter, qAlpha, submarine, mismatch),
    [rows, laneFilter, qAlpha, submarine, mismatch]
  );

  const counts = useMemo(() => countByFilter(allRows, (r) => r.status), [allRows]);

  const entityRows = useMemo(() => {
    const filtered = allRows.filter((r) => matchesFilter(r.status, filter));
    const searched = searchRows(filtered, query, (r) => r.entityName);
    return sortRows(searched, sort, {
      statusOf: (r) => r.status,
      effectOf: (r) => r.maxAbsDelta,
      nameOf: (r) => r.entityName,
    });
  }, [allRows, filter, query, sort]);

  /** 좌 내비 — 노트 줄을 게임 중립 모양으로 바꾼다(변환은 게임 몫, 묶기는 공용 규칙). */
  const navGroups = useMemo(
    () => groupNoteNavItems(lolNoteNavItems(notes, noteIcons)),
    [notes, noteIcons]
  );

  const navSections = useMemo(() => noteNavSections(navGroups), [navGroups]);
  const visibleNav = useMemo(
    () => filterNoteNavGroups(navGroups, activeSection, query),
    [navGroups, activeSection, query]
  );

  // 선택한 묶음 → 표 행. 줄 id 교집합이 우선이고, 없으면 아이콘 해석 키(ddragon)로 한 번 더 찾는다.
  const focusKey = useMemo(() => {
    if (!selectedGroup) return null;
    const noteIds = new Set(selectedGroup.items.map((n) => n.id));
    const byNote = entityRows.find((r) => r.matchedNoteIds.some((id) => noteIds.has(id)));
    if (byNote) return byNote.key;
    const icon = selectedGroup.icon;
    if (icon?.entityType && icon.entityKey) {
      const key = `${icon.entityType}:${icon.entityKey}`;
      if (entityRows.some((r) => r.key === key)) return key;
    }
    return null;
  }, [selectedGroup, entityRows]);

  // 선택한 묶음의 행이 표에 없을 때의 안내. 표 머리 한 줄로는 보이지 않는다는 사용자 지적으로
  // toast로 옮겼다(FocusToast 주석 참고). 행이 없는 이유는 둘이다 — 필터에 걸렸거나, 유의한
  // 관측이 없거나. 필터가 "전체"가 아니면 그쪽을 먼저 의심하는 것이 사실에 가깝다.
  const focusMissing = selectedGroup !== null && focusKey === null;
  const narrowed = laneFilter !== "all" || filter !== "all" || query.trim() !== "";
  const toastMessage = focusMissing
    ? `${selectedGroup?.entity ?? ""} — ${
        narrowed
          ? "현재 필터·검색에서는 이 표에 행이 없습니다"
          : "유의한 관측이 없어 이 표에 행이 없습니다"
      }`
    : null;

  return (
    <Container className="flex flex-col gap-6 pb-8">
      <FocusToast key={`${selectedGroup?.id ?? ""}:${selectSeq}`} message={toastMessage} />
      <CompareToolbar
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="챔피언·아이템 검색"
        sort={sort}
        onSortChange={setSort}
        extra={<LaneFilter selected={laneFilter} onSelect={setLaneFilter} />}
      />
      <CompareSplit
        title="선언 ↔ 관측"
        meta={`${entityRows.length}개 대상`}
        nav={
          <NoteNavPanel
            groups={visibleNav}
            sections={navSections}
            activeSection={activeSection}
            onSectionChange={(section) =>
              setActiveSection((current) => (current === section ? null : section))
            }
            selectedId={selectedGroup?.id ?? null}
            onSelect={(group) => {
              setSelectedGroup(group);
              setSelectSeq((seq) => seq + 1);
            }}
            statusOf={(group) =>
              navBadgeStatus(
                group.items.map((n) => n.id),
                rows,
                qAlpha
              )
            }
          />
        }
        notice={
          // 2026-09-19 사용자 결정항목: 라인을 고르면 아이템 행이 전부 사라지는데 화면이 그
          // 사실을 말하지 않았다. 데이터가 그렇게 강제한다 — 아이템 델타는 라인 축이 없다.
          laneFilter !== "all"
            ? "아이템은 라인별로 집계하지 않아 라인을 고르면 이 표에서 빠집니다."
            : null
        }
        coverage={<CoverageBar stats={coverage} />}
      >
        <DeltaTable pair={pair} rows={entityRows} focusKey={focusKey} />
      </CompareSplit>
    </Container>
  );
}
