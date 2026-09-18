// src/components/home/__tests__/streamSegments.test.ts
// 스트림 접힘 구간 분할(ST3, 2026-09-18 채점 라운드5 E2) — TDD RED 먼저.
// 원칙: **순서를 바꾸지 않고, 행을 잃지 않고**, 연속된 tier 2("관측 변화 없음") 항목만 하나의
// 접힘 구간으로 묶는다. 정렬은 page.tsx가 끝냈으므로 tier 2는 보통 한 덩어리지만, 그 가정에
// 기대지 않는다 — 정렬 규칙이 바뀌어도 이 함수는 참이어야 한다.
import { describe, expect, it } from "vitest";
import type { ReleaseStreamEntry } from "../ReleaseNoteStream";
import { segmentStream } from "../streamSegments";

function entry(entity: string, tier?: 0 | 1 | 2 | 3 | 4, kind: "matched" | "unannounced" = "matched"): ReleaseStreamEntry {
  const group =
    kind === "matched"
      ? { kind: "matched" as const, entity, notes: [] }
      : { kind: "unannounced" as const, entity, deltas: [] };
  return { group, icon: { entityType: null, entityKey: null }, lanes: [], tier };
}

describe("segmentStream", () => {
  it("tier 2가 없으면 rows 구간 하나", () => {
    const entries = [entry("에코", 0), entry("바드", 1), entry("홀 오브 레전드", 4)];
    expect(segmentStream(entries)).toEqual([{ kind: "rows", entries }]);
  });

  it("연속된 tier 2는 하나의 collapsed 구간이고 앞뒤는 rows — 순서·행 수 불변", () => {
    const a = entry("에코", 0);
    const b = entry("바드", 1);
    const c1 = entry("카사딘", 2);
    const c2 = entry("마스터 이", 2);
    const c3 = entry("구인수의 격노검", 2);
    const d = entry("의회 - 투표 1 결과", 3);
    const e = entry("홀 오브 레전드", 4);
    const segments = segmentStream([a, b, c1, c2, c3, d, e]);
    expect(segments).toEqual([
      { kind: "rows", entries: [a, b] },
      { kind: "collapsed", entries: [c1, c2, c3] },
      { kind: "rows", entries: [d, e] },
    ]);
    expect(segments.flatMap((s) => s.entries)).toHaveLength(7);
  });

  it("tier 2가 떨어져 있으면 구간도 따로 — 억지로 합쳐 순서를 바꾸지 않는다", () => {
    const [a, b, c, d] = [entry("A", 2), entry("B", 1), entry("C", 2), entry("D", 2)];
    expect(segmentStream([a, b, c, d]).map((s) => [s.kind, s.entries.length])).toEqual([
      ["collapsed", 1],
      ["rows", 1],
      ["collapsed", 2],
    ]);
  });

  it("tier가 없는 항목(미공지 그룹)은 rows — 접지 않는다", () => {
    const gap = entry("오공", undefined, "unannounced");
    expect(segmentStream([gap])).toEqual([{ kind: "rows", entries: [gap] }]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(segmentStream([])).toEqual([]);
  });
});
