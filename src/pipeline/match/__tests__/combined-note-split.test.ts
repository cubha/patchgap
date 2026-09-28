// src/pipeline/match/__tests__/combined-note-split.test.ts
// C2(2026-09-28, 잔여 로드맵 PR-B) — 한 노트가 여러 아이템을 한 이름으로 묶고(「세계 지도집과 룬 나침반」)
// 단계값(30/100/200)을 늘어놓으면, 어느 값이 어느 아이템인지 파서가 몰랐다 → LLM이 「룬 나침반 30→0」
// (실제는 세계 지도집 값)이라고 썼다. DDragon 수치를 before/after 두 버전에서 대조해 **값이 유일하게
// 맞는 아이템**에만 단계를 배정하고 하위 노트로 나눈다. 하나라도 안 맞으면 현행 유지(지어내지 않는다).
import { describe, expect, it } from "vitest";
import { splitCombinedNotes, type ItemStatTable } from "../combined-note-split";
import type { PatchNoteItem } from "../../types";

const table = (rows: Record<string, Record<string, number>>): ItemStatTable => ({
  byName: (name) => (rows[name] ? [{ id: name, stats: rows[name] }] : []),
});
const before = table({ "세계 지도집": { FlatHPPoolMod: 30 }, "룬 나침반": { FlatHPPoolMod: 100 }, "세계의 결실": { FlatHPPoolMod: 200 } });
const after = table({ "세계 지도집": {}, "룬 나침반": { FlatHPPoolMod: 60 }, "세계의 결실": { FlatHPPoolMod: 200 } });
const note = (stat: string, b: string, a: string, extra: Partial<PatchNoteItem> = {}): PatchNoteItem => ({
  id: `note:26.19:item:세계-지도집과-룬-나침반:${stat}`,
  patch: "26.19", section: "item", entity: "세계 지도집과 룬 나침반", skill: null, stat, before: b, after: a,
  direction: "adjust", summary: `${stat}: ${b} ⇒ ${a}`, anchorUrl: "https://x/#patch-items", anchorKind: "section", modeScope: "core", ...extra,
});

describe("splitCombinedNotes", () => {
  const hp = note("체력", "30/100/200", "0/60/200");
  const regen = note("체력 재생", "25%/50%/75%", "50%/75%/75%");
  const other = { ...note("체력", "1", "2"), id: "x", entity: "다른 아이템" };

  it("DDragon 값이 유일하게 맞는 아이템으로 단계를 나누고, 바뀌지 않은 단계는 빼다", () => {
    const { items, report } = splitCombinedNotes([hp, other], before, after);
    const split = items.filter((n) => n.stat === "체력" && n.entity !== "다른 아이템");
    expect(split.map((n) => [n.entity, n.before, n.after, n.direction])).toEqual([
      ["세계 지도집", "30", "0", "nerf"],
      ["룬 나침반", "100", "60", "nerf"],
    ]);
    expect(split.every((n) => n.summary.includes("세계 지도집과 룬 나침반"))).toBe(true);
    expect(items).toContainEqual(other);
    expect(report).toContainEqual(expect.objectContaining({ entity: "세계 지도집과 룬 나침반", outcome: "split" }));
  });

  it("DDragon에 없는 수치(체력 재생)는 같은 대상의 검증된 단계 배정을 따른다", () => {
    const { items } = splitCombinedNotes([hp, regen], before, after);
    expect(items.filter((n) => n.stat === "체력 재생").map((n) => [n.entity, n.before, n.after, n.direction])).toEqual([
      ["세계 지도집", "25%", "50%", "buff"],
      ["룬 나침반", "50%", "75%", "buff"],
    ]);
  });

  it("바뀐 단계가 어느 아이템과도 안 맞으면 현행 유지", () => {
    const wrong = note("체력", "30/100/200", "0/70/200");
    const { items, report } = splitCombinedNotes([wrong], before, after);
    expect(items).toEqual([wrong]);
    expect(report[0]).toMatchObject({ outcome: "kept" });
  });

  it("검증할 수치가 하나도 없으면 현행 유지", () => {
    const { items } = splitCombinedNotes([regen], before, after);
    expect(items).toEqual([regen]);
  });

  it("합친 이름이 아니면 건드리지 않는다", () => {
    const { items, report } = splitCombinedNotes([other], before, after);
    expect(items).toEqual([other]);
    expect(report).toEqual([]);
  });
});
