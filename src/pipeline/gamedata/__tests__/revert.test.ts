// src/pipeline/gamedata/__tests__/revert.test.ts
// 수치 축 원복 표시(트랙 B ST-19, tft-S19). 리뷰 실측: TFT 18.4 다이애나 「최대 마나 30 → 40」은 18.1→18.2의 「40 → 30」을 되돌린
// 것인데 이전 쌍 맥락 없이 잠수함으로만 보였다. 직전 쌍들을 최신부터 거슬러, 같은 대상·같은 필드의 **정확히 반대** 변경이 있으면 그
// 변경의 패치를 단다. 사이에 같은 필드가 다른 값으로 또 바뀌었으면 단순 원복이 아니다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GameDataChange, GameDataDiffFile } from "../types";
import { findReverts } from "../revert";

const change = (over: Partial<GameDataChange>): GameDataChange => ({
  id: "gdc:tft:x:K:f",
  entityKey: "K",
  entityName: "케이",
  entityType: "unit",
  field: "최대 마나",
  fieldPath: "stats.mana",
  before: 30,
  after: 40,
  relChange: 0.333,
  matchedNoteIds: [],
  ...over,
});

describe("findReverts", () => {
  it("직전 쌍들 중 정확히 반대인 변경의 패치를 단다", () => {
    const cur = [change({ id: "c1" })];
    const prev = [
      { to: "18.3", changes: [] },
      { to: "18.2", changes: [change({ id: "p1", before: 40, after: 30 })] },
    ];
    expect(findReverts(cur, prev)).toEqual({ c1: "18.2" });
  });

  it("사이에 같은 필드가 다른 값으로 바뀌었으면 원복이 아니다", () => {
    const cur = [change({ id: "c1" })];
    const prev = [
      { to: "18.3", changes: [change({ id: "p2", before: 35, after: 30 })] },
      { to: "18.2", changes: [change({ id: "p1", before: 40, after: 30 })] },
    ];
    expect(findReverts(cur, prev)).toEqual({});
  });

  it("다른 대상·다른 필드는 무관", () => {
    const cur = [change({ id: "c1" })];
    const prev = [{ to: "18.2", changes: [change({ id: "p1", entityKey: "Other", before: 40, after: 30 }), change({ id: "p2", fieldPath: "stats.hp", before: 40, after: 30 })] }];
    expect(findReverts(cur, prev)).toEqual({});
  });

  it("실측 — TFT 18.3→18.4 다이애나 최대 마나는 18.2 변경 원복", () => {
    const dir = path.resolve(__dirname, "../../../../data/aggregated/gamedata/tft");
    const load = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as GameDataDiffFile;
    const cur = load("18.3_18.4.json");
    const prev = ["18.2_18.3.json", "18.1_18.2.json"].map(load).map((d) => ({ to: d.meta.to, changes: d.changes }));
    const reverts = findReverts(cur.changes, prev);
    const diana = cur.changes.find((c) => c.entityKey === "DA_18_Diana" && c.fieldPath === "stats.mana");
    expect(diana).toBeDefined();
    expect(reverts[diana!.id]).toBe("18.2");
  });
});
