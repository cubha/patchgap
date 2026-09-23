// src/components/pubg/noteNav.ts
// PUBG 패치노트 줄 → 좌 내비의 게임 중립 항목(`compare/noteNav.ts`의 `NoteNavItem`).
//
// **왜 펼치나**: PUBG 노트 1줄은 여러 무기를 한꺼번에 말한다(「RPD·M249 스폰율 30% 감소」).
// 내비의 항목 단위는 **대상**이므로(§8-3), 무기마다 한 항목으로 펼친다 — 그러지 않으면 M249를
// 찾는 사람이 「스폰율」이라는 이름의 줄을 뒤져야 한다.
//
// 무기가 특정되지 않은 줄은 「체계」로 간다. 없는 무기 이름을 지어내지 않는다.
import type { NoteNavItem } from "@/components/compare/noteNav";
import type { PubgNoteItem } from "@/pipeline/match/pubg-delta";

export function pubgNoteNavItems(
  notes: readonly PubgNoteItem[],
  weaponName: (key: string) => string | null
): NoteNavItem[] {
  const out: NoteNavItem[] = [];
  for (const note of notes) {
    if (note.weaponKeys.length === 0) {
      out.push({
        id: note.id,
        entity: note.stat,
        section: "system",
        sectionLabel: "체계",
        summary: note.summary,
        detail: null,
      });
      continue;
    }
    for (const key of note.weaponKeys) {
      out.push({
        // 한 줄이 여러 항목이 되므로 id를 무기로 갈라야 React key와 선택이 성립한다.
        id: `${note.id}#${key}`,
        entity: weaponName(key) ?? key,
        section: "weapon",
        sectionLabel: "무기",
        summary: note.summary,
        detail: note.stat,
      });
    }
  }
  return out;
}

/** 내비 항목 id → 원래 노트 id. 표 행과 잇는 쪽은 무기 키를 쓰므로 이쪽은 진단·중복 제거용이다. */
export function noteIdOfNavItem(navItemId: string): string {
  const at = navItemId.indexOf("#");
  return at === -1 ? navItemId : navItemId.slice(0, at);
}

/** 내비 항목 id → 무기 키. 무기가 없는 줄이면 null. */
export function weaponKeyOfNavItem(navItemId: string): string | null {
  const at = navItemId.indexOf("#");
  return at === -1 ? null : navItemId.slice(at + 1);
}
