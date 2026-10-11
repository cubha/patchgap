// src/pipeline/gamedata/revert.ts — 수치 축 원복 감지(트랙 B ST-19). 구현 전 시그니처.
import type { GameDataChange } from "./types";

export function findReverts(
  current: readonly GameDataChange[],
  previous: readonly { to: string; changes: readonly GameDataChange[] }[]
): Record<string, string> {
  void current;
  void previous;
  throw new Error("TODO(revert): findReverts");
}
