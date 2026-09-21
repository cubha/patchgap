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

describe("buildEntityRows — 게이트 무관 전량 노출", () => {
  const index = buildSubmarineIndex([DIFF]);

  it("★ 델타가 아예 없어도 잠수함은 행이 만들어진다", () => {
    // 사용자 지시(2026-09-21): "간접영향은 표본부족, 바닥미달등 항목은 필터링되는게 맞는데
    // 잠수함패치는 그런것과 관계없이 전부보여야된다 — 패치내용에없는 항목이잖아".
    // 지표 축 게이트(유의성·바닥·표본)는 **지표 축에만** 건다.
    const rows = buildEntityRows([], "all", undefined, index);
    expect(rows).toHaveLength(1);
    expect(rows[0].entityName).toBe("폭풍갈퀴");
    expect(rows[0].status).toBe("submarine");
    expect(rows[0].cells).toEqual({});
    expect(rows[0].representative).toBeNull();
    expect(rows[0].submarineChanges).toHaveLength(1);
  });

  it("보고 자격을 못 넘긴 델타만 있어도 행이 만들어진다", () => {
    // no-change는 isReportableRecord가 거른다 — 그래도 잠수함이면 나와야 한다.
    const rows = buildEntityRows([delta({ status: "no-change", delta: 0 })], "all", undefined, index);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("submarine");
  });

  it("델타가 있는 잠수함은 행이 중복되지 않는다", () => {
    const rows = buildEntityRows([delta({})], "all", undefined, index);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("submarine");
    expect(rows[0].representative).not.toBeNull();
  });

  it("색인이 없으면 합성 행도 없다 — 기존 동작 불변", () => {
    expect(buildEntityRows([], "all")).toEqual([]);
  });
});

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
    // 색인의 폭풍갈퀴는 합성 행으로 따로 들어오므로 이름으로 찾는다(순서는 잠수함이 앞선다).
    const rows = buildEntityRows(
      [delta({ entityKey: "6610", entityName: "갈라진 하늘" })],
      "all",
      undefined,
      index
    );
    const row = rows.find((r) => r.entityName === "갈라진 하늘");
    expect(row).toBeDefined();
    expect(row!.status).toBe("unannounced");
    expect(row!.submarineChanges).toEqual([]);
  });

  it("entityType이 다르면 다른 엔티티다 — 아이템 3095와 챔피언 3095는 별개", () => {
    // 챔피언 행은 `id`에서 라인 축을 읽는다(laneOf) — 실제 포맷을 쓴다.
    const rows = buildEntityRows(
      [delta({ entityType: "champion", id: "champion:3095:winRate", metric: "winRate" })],
      "all",
      undefined,
      index
    );
    const row = rows.find((r) => r.entityType === "champion");
    expect(row).toBeDefined();
    expect(row!.status).toBe("unannounced");
    expect(row!.submarineChanges).toEqual([]);
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
    expect(rows.map((r) => r.entityName)).toHaveLength(2);
  });
});
