// src/components/tft/__tests__/briefingOrder.test.ts
// TFT 브리핑 목록 정렬(트랙 B ST-18, tft-S15). 리뷰 실측: 머리 「32종」인데 12행만 렌더 — 기록을 15건으로 **먼저 자른 뒤** 대상으로
// 묶어서 대상 수가 줄었다. LoL·PUBG 브리핑은 상한이 없고 높이는 공용 패널 상수가 막는다. 정렬만 하고 자르지 않는다.
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { sortBriefingRows } from "../briefingOrder";

const row = (i: number, status: DeltaRecord["status"], delta: number): DeltaRecord =>
  ({
    id: `unit:U${i}:top4Rate`,
    entityType: "unit",
    entityKey: `U${i}`,
    entityName: `유닛${i}`,
    metric: "top4Rate",
    before: 0.5,
    after: 0.5 + delta,
    delta,
    ci: [delta - 0.01, delta + 0.01],
    n: { before: 1000, after: 1000 },
    q: 0.01,
    status,
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
  }) as unknown as DeltaRecord;

describe("sortBriefingRows", () => {
  it("자르지 않는다 — 40건이면 40건", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(i, "unannounced", (i + 1) / 1000));
    expect(sortBriefingRows(rows)).toHaveLength(40);
  });

  it("상태 우선순위 → 효과크기 순", () => {
    const rows = [row(1, "announced-consistent", 0.2), row(2, "unannounced", 0.01), row(3, "unannounced", 0.05)];
    expect(sortBriefingRows(rows).map((r) => r.entityKey)).toEqual(["U3", "U2", "U1"]);
  });
});
