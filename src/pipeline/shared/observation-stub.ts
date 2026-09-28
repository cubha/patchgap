// src/pipeline/shared/observation-stub.ts — 구현 전 시그니처(C14).
import type { ObservationFailure, ObservationFailReason } from "../types";
export interface ObservationStubFile {
  meta: { game: "tft" | "pubg"; from: string; to: string; generatedAt: string; noteCount: number; observationFailed: ObservationFailure };
  rows: [];
}
export function buildObservationStub(_g: "tft" | "pubg", _f: string, _t: string, _x: ObservationFailure, _n: number): ObservationStubFile {
  throw new Error("TODO(C14): buildObservationStub");
}
export function isObservationStub(_meta: unknown): boolean {
  throw new Error("TODO(C14): isObservationStub");
}
export function deltasStateOf(_file: unknown, _from: string, _to: string): { kind: "none" } | { kind: "stub" } | { kind: "observed" } {
  throw new Error("TODO(C14): deltasStateOf");
}
export function observationReasonLabel(_r: ObservationFailReason): string {
  throw new Error("TODO(C14): observationReasonLabel");
}
