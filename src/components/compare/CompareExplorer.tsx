// src/components/compare/CompareExplorer.tsx
// 대조표 인터랙션 경계 — 상태 필터 칩·좌 내비게이터(섹션·검색·선택)·우 델타 테이블(포커스)이
// 공유하는 상태를 여기 한 곳에서만 소유한다(ST-11 프롬프트: "데이터는 서버 컴포넌트가 props로 전달,
// 인터랙션만 'use client'"). 하위 컴포넌트(StatusFilterChips·NoteNavigator·DeltaTable·CoverageBar)는
// 전부 props만 받는 순수 프레젠테이션.
//
// 2026-09-18 라운드6(사용자 L3·L4·C1): 표의 행이 엔티티가 됐다(`buildEntityRows`). 좌 내비 선택은
// note id가 아니라 **엔티티 묶음**이고, 선택하면 그 묶음의 줄과 짝지어진 표 행(`matchedNoteIds` 교집합)을
// 찾아 `focusKey`로 넘긴다 — 표가 그 행을 최상단으로 스크롤한다. 표에 그 엔티티 행이 없으면(유의한
// 관측이 0) 그 사실을 표 머리 1줄로 말한다. "더 보기" 페이지네이션은 없앴다 — 엔티티 단위면 200행
// 미만이고 내부 스크롤이 이미 있다.
"use client";

import { useEffect, useMemo, useState } from "react";
import type { DeltaRecord, PatchNoteItem, PatchNoteSection } from "@/pipeline/types";
import Container from "@/components/Container";
import LaneFilter from "@/components/LaneFilter";
import type { StreamEntityIcon } from "@/components/home/releaseStreamEntity";
import type { LaneAxis } from "@/lib/lane";
import { panelSurfaceClass } from "@/lib/panelSurface";
import StatusFilterChips from "./StatusFilterChips";
import NoteNavigator from "./NoteNavigator";
import DeltaTable from "./DeltaTable";
import CoverageBar from "./CoverageBar";
import { buildEntityRows } from "./entityRows";
import { STATUS_FILTERS, filterByStatus, type CoverageStats, type NoteEntityGroup } from "./logic";

export interface CompareExplorerProps {
  pair: { from: string; to: string } | null;
  notes: PatchNoteItem[];
  rows: DeltaRecord[];
  coverage: CoverageStats;
  /** note.id → EntityIcon 계약 — 부모(compare/page.tsx)가 ddragon으로 빌드 타임에 해석. */
  noteIcons?: Record<string, StreamEntityIcon>;
  /** deltas.meta.qAlpha — 표시 상태 판정에 쓴다. */
  qAlpha?: number;
}

export default function CompareExplorer({ pair, notes, rows, coverage, noteIcons = {}, qAlpha }: CompareExplorerProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [laneFilter, setLaneFilter] = useState<LaneAxis>("all");
  const [activeSection, setActiveSection] = useState<PatchNoteSection>("champion");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<NoteEntityGroup | null>(null);

  // 홈 히어로 타일 "미공지 Gap"이 `/compare/#unannounced`로 링크한다(정적 경로 + 앵커만). 해시가
  // 칩 키와 일치하면 선반영 — 빌드 타임엔 window가 없어 초기 상태는 "all"이고 마운트 후 조정한다.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (STATUS_FILTERS.some((f) => f.key === hash)) {
      // 브라우저 전용 값(URL 해시)으로 마운트 후 한 번만 동기화 — react-hooks 문서의 "외부 시스템 구독".
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter(hash);
    }
  }, []);

  const entityRows = useMemo(
    () => buildEntityRows(filterByStatus(rows, statusFilter, qAlpha), laneFilter, qAlpha),
    [rows, statusFilter, laneFilter, qAlpha]
  );

  // 선택한 묶음 → 표 행. 줄 id 교집합이 우선이고, 없으면 아이콘 해석 키(ddragon)로 한 번 더 찾는다.
  const focusKey = useMemo(() => {
    if (!selectedGroup) return null;
    const noteIds = new Set(selectedGroup.notes.map((n) => n.id));
    const byNote = entityRows.find((r) => r.matchedNoteIds.some((id) => noteIds.has(id)));
    if (byNote) return byNote.key;
    const icon = noteIcons[selectedGroup.id];
    if (icon?.entityType && icon.entityKey) {
      const key = `${icon.entityType}:${icon.entityKey}`;
      if (entityRows.some((r) => r.key === key)) return key;
    }
    return null;
  }, [selectedGroup, entityRows, noteIcons]);

  const focusMissing = selectedGroup !== null && focusKey === null;

  return (
    <>
      {/* 시안 .m-filter — 상태 칩과 라인 필터를 같은 필터바 줄에 둔다(홈과 동일한 어휘). 표면은
          헤더와 같은 반투명 크롬(.glass-chrome-2). 2026-09-13(R8) +120px 배치는 홈과 동일 결정. */}
      <div className="glass-chrome-2 border-b mt-[120px]"> {/* design-lint-ignore: PLAN-deployed-ui-fix-2026-09-12.md R8 — 사용자 확정 +120px, 대응 토큰 없는 페이지별 배치 수치 */}
        <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
          <StatusFilterChips active={statusFilter} onChange={setStatusFilter} />
          <LaneFilter selected={laneFilter} onSelect={setLaneFilter} />
        </Container>
      </div>
      <Container className="py-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_1fr]">
          <NoteNavigator
            notes={notes}
            rows={rows}
            qAlpha={qAlpha}
            activeSection={activeSection}
            onSectionChange={(section) => {
              setActiveSection(section);
              setSearchQuery("");
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedGroupId={selectedGroup?.id ?? null}
            onSelect={setSelectedGroup}
            icons={noteIcons}
          />
          <section className={`${panelSurfaceClass("glass")} overflow-hidden rounded-lg`}>
            <div className="panel-head-wash flex items-center justify-between gap-4 border-b border-border-soft px-5 py-5">
              <div>
                <span className="block text-xs font-bold text-muted">선언 ↔ 관측</span>
                <h2 className="font-display text-lg font-bold text-fg">델타 테이블</h2>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted">{entityRows.length}개 엔티티</span>
            </div>
            {focusMissing ? (
              // scope-critic ST3: 행이 없는 이유는 둘이다 — 라인·상태 필터에 걸렸거나, 유의한 관측이 없거나.
              // 필터가 "전체"가 아니면 그쪽을 먼저 의심하는 것이 사실에 가깝다(아이템은 라인 선택 시 항상 빠진다).
              <p className="border-b border-border-soft px-5 py-2 text-xs text-muted">
                <strong className="text-fg-2">{selectedGroup?.entity}</strong> —{" "}
                {laneFilter !== "all" || statusFilter !== "all"
                  ? "현재 라인·상태 필터에서는 이 표에 행이 없습니다"
                  : "유의한 관측이 없어 이 표에 행이 없습니다"}
              </p>
            ) : null}
            <DeltaTable pair={pair} rows={entityRows} focusKey={focusKey} />
            <CoverageBar stats={coverage} />
          </section>
        </div>
      </Container>
    </>
  );
}
