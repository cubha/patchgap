// src/components/compare/NoteNavigator.tsx
// 좌 내비게이터(1/3) — 프로토타입 `.tab-row`/`.nav-search`/`.note-item-list` 1:1
// (docs/design/prototype/02-comparison-table.html). 순수 프레젠테이션 — 상태는 부모
// CompareExplorer가 소유(섹션 탭·검색어·선택 항목 전부 콜백으로 위임).
//
// 2026-09-18 라운드6(사용자 L4): **항목 = 엔티티**. 이전엔 패치노트 줄 1개 = 항목 1개라 같은 챔피언이
// 스킬·스탯마다 별도 행으로 반복됐다("동일챔피언에 대한 항목이 별도 행으로 표기됨"). 묶기는
// `groupNotesForNav`가 하고, 항목엔 줄 수·스킬 목록·배지(보고 가능 관측이 있을 때만)를 그린다. 클릭은
// 부모가 받아 우측 표의 해당 엔티티 행을 최상단으로 스크롤한다.
//
// panel-surface-glass(2026-09-12·5차, R6 확대): /lol/compare/도 전역 앰비언트 배경을 그대로 받는다.

import type { DeltaRecord, PatchNoteItem, PatchNoteSection } from "@/pipeline/types";
import EntityIcon from "@/components/EntityIcon";
import IconBox from "@/components/IconBox";
import StatusBadge from "@/components/StatusBadge";
import type { StreamEntityIcon } from "@/components/home/releaseStreamEntity";
import { panelSurfaceClass } from "@/lib/panelSurface";
import { PANEL_SPLIT_BODY, PANEL_SPLIT_COLUMN } from "@/lib/panelScroll";
import {
  NAV_SECTIONS,
  filterNotesBySearch,
  filterNotesBySection,
  groupNotesForNav,
  navBadgeStatus,
  type NoteEntityGroup,
} from "./logic";

export interface NoteNavigatorProps {
  notes: PatchNoteItem[];
  rows: DeltaRecord[];
  activeSection: PatchNoteSection;
  onSectionChange: (section: PatchNoteSection) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** 선택된 엔티티 묶음의 대표 id(`NoteEntityGroup.id`). */
  selectedGroupId: string | null;
  onSelect: (group: NoteEntityGroup) => void;
  /** note.id → EntityIcon 계약(부모가 ddragon으로 빌드 타임에 해석해 내려준다). 키가 없으면 폴백. */
  icons: Record<string, StreamEntityIcon>;
  /** deltas.meta.qAlpha — 배지 표시 키. */
  qAlpha?: number;
}

export default function NoteNavigator({
  notes,
  rows,
  activeSection,
  onSectionChange,
  searchQuery,
  onSearchChange,
  selectedGroupId,
  onSelect,
  icons,
  qAlpha,
}: NoteNavigatorProps) {
  const sectionFiltered = filterNotesBySection(notes, activeSection);
  const visible = groupNotesForNav(filterNotesBySearch(sectionFiltered, searchQuery));

  return (
    <section className={`${panelSurfaceClass("glass")} ${PANEL_SPLIT_COLUMN} overflow-hidden rounded-lg`}>
      <div className="panel-head-wash border-b border-border-soft px-5 py-5">
        <h2 className="font-display text-lg font-bold text-fg">패치노트 항목</h2>
      </div>
      <div className="flex gap-2 px-5 pt-4" role="tablist" aria-label="패치노트 섹션">
        {NAV_SECTIONS.map((section) => {
          // 탭 숫자 = 엔티티 수(항목이 엔티티 단위이므로 줄 수를 세면 화면과 어긋난다).
          const count = groupNotesForNav(filterNotesBySection(notes, section.key)).length;
          const isActive = section.key === activeSection;
          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSectionChange(section.key)}
              className={`border-b-2 px-1 py-2 text-xs font-bold ${
                isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg-2"
              }`}
            >
              {section.label} {count}
            </button>
          );
        })}
      </div>
      <div className="px-5 pt-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="챔피언·아이템 검색"
          aria-label="패치노트 항목 검색"
          className="min-h-9 w-full rounded-sm border border-border bg-surface-warm px-3 text-sm font-bold text-fg placeholder:font-normal placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>
      {/* 높이·스크롤 규약은 `@/lib/panelScroll`이 소유한다 — 사본을 만들지 않는다. */}
      <ul className={`${PANEL_SPLIT_BODY} py-3`}>
        {visible.length === 0 ? (
          <li className="px-5 py-4 text-sm text-muted">검색 결과가 없습니다</li>
        ) : (
          visible.map((group) => {
            const isSelected = group.id === selectedGroupId;
            const status = navBadgeStatus(
              group.notes.map((n) => n.id),
              rows,
              qAlpha
            );
            const icon = icons[group.id] ?? { entityType: null, entityKey: null };
            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => onSelect(group)}
                  aria-current={isSelected ? "true" : undefined}
                  className={`flex w-full items-start gap-3 border-l-2 px-5 py-3 text-left ${
                    isSelected ? "row-highlight border-accent" : "border-transparent"
                  }`}
                >
                  {icon.entityType && icon.entityKey ? (
                    <EntityIcon entityType={icon.entityType} entityKey={icon.entityKey} name={group.entity} size={40} />
                  ) : (
                    <IconBox size={40} className="font-display text-xs font-bold">
                      {group.entity.slice(0, 1)}
                    </IconBox>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-fg">{group.entity}</span>
                      <span className="font-mono text-xs tabular-nums text-muted">{group.notes.length}줄</span>
                    </span>
                    {group.skills.length > 0 ? (
                      <span className="line-clamp-2 text-xs text-muted">{group.skills.join(" · ")}</span>
                    ) : (
                      <span className="line-clamp-2 text-xs text-muted">{group.notes[0]?.summary}</span>
                    )}
                    {status ? (
                      <StatusBadge status={status} className="mt-1 w-fit" />
                    ) : (
                      <span className="mt-1 w-fit text-xs text-muted">유의한 관측 없음</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
