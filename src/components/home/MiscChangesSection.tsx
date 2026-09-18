// src/components/home/MiscChangesSection.tsx
// 홈 "기타 변경" 블록(2026-09-18 라운드6, 사용자 L2) — 패치 내용 탭 목록의 **마지막 항목 1개**.
// 버그 수정·편의성 개선·신규 스킨·증강처럼 관측할 지표가 없는 줄을 카테고리별 소제목 아래 줄만
// 나열한다. 아이콘·배지·판정문은 없다 — "관측 불필요하기 때문에 관측없음 뱃지 불필요"(사용자).
// 분류는 miscSections.ts(순수)가 하고 여기선 그린다. 서버 컴포넌트(상태 없음, 네이티브 <details>).
// 골격은 같은 목록의 "관측 변화 없음" 요약행(ReleaseNoteStream.tsx)과 동일 — 한 목록 안에서 접힘 행이
// 두 가지 모양이면 위계가 흐려진다.

import type { MiscSection } from "./miscSections";

export interface MiscChangesSectionProps {
  sections: MiscSection[];
}

export default function MiscChangesSection({ sections }: MiscChangesSectionProps) {
  const total = sections.reduce((sum, section) => sum + section.notes.length, 0);
  if (total === 0) return null;
  return (
    <li className="border-b border-border-soft last:border-b-0">
      {/* `group/misc` — 안쪽에 group을 쓰는 요소가 없지만 요약행(group/fold)과 같은 규약으로 이름을 준다. */}
      <details className="group/misc">
        <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3 text-xs text-muted [&::-webkit-details-marker]:hidden">
          <span className="font-bold text-fg-2">기타 변경</span>
          <span className="font-mono tabular-nums">{total}건</span>
          <span className="truncate text-muted">{sections.map((s) => s.label).join(" · ")}</span>
          <span className="flex-1" />
          <span aria-hidden="true" className="transition-transform group-open/misc:rotate-180">
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-border-soft px-5 py-4">
          {sections.map((section) => (
            <section key={section.category} aria-label={section.label}>
              <h3 className="flex items-baseline gap-2 text-xs font-bold text-fg-2">
                {section.label}
                <span className="font-mono font-normal tabular-nums text-muted">{section.notes.length}</span>
              </h3>
              <ul className="mt-1.5 flex flex-col gap-1">
                {section.notes.map((note) => (
                  <li key={note.id} className="text-sm leading-relaxed text-fg-2">
                    {note.skill ? <span className="mr-1.5 font-bold text-fg">{note.skill}</span> : null}
                    {note.summary}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </li>
  );
}
