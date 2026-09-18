// src/components/item/NoteContrastPanel.tsx
// 항목 상세 "패치노트 대조"(ST-12 ④) — resolveNoteContrast 결과를 렌더한다.
//
// 2026-09-18 라운드6(사용자 L5): "각 항목마다 패치노트 원문보기 link가 보임. 패치노트 내용 전부 표시하고
// 하단에 링크는 한번만 (링크도 이동이 아닌 신규창열기)". 이전엔 줄마다 인용 + 링크가 반복돼(에코 2줄,
// 피오라는 65줄) 링크가 본문보다 많았다. 지금은 같은 스킬의 줄을 소제목 아래 모으고, 원문 링크는 카드
// 하단에 **1개**(`target="_blank" rel="noreferrer"`)만 둔다. 앵커는 첫 줄의 것을 쓴다 — 같은 엔티티의
// 줄은 같은 h3 앵커를 공유한다(파서 계약). 앵커 정밀도 캡션(섹션/페이지 앵커)은 링크 옆 1회.
// 짝 없음: "{to} 패치노트에 {엔티티} 항목 없음" + 인접(other/system) 항목이 있으면 참고로 + 그 앵커 1개.

import type { PatchNoteItem } from "@/pipeline/types";
import type { NoteContrastResult } from "./noteContrast";

export interface NoteContrastPanelProps {
  result: NoteContrastResult;
}

interface SkillBlock {
  key: string;
  skill: string | null;
  items: PatchNoteItem[];
}

/** 같은 스킬의 줄을 첫 등장 순서로 묶는다(홈 noteSkillGroups와 같은 규칙 — skill이 null이면 묶지 않는다). */
function groupBySkill(items: readonly PatchNoteItem[]): SkillBlock[] {
  const order: string[] = [];
  const byKey = new Map<string, SkillBlock>();
  for (const item of items) {
    const key = item.skill ? `skill:${item.skill}` : `note:${item.id}`;
    const block = byKey.get(key);
    if (block) {
      block.items.push(item);
      continue;
    }
    byKey.set(key, { key, skill: item.skill, items: [item] });
    order.push(key);
  }
  return order.map((key) => byKey.get(key)!);
}

function SourceLink({ href, caption }: { href: string; caption?: string | null }) {
  return (
    <div className="mt-auto flex items-center gap-2 border-t border-border-soft px-5 py-3">
      <a href={href} target="_blank" rel="noreferrer" className="text-sm font-bold text-accent hover:underline">
        패치노트 원문 보기 ↗
      </a>
      {caption ? <span className="text-xs text-muted">({caption})</span> : null}
    </div>
  );
}

export default function NoteContrastPanel({ result }: NoteContrastPanelProps) {
  if (result.status === "matched") {
    const first = result.matched[0];
    const blocks = groupBySkill(result.matched.map((m) => m.item));
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {blocks.map((block) => (
            <div key={block.key} className="flex flex-col gap-1.5">
              {block.skill ? <strong className="text-xs font-bold text-fg-2">{block.skill}</strong> : null}
              <ul className="flex flex-col gap-1 border-l-2 border-border pl-4">
                {block.items.map((item) => (
                  <li key={item.id} className="text-sm text-fg-2">
                    {item.stat && item.before && item.after ? (
                      <>
                        {item.stat}:{" "}
                        <span className="font-mono tabular-nums text-fg">
                          {item.before} ⇒ {item.after}
                        </span>
                      </>
                    ) : (
                      item.summary
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {first ? <SourceLink href={first.item.anchorUrl} caption={first.anchorCaption} /> : null}
      </div>
    );
  }

  const adjacentFirst = result.adjacent[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        <p className="text-sm text-muted">{result.message}</p>
        {result.adjacent.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-muted">같은 엔티티의 인접 항목</span>
            <ul className="flex flex-col gap-1 border-l-2 border-border pl-4">
              {result.adjacent.map((item) => (
                <li key={item.id} className="text-sm text-muted">
                  {item.summary}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {adjacentFirst ? <SourceLink href={adjacentFirst.anchorUrl} /> : null}
    </div>
  );
}
