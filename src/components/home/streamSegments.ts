// src/components/home/streamSegments.ts
// 스트림 접힘 구간 분할(2026-09-18, 채점 라운드5 E2). ST3 — TDD RED 단계 스텁.
import type { ReleaseStreamEntry } from "./ReleaseNoteStream";

export type StreamSegment =
  | { kind: "rows"; entries: ReleaseStreamEntry[] }
  | { kind: "collapsed"; entries: ReleaseStreamEntry[] };

export function segmentStream(_entries: readonly ReleaseStreamEntry[]): StreamSegment[] {
  throw new Error("TODO(ST3): segmentStream 미구현");
}
