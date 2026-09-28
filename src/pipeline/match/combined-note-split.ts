// src/pipeline/match/combined-note-split.ts — C2 구현 전 시그니처.
import type { PatchNoteItem } from "../types";
export interface ItemStatTable {
  byName(name: string): { id: string; stats: Record<string, number> }[];
}
export interface SplitReport {
  entity: string;
  outcome: "split" | "kept";
  reason: string;
}
export function splitCombinedNotes(
  _notes: readonly PatchNoteItem[],
  _before: ItemStatTable,
  _after: ItemStatTable
): { items: PatchNoteItem[]; report: SplitReport[] } {
  throw new Error("TODO(C2): splitCombinedNotes");
}
