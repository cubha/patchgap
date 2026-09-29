// src/components/home/__tests__/entityIndex.test.ts
// 브리핑 하단 바로가기의 규칙(UX-BRIEF §8-1).
// 2026-09-29 명세 변경(사용자 결정): 「전수를 내고 상세 있을 때만 링크」 → **상세가 있는 대상만 낸다**. 전수 격자는
// LoL 391칸 중 339칸·TFT 231칸 중 192칸이 누를 수 없는 「판정 없음」 이름표였다(PLAN-entity-index-quicklinks).
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
  it("상세가 없는 대상은 내지 않는다 — 누를 수 없는 칸을 만들지 않는다", () => {
    expect(buildEntityIndex(sources, () => false, href)).toHaveLength(0);
    expect(buildEntityIndex(sources, (_t, key) => key === "Ahri", href).map((e) => e.name)).toEqual(["아리"]);
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

  it("낸 대상은 전부 상세 링크를 가진다", () => {
    const out = buildEntityIndex(sources, () => true, href);
    expect(out.every((e) => e.href.startsWith("/lol/item/"))).toBe(true);
  });

  it("유형이 다르면 키가 같아도 다른 대상이다", () => {
    const out = buildEntityIndex(
      [
        { type: "unit", key: "X", name: "같은이름" },
        { type: "item", key: "X", name: "같은이름" },
      ],
      () => true,
      href
    );
    expect(out).toHaveLength(2);
  });
});
