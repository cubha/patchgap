// src/pipeline/shared/boundary.ts — 경계 판정(트랙 B ST-25). 구현 전 시그니처.
import type { DeltaMetric } from "../types";

export function isBoundaryRecord(r: { metric: DeltaMetric; delta: number | null; before: number | null; ci: readonly [number, number] | null }): boolean {
  void r;
  throw new Error("TODO(boundary): isBoundaryRecord");
}

export function isBoundaryPubgRow(row: { relCi: readonly [number, number] }, effectFloor: number): boolean {
  void row;
  void effectFloor;
  throw new Error("TODO(boundary): isBoundaryPubgRow");
}
