// src/components/pubg/PubgNoteClauses.tsx
// PUBG 「패치 내용」 탭의 조항 목록(트랙 B ST-4, 2026-10-11 site-review pubg-S6).
//
// 왜: 탭 배지·타일 부제는 「조항 5」를 말하는데 탭 본문은 관측이 선 무기 2종 묶음뿐이라, 5가 무엇인지 브리핑 어디에서도
// 보이지 않았다(방법론 맨 아래에만 있었다). 조항을 노트 순서 그대로 나열하고, 기대값이 없는 조항(조준 전환·반동·차량 피해)은
// 회색 + 「이 데이터로 측정 불가」 — 숨김 상태 건수가 아니라 **데이터 한계**라 #78(숨김 사유 비노출)의 대상이 아니다(트랙 A ②(c)).
import ExternalLink from "@/components/ExternalLink";
import { weaponDisplayName } from "@/pipeline/aggregate/pubg-weapons";
import type { PubgNoteItem } from "@/pipeline/match/pubg-delta";

export default function PubgNoteClauses({ notes }: { notes: readonly PubgNoteItem[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="border-t border-border-soft px-5 py-4">
      <h3 className="mb-2 font-body text-xs font-bold tracking-wide text-muted">패치노트 조항 {notes.length}건</h3>
      <ul className="flex flex-col gap-2">
        {notes.map((n) => {
          const measurable = n.expectedRelChange !== null;
          const targets = n.weaponKeys.map(weaponDisplayName).join(" · ");
          return (
            <li key={n.id} data-note-clause={measurable ? "measurable" : "unmeasurable"} className="flex flex-col gap-0.5">
              <span className={`text-sm ${measurable ? "text-fg-2" : "text-muted"}`}>
                {targets ? <strong className={measurable ? "text-fg" : "text-muted"}>{targets} · </strong> : null}
                {n.summary}
                {measurable ? null : <span className="ml-2 font-mono text-xs text-muted">이 데이터로 측정 불가</span>}
              </span>
              <ExternalLink href={n.anchorUrl} className="w-fit font-mono text-xs text-accent hover:underline">
                원문 ↗
              </ExternalLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
