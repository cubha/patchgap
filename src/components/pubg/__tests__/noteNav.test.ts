// src/components/pubg/__tests__/noteNav.test.ts
// PUBG 노트 → 좌 내비 항목 변환. 한 줄이 여러 무기를 말하므로 **무기마다 한 항목**으로 펼친다.
import { describe, expect, it } from "vitest";
import { noteIdOfNavItem, pubgNoteNavItems, weaponKeyOfNavItem } from "../noteNav";
import type { PubgNoteItem } from "@/pipeline/match/pubg-delta";

const note = (over: Partial<PubgNoteItem> & Pick<PubgNoteItem, "id">): PubgNoteItem => ({
  patch: "43.1",
  weaponKeys: [],
  stat: "스폰율",
  before: null,
  after: null,
  direction: "nerf",
  expectedRelChange: null,
  summary: "요약",
  anchorUrl: "https://x",
  ...over,
});

const NAMES: Record<string, string> = { Item_Weapon_RPD_C: "RPD", Item_Weapon_M249_C: "M249" };
const nameOf = (k: string) => NAMES[k] ?? null;

describe("pubgNoteNavItems", () => {
  it("무기 2종을 말한 줄은 항목 2개가 된다 — 항목 단위는 대상이다", () => {
    const items = pubgNoteNavItems(
      [note({ id: "n1", weaponKeys: ["Item_Weapon_RPD_C", "Item_Weapon_M249_C"] })],
      nameOf
    );
    expect(items.map((i) => i.entity)).toEqual(["RPD", "M249"]);
    expect(new Set(items.map((i) => i.id)).size).toBe(2); // id가 갈려야 선택이 성립한다
  });

  it("보조 문구는 지표 이름이고 섹션은 「무기」다", () => {
    const [item] = pubgNoteNavItems([note({ id: "n1", weaponKeys: ["Item_Weapon_RPD_C"], stat: "반동 제어" })], nameOf);
    expect(item.detail).toBe("반동 제어");
    expect(item.sectionLabel).toBe("무기");
  });

  it("이름을 못 찾으면 키를 그대로 쓴다 — 지어내지 않는다", () => {
    const [item] = pubgNoteNavItems([note({ id: "n1", weaponKeys: ["Item_Weapon_Unknown_C"] })], nameOf);
    expect(item.entity).toBe("Item_Weapon_Unknown_C");
  });

  it("무기가 특정되지 않은 줄은 「체계」로 간다", () => {
    const [item] = pubgNoteNavItems([note({ id: "n1", stat: "차량 피해 배수" })], nameOf);
    expect(item.section).toBe("system");
    expect(item.entity).toBe("차량 피해 배수");
  });

  it("항목 id에서 원래 노트 id와 무기 키를 되찾는다", () => {
    const [item] = pubgNoteNavItems([note({ id: "n1", weaponKeys: ["Item_Weapon_RPD_C"] })], nameOf);
    expect(noteIdOfNavItem(item.id)).toBe("n1");
    expect(weaponKeyOfNavItem(item.id)).toBe("Item_Weapon_RPD_C");
    expect(weaponKeyOfNavItem("n1")).toBeNull();
  });
});
