// src/components/home/__tests__/entityIndex.test.ts
// 전 대상 색인의 두 규칙(UX-BRIEF §8-1) — **전수**를 내고, **상세가 있을 때만** 링크한다.
import { describe, expect, it } from "vitest";
import { buildEntityIndex } from "../entityIndex";

const sources = [
  { type: "champion", key: "Zed", name: "제드" },
  { type: "champion", key: "Ahri", name: "아리" },
  { type: "item", key: "3504", name: "아리아의 찬가" },
  { type: "champion", key: "Zed", name: "제드" }, // 중복
];
const href = (type: string, key: string) => `/lol/item/${type}~${key}/`;

describe("buildEntityIndex", () => {
  it("판정 여부와 무관하게 전수를 낸다", () => {
    const out = buildEntityIndex(sources, () => false, href);
    expect(out).toHaveLength(3);
  });

  it("중복을 접는다 — 같은 대상이 두 줄이 되지 않는다", () => {
    expect(buildEntityIndex(sources, () => true, href).filter((e) => e.name === "제드")).toHaveLength(1);
  });

  it("이름 순으로 세운다", () => {
    expect(buildEntityIndex(sources, () => true, href).map((e) => e.name)).toEqual([
      "아리",
      "아리아의 찬가",
      "제드",
    ]);
  });

  it("상세가 없는 대상은 링크가 null이다 — 없는 경로를 만들지 않는다", () => {
    const out = buildEntityIndex(sources, (_t, key) => key === "Ahri", href);
    expect(out.find((e) => e.name === "아리")?.href).toBe("/lol/item/champion~Ahri/");
    expect(out.find((e) => e.name === "제드")?.href).toBeNull();
  });

  it("유형이 다르면 키가 같아도 다른 대상이다", () => {
    const out = buildEntityIndex(
      [
        { type: "unit", key: "X", name: "같은이름" },
        { type: "item", key: "X", name: "같은이름" },
      ],
      () => false,
      href
    );
    expect(out).toHaveLength(2);
  });
});
