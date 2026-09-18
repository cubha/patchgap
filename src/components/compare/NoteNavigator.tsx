// src/components/compare/NoteNavigator.tsx
// 좌 내비게이터(1/3) — 프로토타입 `.tab-row`/`.nav-search`/`.note-item-list` 1:1
// (docs/design/prototype/02-comparison-table.html). 순수 프레젠테이션 — 상태는 부모
// CompareExplorer가 소유(섹션 탭·검색어·선택 항목 전부 콜백으로 위임).
//
// panel-surface-glass(2026-09-12·5차, R6 확대 — 사용자가 홈과 동일 스타일 쓰는 곳을 찾아
// 통일하라고 지시): /compare/도 layout.tsx의 전역 앰비언트 배경을 그대로 받는데, 이 패널이
// top≈143px부터 카메라 노출 밴드(y<873px) 전체를 불투명으로 덮고 있었다 — 홈에서 이미
// "전면 유리화"로 방향을 바꿨으므로 같은 처리를 여기도 적용한다.

import type { DeltaRecord, PatchNoteItem, PatchNoteSection } from "@/pipeline/types";
import EntityIcon from "@/components/EntityIcon";
import IconBox from "@/components/IconBox";
import StatusBadge from "@/components/StatusBadge";
import type { StreamEntityIcon } from "@/components/home/releaseStreamEntity";
import { panelSurfaceClass } from "@/lib/panelSurface";
import { NAV_SECTIONS, filterNotesBySearch, filterNotesBySection, representativeStatus } from "./logic";

export interface NoteNavigatorProps {
  notes: PatchNoteItem[];
  rows: DeltaRecord[];
  activeSection: PatchNoteSection;
  onSectionChange: (section: PatchNoteSection) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedNoteId: string | null;
  onSelect: (noteId: string) => void;
  /** note.id → EntityIcon 계약(부모가 ddragon으로 빌드 타임에 해석해 내려준다 — 이 컴포넌트는
   * "use client" 경계 안이라 fs를 직접 읽지 못한다). 키가 없으면 아이콘 없이 폴백. */
  icons: Record<string, StreamEntityIcon>;
  /** deltas.meta.qAlpha — 배지 표시 키(공지-불일치 vs 관측 미확인, ST-4). */
  qAlpha?: number;
}

export default function NoteNavigator({
  notes,
  rows,
  activeSection,
  onSectionChange,
  searchQuery,
  onSearchChange,
  selectedNoteId,
  onSelect,
  icons,
  qAlpha,
}: NoteNavigatorProps) {
  const sectionFiltered = filterNotesBySection(notes, activeSection);
  const visible = filterNotesBySearch(sectionFiltered, searchQuery);

  return (
    // 2026-09-12(3차): 골드 4변 프레임 → .panel-surface(src/styles/panel.css, Q2 "A+B 결합").
    // 2026-09-12(6차): 리터럴 대신 panelSurfaceClass() — src/lib/panelSurface.ts.
    <section className={`${panelSurfaceClass("glass")} overflow-hidden rounded-lg`}>
      <div className="panel-head-wash border-b border-border-soft px-5 py-5">
        <h2 className="font-display text-lg font-bold text-fg">패치노트 항목</h2>
      </div>
      <div className="flex gap-2 px-5 pt-4" role="tablist" aria-label="패치노트 섹션">
        {NAV_SECTIONS.map((section) => {
          const count = filterNotesBySection(notes, section.key).length;
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
      <ul className="max-h-[640px] overflow-y-auto py-3"> {/* design-lint-ignore: 프로토타입 .note-item-list{max-height:640px} 하드코딩값, 대응 토큰 없음 */}
        {visible.length === 0 ? (
          <li className="px-5 py-4 text-sm text-muted">검색 결과가 없습니다</li>
        ) : (
          visible.map((item) => {
            const isSelected = item.id === selectedNoteId;
            const status = representativeStatus(item.id, rows, qAlpha);
            const icon = icons[item.id] ?? { entityType: null, entityKey: null };
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={isSelected ? "true" : undefined}
                  // 선택 표현(2026-09-13·6차 연속): `bg-surface-warm`(완전 불투명)이 유리 패널 안에서
                  // 혼자 불투명 블록으로 남았다. 같은 "선택된 행"을 DeltaTable.tsx이 이미
                  // `.row-highlight`(반투명 골드 워시)로 그리고 있으므로 양쪽 언어를 맞춘다.
                  className={`flex w-full items-start gap-3 border-l-2 px-5 py-3 text-left ${
                    isSelected ? "row-highlight border-accent" : "border-transparent"
                  }`}
                >
                  {icon.entityType && icon.entityKey ? (
                    <EntityIcon entityType={icon.entityType} entityKey={icon.entityKey} name={item.entity} size={40} />
                  ) : (
                    // 2026-09-12(6차, /verify-impl 재검증): EntityIcon.tsx 폴백과 동형이던 인라인
                    // 마크업을 IconBox 공용 컴포넌트로 교체 — src/components/IconBox.tsx 참고.
                    <IconBox size={40} className="font-display text-xs font-bold">
                      {item.entity.slice(0, 1)}
                    </IconBox>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="text-sm font-bold text-fg">{item.entity}</span>
                    <span className="line-clamp-2 font-mono text-xs tabular-nums text-muted">
                      {item.skill ? `${item.skill} ` : ""}
                      {item.before && item.after ? `${item.before}⇒${item.after}` : item.summary}
                    </span>
                    {status ? (
                      <StatusBadge status={status} className="mt-1 w-fit" />
                    ) : (
                      <span className="mt-1 w-fit text-xs text-muted">관측 없음</span>
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
