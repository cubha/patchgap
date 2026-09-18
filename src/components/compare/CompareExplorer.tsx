// src/components/compare/CompareExplorer.tsx
// 대조표 인터랙션 경계 — 상태 필터 칩·좌 내비게이터(섹션·검색·선택)·우 델타 테이블(정렬·
// 하이라이트·더 보기)이 공유하는 상태를 여기 한 곳에서만 소유한다(ST-11 프롬프트: "데이터는
// 서버 컴포넌트가 props로 전달, 인터랙션만 'use client'"). 하위 컴포넌트(StatusFilterChips·
// NoteNavigator·DeltaTable·CoverageBar)는 전부 props만 받는 순수 프레젠테이션.
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
import {
  STATUS_FILTERS,
  filterByLane,
  filterByStatus,
  sortRows,
  type CoverageStats,
  type SortKey,
} from "./logic";

export interface CompareExplorerProps {
  pair: { from: string; to: string } | null;
  notes: PatchNoteItem[];
  rows: DeltaRecord[];
  coverage: CoverageStats;
  /** note.id → EntityIcon 계약 — 부모(compare/page.tsx)가 ddragon으로 빌드 타임에 해석. */
  noteIcons?: Record<string, StreamEntityIcon>;
  /** deltas.meta.qAlpha — 표시 상태(공지-불일치 vs 관측 미확인) 판정에 쓴다(ST-4). */
  qAlpha?: number;
}

const PAGE_SIZE = 200;

export default function CompareExplorer({ pair, notes, rows, coverage, noteIcons = {}, qAlpha }: CompareExplorerProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [laneFilter, setLaneFilter] = useState<LaneAxis>("all");
  const [activeSection, setActiveSection] = useState<PatchNoteSection>("champion");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 홈 히어로 카드의 "미공지" 스탯 타일이 `/compare/#unannounced`로 링크한다(쿼리 문자열 없이
  // 정적 경로 + 앵커만 쓰는 원칙, ST-11 프롬프트). 해시가 상태 필터 키와 일치하면 그 필터를
  // 선반영한다 — 빌드 타임엔 window가 없어 초기 상태는 항상 "all"이고, 마운트 후 이 effect가
  // 클라이언트에서만 조정한다(하이드레이션 불일치 없음).
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (STATUS_FILTERS.some((f) => f.key === hash)) {
      // 빌드 타임(SSR)엔 location.hash가 없어 초기 상태를 항상 "all"로 둔다 — 마운트 후 이
      // 브라우저 전용 값(URL 해시)으로 한 번만 동기화하는 것이 정확히 react-hooks 문서가 예시로
      // 드는 "외부 시스템 구독" 케이스라 set-state-in-effect를 의도적으로 허용한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter(hash);
    }
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filteredSortedRows = useMemo(
    () => sortRows(filterByLane(filterByStatus(rows, statusFilter, qAlpha), laneFilter), sortKey, sortDir),
    [rows, statusFilter, laneFilter, sortKey, sortDir, qAlpha]
  );
  const visibleRows = filteredSortedRows.slice(0, visibleCount);
  const hasMore = filteredSortedRows.length > visibleRows.length;

  return (
    <>
      {/* 시안 .m-filter — 상태 칩과 라인 필터를 같은 필터바 줄에 둔다(홈과 동일한 어휘).
          표면도 헤더와 같은 반투명 크롬(.glass-chrome-2) — 이 필터는 실제로 동작하므로
          2026-09-12(3차) 크롬 1줄 통합 대상이 아니다(구 FilterBar와 달리 이 행은 유지). 헤더
          1줄 + 이 행까지 불투명하면 전역 앰비언트 배경의 상단 밴드가 대조표에서만 가려진다.

          2026-09-13(7차, R8 — 배치안 아티팩트 A안 "+120px", 홈 page.tsx와 동일 결정을 전 메뉴에
          적용): 이 필터 바 자체를 위로 120px 띄운다 — 대조표엔 홈의 히어로 텍스트에 해당하는
          장식 요소가 없어 이 필터 바가 "첫 블록"이다. 헤더 바로 아래 여백 없이 붙어 있던 걸
          띄워 그 사이 지형이 더 드러나게 한다. 120px은 이 페이지 1회성 배치 수치라 대응 토큰이
          없다(Container `width` prop·NoteNavigator의 640 고정값과 동일 성격). */}
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
            selectedNoteId={selectedNoteId}
            onSelect={setSelectedNoteId}
            icons={noteIcons}
          />
          {/* 2026-09-12(3차): 골드 4변 프레임 → .panel-surface(Q2 "A+B 결합").
              2026-09-12(5차, R6 확대): panel-surface-glass 추가 — NoteNavigator.tsx 주석과
              동일 근거(top≈143px부터 카메라 밴드 전체를 덮던 불투명 패널을 홈과 통일).
              2026-09-12(6차): 리터럴 대신 panelSurfaceClass() — src/lib/panelSurface.ts. */}
          <section className={`${panelSurfaceClass("glass")} overflow-hidden rounded-lg`}>
            <div className="panel-head-wash flex items-center justify-between gap-4 border-b border-border-soft px-5 py-5">
              <div>
                <span className="block text-xs font-bold text-muted">선언 ↔ 관측</span>
                <h2 className="font-display text-lg font-bold text-fg">델타 테이블</h2>
              </div>
            </div>
            <DeltaTable
              pair={pair}
              rows={visibleRows}
              qAlpha={qAlpha}
              highlightNoteId={selectedNoteId}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            {hasMore ? (
              <div className="border-t border-border-soft px-5 py-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="text-sm font-bold text-accent hover:underline"
                >
                  더 보기 ({filteredSortedRows.length - visibleRows.length}건 남음)
                </button>
              </div>
            ) : null}
            <CoverageBar stats={coverage} />
          </section>
        </div>
      </Container>
    </>
  );
}
