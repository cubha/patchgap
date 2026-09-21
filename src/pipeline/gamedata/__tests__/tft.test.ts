// ST-10 RED — TFT 어댑터. 실측(2026-09-21) 32건을 회귀로 고정한다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { diffTft, type CdragonSnapshot } from "../tft";
import { isSubmarineChange } from "../types";
import type { NoteLike } from "../note-link";

function snapshot(version: string): CdragonSnapshot {
  return {
    version,
    ...(JSON.parse(readFileSync(`data/cdragon/${version}/tft.json`, "utf8")) as Omit<
      CdragonSnapshot,
      "version"
    >),
  };
}

function notes(patch: string): NoteLike[] {
  return (
    JSON.parse(readFileSync(`data/aggregated/tft/notes-${patch}.json`, "utf8")) as {
      items: NoteLike[];
    }
  ).items;
}

describe("diffTft — 18.1 → 18.2 회귀 (실측 고정)", () => {
  const changes = diffTft(snapshot("16.17"), snapshot("16.18"), notes("18.2"), "18.2");
  const submarines = changes.filter(isSubmarineChange);

  it("수치 변경을 검출한다", () => {
    expect(changes.length).toBeGreaterThan(0);
  });

  it("★ 장로 드래곤 공격력 110 → 125가 잠수함으로 잡힌다", () => {
    const found = submarines.find(
      (c) => c.entityName === "장로 드래곤" && c.fieldPath === "stats.damage"
    );
    expect(found).toBeDefined();
    expect([found!.before, found!.after]).toEqual([110, 125]);
    expect(found!.relChange).toBeCloseTo(15 / 110, 6);
  });

  it("★ 조약돌·아무무도 잠수함에 들어 있다", () => {
    const names = new Set(submarines.map((c) => c.entityName));
    expect(names.has("조약돌")).toBe(true);
    expect(names.has("아무무")).toBe(true);
  });

  it("유닛과 아이템을 모두 본다", () => {
    const types = new Set(submarines.map((c) => c.entityType));
    expect(types.has("unit")).toBe(true);
    expect(types.has("item")).toBe(true);
  });

  it("노트에 이름이 있는 엔티티는 잠수함이 아니다", () => {
    const mentioned = new Set(
      notes("18.2")
        .map((n) => (n.entity ?? "").trim())
        .filter(Boolean)
    );
    for (const s of submarines) {
      expect(mentioned.has(s.entityName), `${s.entityName}이 노트에 있는데 잠수함으로 잡혔다`).toBe(
        false
      );
    }
  });

  it("부동소수점 잡음은 변경이 아니다 — 0.039999961 → 0.039999962 같은 것", () => {
    // CDragon은 float32를 그대로 낸다. 의미 없는 끝자리 차이를 수치 변경으로 읽으면
    // 잠수함이 수십 건 허위로 생긴다.
    const a: CdragonSnapshot = {
      version: "a",
      set: "TFTSet18",
      units: { U: { name: "테스트", cost: 1, stats: { damage: 0.039999961853027344 }, ability: {} } },
      items: {},
    };
    const b: CdragonSnapshot = {
      version: "b",
      set: "TFTSet18",
      units: { U: { name: "테스트", cost: 1, stats: { damage: 0.03999996185302735 }, ability: {} } },
      items: {},
    };
    expect(diffTft(a, b, [], "18.2")).toEqual([]);
  });
});
