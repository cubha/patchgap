// scripts/__tests__/migrate-note-directions.test.ts — C10 방향만 마이그레이션(2026-09-28).
import { describe, expect, it } from "vitest";
import { migrateDirections } from "../run-migrate-note-directions";
import type { PatchNoteItem } from "../../src/pipeline/types";

const note = (id: string, direction: PatchNoteItem["direction"], modeScope: PatchNoteItem["modeScope"] = "core"): PatchNoteItem =>
  ({ id, patch: "26.17", section: "item", entity: "x", skill: null, stat: "가격", before: "2", after: "1", direction, summary: "s", anchorUrl: "u", anchorKind: "entity", modeScope }) as PatchNoteItem;

describe("migrateDirections", () => {
  it("id가 양쪽에 있는 항목의 방향만 옮기고, 나머지 필드·순서는 그대로 둔다", () => {
    const { items, changes } = migrateDirections([note("a", "nerf", "classic"), note("b", "buff")], [note("a", "buff", "classic"), note("b", "buff")]);
    expect(items.map((n) => [n.id, n.direction])).toEqual([["a", "buff"], ["b", "buff"]]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: "a", from: "nerf", to: "buff", modeScope: "classic" });
  });
  it("재파싱에 없는 id는 건드리지 않고, 새로 생긴 id는 들이지 않는다", () => {
    const { items, changes } = migrateDirections([note("gone", "nerf")], [note("new", "buff")]);
    expect(items.map((n) => n.id)).toEqual(["gone"]);
    expect(items[0].direction).toBe("nerf");
    expect(changes).toEqual([]);
  });
});
