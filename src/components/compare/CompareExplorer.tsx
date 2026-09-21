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
import { PANEL_SPLIT_COLUMN, PANEL_SPLIT_HEIGHT } from "@/lib/panelScroll";
import StatusFilterChips from "./StatusFilterChips";
import NoteNavigator from "./NoteNavigator";
import DeltaTable from "./DeltaTable";
import CoverageBar from "./CoverageBar";
import FocusToast from "./FocusToast";
import {
  buildNoteMismatchIndexFromChanges,
  buildSubmarineIndexFromChanges,
} from "@/pipeline/gamedata/submarine";
import type { GameDataChange } from "@/pipeline/gamedata/types";
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [laneFilter, setLaneFilter] = useState<LaneAxis>("all");
  const [activeSection, setActiveSection] = useState<PatchNoteSection>("champion");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<NoteEntityGroup | null>(null);
  // toast를 "다시 띄우기" 위한 선택 일련번호 — 같은 항목을 두 번 눌러도 새 key가 되어 다시 뜬다.
  const [selectSeq, setSelectSeq] = useState(0);

  // 홈 히어로 타일 "미공지 Gap"이 `/lol/compare/#unannounced`로 링크한다(정적 경로 + 앵커만). 해시가
  // 칩 키와 일치하면 선반영 — 빌드 타임엔 window가 없어 초기 상태는 "all"이고 마운트 후 조정한다.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (STATUS_FILTERS.some((f) => f.key === hash)) {
      // 브라우저 전용 값(URL 해시)으로 마운트 후 한 번만 동기화 — react-hooks 문서의 "외부 시스템 구독".
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter(hash);
    }
  }, []);

  const submarine = useMemo(
    () => buildSubmarineIndexFromChanges(gameDataChanges),
    [gameDataChanges]
  );
  const mismatch = useMemo(
    () => buildNoteMismatchIndexFromChanges(gameDataChanges),
    [gameDataChanges]
  );

  const entityRows = useMemo(
    () =>
      buildEntityRows(
        filterByStatus(rows, statusFilter, qAlpha),
        laneFilter,
        qAlpha,
        submarine,
        mismatch
      ),
    [rows, statusFilter, laneFilter, qAlpha, submarine, mismatch]
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

  // 선택한 묶음의 행이 표에 없을 때의 안내. 표 머리 한 줄로는 보이지 않는다는 사용자 지적으로
  // toast로 옮겼다(FocusToast 주석 참고). 행이 없는 이유는 둘이다 — 필터에 걸렸거나, 유의한
  // 관측이 없거나. 필터가 "전체"가 아니면 그쪽을 먼저 의심하는 것이 사실에 가깝다.
  const focusMissing = selectedGroup !== null && focusKey === null;
  const toastMessage = focusMissing
    ? `${selectedGroup?.entity ?? ""} — ${
        laneFilter !== "all" || statusFilter !== "all"
          ? "현재 라인·상태 필터에서는 이 표에 행이 없습니다"
          : "유의한 관측이 없어 이 표에 행이 없습니다"
      }`
    : null;

  return (
    <>
      <FocusToast key={`${selectedGroup?.id ?? ""}:${selectSeq}`} message={toastMessage} />
      {/* 시안 .m-filter — 상태 칩과 라인 필터를 같은 필터바 줄에 둔다(홈과 동일한 어휘). 표면은
          헤더와 같은 반투명 크롬(.glass-chrome-2). 2026-09-13(R8) +120px 배치는 홈과 동일 결정. */}
      <div className="glass-chrome-2 border-b mt-[120px]"> {/* design-lint-ignore: PLAN-deployed-ui-fix-2026-09-12.md R8 — 사용자 확정 +120px, 대응 토큰 없는 페이지별 배치 수치 */}
        <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
          <StatusFilterChips active={statusFilter} onChange={setStatusFilter} />
          <LaneFilter selected={laneFilter} onSelect={setLaneFilter} />
        </Container>
      </div>
      <Container className="py-8">
        {/* `items-start`를 뺐다(2026-09-20 사용자 지적 "좌우 섹션 높이 안 맞음"). 그것이
            두 열을 각자 내용 높이로 만들어 아래 끝이 어긋났다 — 실측 좌 809px / 우 773px.
            행 높이를 고정하고(PANEL_SPLIT_HEIGHT) 각 패널이 채우게 해야 맞는다. 모바일은
            단일 열 적층이라 이 높이를 걸지 않는다(`lg:`). */}
        <div className={`grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] ${PANEL_SPLIT_HEIGHT}`}>
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
            onSelect={(group) => {
              setSelectedGroup(group);
              setSelectSeq((seq) => seq + 1);
            }}
            icons={noteIcons}
          />
          <section className={`${panelSurfaceClass("glass")} ${PANEL_SPLIT_COLUMN} overflow-hidden rounded-lg`}>
            <div className="panel-head-wash flex items-center justify-between gap-4 border-b border-border-soft px-5 py-5">
              <div>
                <span className="block text-xs font-bold text-muted">선언 ↔ 관측</span>
                <h2 className="font-display text-lg font-bold text-fg">델타 테이블</h2>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted">{entityRows.length}개 엔티티</span>
            </div>
            {/* 2026-09-19 사용자 결정항목: 라인을 고르면 아이템 행이 전부 사라지는데 화면이 그
                사실을 말하지 않았다. 데이터가 그렇게 강제한다 — 아이템 델타는 `item:3504:adoptionRate`
                처럼 라인 축이 없다(챔피언만 라인별 4세그먼트). 없는 축을 지어내 "정글에서의 채택률"을
                보여주는 대신, 빠진다는 사실을 적는다. */}
            {laneFilter !== "all" ? (
              <p className="border-b border-border-soft px-5 py-2 text-xs text-muted">
                아이템은 라인별로 집계하지 않아 라인을 고르면 이 표에서 빠집니다.
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
