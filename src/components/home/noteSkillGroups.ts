// src/components/home/noteSkillGroups.ts
// 릴리즈노트 카드 안의 **스킬 단위 묶음** — 같은 스킬의 변경 줄(쿨타임·피해량·계수…)을 한 행에
// 인라인으로 모은다.
//
// **왜 필요한가**(사용자 지적, 2026-09-17): "동일한 스킬, 아이템 등에 대한 변경내용은
// 인라인으로 표시하도록 표시변경 — 현재는 동일한 스킬의 쿨타임, 데미지 등 변환이 전부
// 개별건으로 표시됨". 실측(26.18): 같은 `엔티티|스킬` 조합이 2줄 이상인 그룹이 **24개**이고,
// 최대는 카시오페아 `E - 쌍독니` **5줄**이다 — 첨부 이미지에서 같은 스펠 아이콘과 같은 뱃지가
// 다섯 번 반복되던 그 카드다.
//
// ⚠️ **`skill === null`은 절대 묶지 않는다**(실측 함정): 26.18의 `의회 - 투표 1 결과`는
// `section === "champion"`이면서 **skill이 null인 줄이 34개**다. 순진한 `groupBy(note.skill)`은
// 이 34줄을 한 행으로 뭉갠다 — 서로 다른 내용인데 스킬 이름이 비어 있다는 이유만으로. 그래서
// null은 **자기 id를 키로** 써서 원리적으로 병합되지 않게 한다.
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { STATUS_SORT_PRIORITY } from "@/pipeline/shared/status-order";

export interface NoteSkillGroup {
  /** React key. skill이 있으면 `skill:{이름}`, 없으면 `note:{id}`(병합 불가 보장). */
  key: string;
  /** null이면 스킬 없는 단독 줄이다(스펠 아이콘도 렌더하지 않는다). */
  skill: string | null;
  /** 같은 스킬의 변경 줄들 — 패치노트 원문 순서 유지. */
  notes: PatchNoteItem[];
}

/**
 * 엔티티 그룹의 노트를 스킬 단위로 묶는다. 그룹 순서는 각 스킬이 **처음 등장한 순서**
 * (=패치노트 문서 순서)를 그대로 유지한다 — `releaseStream.groupNotesByEntity`와 같은 관례다.
 */
export function groupNotesBySkill(notes: readonly PatchNoteItem[]): NoteSkillGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, NoteSkillGroup>();

  for (const note of notes) {
    // skill이 null이면 자기 id가 키 — 두 줄이 같은 키를 가질 수 없다.
    const key = note.skill ? `skill:${note.skill}` : `note:${note.id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.notes.push(note);
    } else {
      byKey.set(key, { key, skill: note.skill, notes: [note] });
      order.push(key);
    }
  }

  return order.map((key) => byKey.get(key)!);
}

/**
 * 스킬 행 1개에 붙일 **대표 델타** — 행이 하나로 접히면서 뱃지도 하나가 되어야 하기 때문이다.
 *
 * 선택 규칙: 이 행의 노트들에 짝지어진 델타 중 **상태 우선순위가 가장 높은 것**
 * (`STATUS_SORT_PRIORITY`: 미공지 0 → … → 변화 없음 6). 짝지어진 델타가 없으면 null이다
 * (관측하지 않은 것을 관측했다고 쓰지 않는다).
 *
 * **왜 최고 우선순위인가**: 한 행이 여러 상태를 갖는 경우 뱃지 하나로는 다 말할 수 없는데,
 * 그때 덜 중요한 쪽을 보여주면 발견이 숨는다. 실측(26.18)에서는 같은 스킬의 줄들이 같은
 * 델타를 공유해 이 분기가 실제로 갈리는 경우가 없었지만, 규칙은 명시해 둔다.
 */
export function representativeRecord(
  notes: readonly PatchNoteItem[],
  noteDeltas: Record<string, DeltaRecord>
): DeltaRecord | null {
  let best: DeltaRecord | null = null;
  for (const note of notes) {
    const record = noteDeltas[note.id];
    if (!record) continue;
    if (!best || STATUS_SORT_PRIORITY[record.status] < STATUS_SORT_PRIORITY[best.status]) {
      best = record;
    }
  }
  return best;
}
