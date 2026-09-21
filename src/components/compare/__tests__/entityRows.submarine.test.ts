// V3 RED — 대조표 행에 수치 축을 얹는다(축A 지적: buildSubmarineIndex가 죽은 코드였다).
import { describe, it, expect } from "vitest";
import { buildEntityRows } from "../entityRows";
import { buildSubmarineIndex } from "@/pipeline/gamedata/submarine";
import type { GameDataDiffFile } from "@/pipeline/gamedata/types";
import type { DeltaRecord } from "@/pipeline/types";

function delta(over: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "d",
    entityType: "item",
    entityKey: "3095",
    entityName: "폭풍갈퀴",
    metric: "pickRate",
    scope: { kind: "all" },
    before: 0.1,
    after: 0.06,
    delta: -0.04,
    ci: [-0.05, -0.03],
    n: { before: 10000, after: 10000 },
    q: 0.001,
    status: "unannounced",
    evidence: null,
    causes: [],
    matchedNoteIds: [],
    ...over,
  } as unknown as DeltaRecord;
}

const DIFF: GameDataDiffFile = {
  meta: {
    game: "lol",
    from: "26.16",
    to: "26.17",
    source: { kind: "ddragon", from: "16.16.1", to: "16.17.1" },
    generatedAt: "2026-09-21T00:00:00Z",
    changeCount: 1,
    submarineCount: 1,
  },
  changes: [
    {
      id: "gdc:lol:26.17:3095:gold.total",
      entityKey: "3095",
      entityName: "폭풍갈퀴",
      entityType: "item",
      field: "가격",
      fieldPath: "gold.total",
      before: 3000,
      after: 3200,
      relChange: 200 / 3000,
      matchedNoteIds: [],
    },
  ],
};

describe("buildEntityRows — 수치 축 얹기", () => {
  const index = buildSubmarineIndex([DIFF]);

  it("색인이 없으면 기존 동작 그대로", () => {
    const [row] = buildEntityRows([delta({})], "all");
    expect(row.status).toBe("unannounced");
  });

  it("★ 수치 변경이 있는 엔티티는 잠수함으로 올라간다", () => {
    const [row] = buildEntityRows([delta({})], "all", undefined, index);
    expect(row.status).toBe("submarine");
    expect(row.submarineChanges.map((c) => c.field)).toEqual(["가격"]);
  });

  it("색인에 없는 엔티티는 안 건드린다", () => {
    const [row] = buildEntityRows(
      [delta({ entityKey: "6610", entityName: "갈라진 하늘" })],
      "all",
      undefined,
      index
    );
    expect(row.status).toBe("unannounced");
    expect(row.submarineChanges).toEqual([]);
  });

  it("entityType이 다르면 다른 엔티티다 — 아이템 3095와 챔피언 3095는 별개", () => {
    // 챔피언 행은 `id`에서 라인 축을 읽는다(laneOf) — 실제 포맷을 쓴다.
    const [row] = buildEntityRows(
      [delta({ entityType: "champion", id: "champion:3095:winRate", metric: "winRate" })],
      "all",
      undefined,
      index
    );
    expect(row.status).toBe("unannounced");
    expect(row.submarineChanges).toEqual([]);
  });

  it("잠수함 행이 미공지 행보다 앞에 온다", () => {
    const rows = buildEntityRows(
      [delta({}), delta({ id: "d2", entityKey: "6610", entityName: "갈라진 하늘", delta: -0.09 })],
      "all",
      undefined,
      index
    );
    expect(rows[0].entityName).toBe("폭풍갈퀴");
    expect(rows[0].status).toBe("submarine");
  });
});
