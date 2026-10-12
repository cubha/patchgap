// src/lib/__tests__/gamedataReverts.test.ts — 원복 표 로더(트랙 B ST-19)가 디스크의 직전 쌍 사슬을 따라간다(18.3→18.4는 18.2→18.3,
// 18.1→18.2를 거슬러 다이애나 「40 → 30」을 찾는다 — 바로 앞 쌍만 보면 못 찾는다).
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { gameDataReverts, loadGameDataDiff } from "../gamedata";

describe("gameDataReverts", () => {
  it("TFT 18.3→18.4 다이애나 최대 마나 = 18.2 변경 원복(두 쌍 거슬러)", () => {
    const file = loadGameDataDiff("tft", "18.3", "18.4");
    expect(file).not.toBeNull();
    const diana = file!.changes.find((c) => c.entityKey === "DA_18_Diana" && c.fieldPath === "stats.mana")!;
    expect(gameDataReverts("tft", "18.3", "18.4")[diana.id]).toBe("18.2");
  });
  it("산출물이 없는 쌍은 빈 표", () => {
    expect(gameDataReverts("tft", "0.0", "0.1")).toEqual({});
  });
});
