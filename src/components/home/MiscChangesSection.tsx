// src/components/home/MiscChangesSection.tsx
// 홈 "기타 변경" 블록(2026-09-18 라운드6, 사용자 L2) — 패치 내용 탭 목록의 **마지막 항목 1개**.
// 버그 수정·편의성 개선·신규 스킨·증강·게임 모드처럼 관측할 지표가 없는 줄을 카테고리별로 모은다.
// 판정 배지는 없다 — "관측 불필요하기 때문에 관측없음 뱃지 불필요"(사용자). 분류는 miscSections.ts
// (순수)가 하고 여기선 그린다. 서버 컴포넌트(상태 없음, 네이티브 <details>).
//
// 2026-09-19 사용자 지적 3건을 여기서 닫는다:
// ① **신규 스킨 이미지 회귀** — 라운드6에서 치장 줄이 카드에서 이 블록으로 옮겨오면서
//    CosmeticSkinPreview가 딸려오지 않아 스플래시가 사라졌다. 같은 skinPreviews를 받아 그린다.
// ② **섹션 간 분리 모호** — 소제목 한 줄 + gap만으로는 카테고리 경계가 읽히지 않았다. 카테고리를
//    테두리 있는 블록으로 세우고 제목 밴드를 준다(카드 남용을 피하려 밴드는 배경만, 그림자 없음).
// ③ **같은 항목이 여러 행** — "W - 응수"가 두 줄이면 두 행으로 보였다. 엔티티 → 스킬 순으로 묶어
//    한 항목은 한 행이 되게 한다(카드 목록이 이미 쓰는 groupNotesBySkill과 같은 규약).
import type { PatchNoteItem } from "@/pipeline/types";
import CosmeticSkinPreview, { type CosmeticSkinItem } from "./CosmeticSkinPreview";
import type { MiscSection } from "./miscSections";
import { groupNotesBySkill } from "./noteSkillGroups";
import { createSkinDeduper } from "./skinPreviewBundle";

export interface MiscChangesSectionProps {
  sections: MiscSection[];
  /** 라인 필터가 걸려 있는가 — 걸려 있으면 이 블록이 그 필터와 무관하다는 사실을 캡션으로 말한다. */
  laneFiltered?: boolean;
  /** note.id → 스플래시 목록(page.tsx가 빌드 타임에 파일 존재까지 확인해 넘긴다). */
  skinPreviews?: Record<string, CosmeticSkinItem[]>;
}

interface EntityBundle {
  entity: string;
  notes: PatchNoteItem[];
}

/** 카테고리 안의 줄을 엔티티 단위로 묶는다 — 문서 등장 순서 유지(releaseStream과 같은 관례). */
function bundleByEntity(notes: readonly PatchNoteItem[]): EntityBundle[] {
  const order: string[] = [];
  const byEntity = new Map<string, EntityBundle>();
  for (const note of notes) {
    const existing = byEntity.get(note.entity);
    if (existing) {
      existing.notes.push(note);
      continue;
    }
    order.push(note.entity);
    byEntity.set(note.entity, { entity: note.entity, notes: [note] });
  }
  return order.map((entity) => byEntity.get(entity)!);
}

export default function MiscChangesSection({ sections, skinPreviews = {}, laneFiltered = false }: MiscChangesSectionProps) {
  const total = sections.reduce((sum, section) => sum + section.notes.length, 0);
  if (total === 0) return null;
  // 중복 제거의 단위는 묶음이 아니라 **이 블록 전체**다(2026-09-19 재판정): 오리아나 3행이 두
  // 묶음에 걸쳐 있어 묶음 단위로는 3회가 2회로 줄 뿐이었다. 사용자에게 보이는 것은 묶음 경계가
  // 아니라 같은 그림이 두 번 뜬다는 사실이다.
  const dedupeSkins = createSkinDeduper();
  return (
    <li className="border-b border-border-soft last:border-b-0">
      {/* `group/misc` — 요약행(group/fold)과 같은 규약으로 이름을 준다. */}
      <details className="group/misc">
        <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3 text-xs text-muted [&::-webkit-details-marker]:hidden">
          <span className="font-bold text-fg-2">기타 변경</span>
          <span className="font-mono tabular-nums">{total}건</span>
          <span className="truncate text-muted">{sections.map((s) => s.label).join(" · ")}</span>
          {/* 2026-09-19 사용자 결정항목: 라인을 골라도 이 블록은 그대로 남는다. 버그 수정·스킨·
              증강·게임 모드 줄에는 라인 축이 원리적으로 없기 때문이고(클래식 피오라에 SR 라인을
              귀속시키는 건 방금 고친 그 오류의 재발이다), 그러면 화면이 그 사실을 말해야 한다. */}
          {laneFiltered ? <span className="text-muted">라인과 무관한 변경</span> : null}
          <span className="flex-1" />
          <span aria-hidden="true" className="transition-transform group-open/misc:rotate-180">
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-border-soft bg-surface-warm/30 px-5 py-4">
          {sections.map((section) => {
            const bundles = bundleByEntity(section.notes);
            // 엔티티 머리글은 **구분이 생길 때만** 단다. 버그 수정처럼 엔티티가 한 종류면 카테고리
            // 라벨과 같은 말을 두 번 하는 셈이라 오히려 위계가 흐려진다.
            const showEntityHeading = bundles.length > 1;
            return (
              <section
                key={section.category}
                aria-label={section.label}
                className="overflow-hidden rounded-md border border-border-soft bg-surface"
              >
                <h3 className="flex items-baseline gap-2 border-b border-border-soft bg-surface-warm px-4 py-2 text-xs font-bold text-fg-2">
                  {section.label}
                  <span className="font-mono font-normal tabular-nums text-muted">{section.notes.length}건</span>
                </h3>
                <div className="flex flex-col gap-3 px-4 py-3">
                  {bundles.map((bundle) => (
                    <div key={bundle.entity}>
                      {showEntityHeading ? (
                        <p className="mb-1 font-display text-sm font-bold text-fg">{bundle.entity}</p>
                      ) : null}
                      <ul className="flex flex-col gap-1">
                        {groupNotesBySkill(bundle.notes).map((group) => (
                          <li key={group.key} className="text-sm leading-relaxed text-fg-2">
                            {group.skill ? <span className="mr-1.5 font-bold text-fg">{group.skill}</span> : null}
                            {group.notes.map((note) => note.summary).join(" · ")}
                          </li>
                        ))}
                      </ul>
                      {/* 2026-09-19 최종 채점 K2-5: 스플래시를 줄마다 그리면 "스킨 및 테두리"·
                          "이벤트 크로마"·"앞으로 나올 스킨" 세 줄이 같은 그림을 세 번 띄운다. 줄은
                          서로 다른 항목이라 합칠 수 없지만 그림은 같으므로, 묶음당 한 번만 그린다. */}
                      <CosmeticSkinPreview skins={dedupeSkins(bundle.notes, skinPreviews)} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </details>
    </li>
  );
}
