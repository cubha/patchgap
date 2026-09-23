// src/components/compare/NoteNavPanel.tsx
// 좌 「패치노트 항목」 내비 — **세 게임이 이 하나를 쓴다**(UX-BRIEF §8-3).
//
// 전에는 LoL에만 있었다(`NoteNavigator.tsx`). TFT·PUBG 대조표는 표 하나만 있어서, 「패치노트가
// 뭘 말했나」에서 출발하는 길이 그 두 게임엔 없었다 — 노트 데이터는 세 게임 모두 있는데도.
//
// 묶기·탭·거르기 규칙은 `noteNav.ts`가 소유한다. 여기는 모양과 선택 콜백만 든다.
// 검색창을 여기 두지 않는다 — 질의는 도구모음(`CompareToolbar`)이 소유하고 표와 공유한다.
"use client";

import EntityIcon from "@/components/EntityIcon";
import IconBox from "@/components/IconBox";
import StatusBadge from "@/components/StatusBadge";
import { panelSurfaceClass } from "@/lib/panelSurface";
import { PANEL_SPLIT_BODY, PANEL_SPLIT_COLUMN } from "@/lib/panelScroll";
import type { DisplayStatus } from "@/pipeline/shared/display-status";
import type { NoteNavGroup, NoteNavSection } from "./noteNav";

export interface NoteNavPanelProps {
  /** 이미 걸러진 묶음(`filterNoteNavGroups`). */
  groups: readonly NoteNavGroup[];
  sections: readonly NoteNavSection[];
  /** `null`이면 전체 — 섹션이 하나뿐인 게임(PUBG)에서는 탭 줄을 그리지 않는다. */
  activeSection: string | null;
  onSectionChange: (section: string) => void;
  selectedId: string | null;
  onSelect: (group: NoteNavGroup) => void;
  /**
   * 묶음의 판정 배지 — 게임이 자기 잣대로 낸다(§8-0). `null`이면 배지 대신 「유의한 관측 없음」.
   * 여기서 다시 판정하지 않는다: 표와 내비가 서로 다른 중요도를 주장하면 화면이 스스로를 반박한다.
   */
  statusOf: (group: NoteNavGroup) => DisplayStatus | null;
}

export default function NoteNavPanel({
  groups,
  sections,
  activeSection,
  onSectionChange,
  selectedId,
  onSelect,
  statusOf,
}: NoteNavPanelProps) {
  return (
    <section className={`${panelSurfaceClass("glass")} ${PANEL_SPLIT_COLUMN} overflow-hidden rounded-lg`}>
      <div className="panel-head-wash border-b border-border-soft px-5 py-5">
        <h2 className="font-display text-lg font-bold text-fg">패치노트 항목</h2>
      </div>
      {/* 섹션이 하나뿐이면 탭은 선택지를 주지 않는다 — 그리지 않는다. */}
      {sections.length > 1 ? (
        <div className="flex flex-wrap gap-2 px-5 pt-4" role="tablist" aria-label="패치노트 섹션">
          {sections.map((section) => {
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
                {section.label} {section.count}
              </button>
            );
          })}
        </div>
      ) : null}
      {/* 높이·스크롤 규약은 `@/lib/panelScroll`이 소유한다 — 사본을 만들지 않는다. */}
      <ul className={`${PANEL_SPLIT_BODY} py-3`}>
        {groups.length === 0 ? (
          <li className="px-5 py-4 text-sm text-muted">해당하는 패치노트 항목이 없습니다.</li>
        ) : (
          groups.map((group) => {
            const isSelected = group.id === selectedId;
            const status = statusOf(group);
            const icon = group.icon;
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
                  {icon?.entityType && icon.entityKey ? (
                    <EntityIcon
                      entityType={icon.entityType}
                      entityKey={icon.entityKey}
                      name={group.entity}
                      size={40}
                    />
                  ) : (
                    <IconBox size={40} className="font-display text-xs font-bold">
                      {group.entity.slice(0, 1)}
                    </IconBox>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-fg">{group.entity}</span>
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {group.items.length}줄
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted">
                      {group.details.length > 0 ? group.details.join(" · ") : group.items[0]?.summary}
                    </span>
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
