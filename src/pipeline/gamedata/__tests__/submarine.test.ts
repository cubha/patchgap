// ST-8 RED — 수치 축을 표시 계층에 얹는다. MatchStatus는 건드리지 않는다.
import { describe, it, expect } from "vitest";
import { buildSubmarineIndex, displayStatusWithGameData } from "../submarine";
import { DISPLAY_SORT_PRIORITY } from "../../shared/display-status";
import type { GameDataDiffFile } from "../types";
import type { DeltaRecord } from "../../types";

const DIFF: GameDataDiffFile = {
  meta: {
    game: "lol",
    from: "26.16",
    to: "26.17",
    source: { kind: "ddragon", from: "16.16.1", to: "16.17.1" },
    generatedAt: "2026-09-21T00:00:00Z",
    changeCount: 2,
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
    {
      id: "gdc:lol:26.17:3095:stats.PercentAttackSpeedMod",
      entityKey: "3095",
      entityName: "폭풍갈퀴",
      entityType: "item",
      field: "공격 속도",
      fieldPath: "stats.PercentAttackSpeedMod",
      before: 0.2,
      after: 0.25,
      relChange: 0.25,
      matchedNoteIds: ["note:stormrazor"],
    },
  ],
};

function record(over: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "d1",
    entityType: "item",
    entityKey: "3095",
    entityName: "폭풍갈퀴",
    metric: "pickRate",
    before: 0.1,
    after: 0.1,
    delta: 0,
    ci: null,
    n: { before: 10000, after: 10000 },
    q: null,
    status: "no-change",
    evidence: null,
    causes: [],
    matchedNoteIds: [],
    ...over,
  } as DeltaRecord;
}

describe("정렬 위계", () => {
  it("잠수함이 미공지보다 위다 — 증거 등급이 다르다", () => {
    expect(DISPLAY_SORT_PRIORITY.submarine).toBeLessThan(DISPLAY_SORT_PRIORITY.unannounced);
  });

  it("미공지는 여전히 이상 관측보다 위다 — 기존 위계는 안 흔든다", () => {
    expect(DISPLAY_SORT_PRIORITY.unannounced).toBeLessThan(
      DISPLAY_SORT_PRIORITY["announced-anomaly"]
    );
  });
});

describe("buildSubmarineIndex", () => {
  const idx = buildSubmarineIndex([DIFF]);

  it("노트 짝이 없는 변경만 담는다", () => {
    expect(idx.count).toBe(1);
    const changes = idx.changesOf("item", "3095");
    expect(changes).toHaveLength(1);
    expect(changes[0].fieldPath).toBe("gold.total");
  });

  it("공지된 변경은 잠수함 색인에 없다", () => {
    expect(idx.changesOf("item", "3095").some((c) => c.matchedNoteIds.length > 0)).toBe(false);
  });

  it("없는 엔티티는 빈 배열", () => {
    expect(idx.changesOf("champion", "Nautilus")).toEqual([]);
    expect(idx.has("champion", "Nautilus")).toBe(false);
  });

  it("entityType이 다르면 다른 엔티티다", () => {
    expect(idx.has("item", "3095")).toBe(true);
    expect(idx.has("champion", "3095")).toBe(false);
  });
});

describe("displayStatusWithGameData", () => {
  it("★ 지표가 하나도 안 움직여도 수치가 바뀌었으면 잠수함이다", () => {
    // 이 한 줄이 이 기능의 존재 이유다 — 기존 파이프라인은 no-change를 화면에서 지운다.
    expect(displayStatusWithGameData(record({ status: "no-change" }), true)).toBe("submarine");
  });

  it("미공지 행에 수치 변경이 겹치면 잠수함으로 올라간다", () => {
    expect(displayStatusWithGameData(record({ status: "unannounced" }), true)).toBe("submarine");
  });

  it("수치 변경이 없으면 기존 표시 규칙 그대로", () => {
    expect(displayStatusWithGameData(record({ status: "unannounced" }), false)).toBe("unannounced");
    expect(displayStatusWithGameData(record({ status: "no-change" }), false)).toBe("no-change");
    expect(displayStatusWithGameData(record({ status: "indirect-effect" }), false)).toBe(
      "unannounced"
    );
  });
});
