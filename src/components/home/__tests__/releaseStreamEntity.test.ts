// src/components/home/__tests__/releaseStreamEntity.test.ts
import { describe, expect, it } from "vitest";
import type { DdragonData } from "@/pipeline/match/ddragon";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { resolveStreamEntityIcon } from "../releaseStreamEntity";
import type { UnannouncedStreamGroup, MatchedStreamGroup } from "../releaseStream";

function stubDdragon(): DdragonData {
  return {
    version: "16.18.1",
    champions: {
      byKey: () => undefined,
      byId: () => undefined,
      byKoName: (koName) => (koName === "초가스" ? { id: "Chogath", key: 31, name: "초가스" } : undefined),
    },
    items: {
      byId: () => undefined,
      byKoName: (koName) =>
        koName === "몰락한 왕의 검" ? [{ id: 3153, name: "몰락한 왕의 검", into: [], from: [], gold: { base: 0, purchasable: true, total: 3200, sell: 2240 }, tags: [] }] : [],
      isCompleted: () => false,
    },
  };
}

function stubNote(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "n1",
    patch: "26.17",
    section: "champion",
    entity: "초가스",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "",
    anchorUrl: "",
    anchorKind: "page",
    modeScope: "core",
    ...overrides,
  };
}

function stubDelta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Chogath:pickRate",
    entityType: "champion",
    entityKey: "Chogath",
    entityName: "초가스",
    metric: "pickRate",
    before: 0.1,
    after: 0.12,
    delta: 0.02,
    ci: [0.01, 0.03],
    n: { before: 100, after: 100 },
    q: 0.01,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "", noteAnchor: null },
    ...overrides,
  };
}

describe("resolveStreamEntityIcon", () => {
  it("unannounced 그룹은 DeltaRecord의 entityType/entityKey를 그대로 쓴다", () => {
    const group: UnannouncedStreamGroup = {
      kind: "unannounced",
      entity: "초가스",
      deltas: [stubDelta({})],
    };
    expect(resolveStreamEntityIcon(group, stubDdragon())).toEqual({
      entityType: "champion",
      entityKey: "Chogath",
    });
  });

  it("matched 챔피언 그룹은 ddragon byKoName으로 역조회한다", () => {
    const group: MatchedStreamGroup = {
      kind: "matched",
      entity: "초가스",
      notes: [stubNote({ section: "champion" })],
    };
    expect(resolveStreamEntityIcon(group, stubDdragon())).toEqual({
      entityType: "champion",
      entityKey: "Chogath",
    });
  });

  it("matched 아이템 그룹은 ddragon byKoName(items) 첫 후보를 쓴다", () => {
    const group: MatchedStreamGroup = {
      kind: "matched",
      entity: "몰락한 왕의 검",
      notes: [stubNote({ section: "item", entity: "몰락한 왕의 검" })],
    };
    expect(resolveStreamEntityIcon(group, stubDdragon())).toEqual({
      entityType: "item",
      entityKey: "3153",
    });
  });

  it("system/other 섹션은 null(무근거 아이콘 금지)", () => {
    const group: MatchedStreamGroup = {
      kind: "matched",
      entity: "체계 변경",
      notes: [stubNote({ section: "system", entity: "체계 변경" })],
    };
    expect(resolveStreamEntityIcon(group, stubDdragon())).toEqual({
      entityType: null,
      entityKey: null,
    });
  });

  it("ddragon 매핑 실패(신규 스킨 접두 등)도 null", () => {
    const group: MatchedStreamGroup = {
      kind: "matched",
      entity: "신규 아칼리",
      notes: [stubNote({ section: "champion", entity: "신규 아칼리" })],
    };
    expect(resolveStreamEntityIcon(group, stubDdragon())).toEqual({
      entityType: null,
      entityKey: null,
    });
  });
});
