// src/lib/__tests__/pair-routes.test.ts — B3 패치쌍 라우트(2026-09-28, PR-C · 사용자 결정 D3).
import { describe, expect, it } from "vitest";
import { lolPairHref, lolPairFromSlug, lolPairSlug, pairFromPathname } from "../pairRoutes";

const pairs = [
  { from: "26.18", to: "26.19" },
  { from: "26.17", to: "26.18" },
  { from: "26.16", to: "26.17" },
];

describe("LoL 패치쌍 라우트", () => {
  it("최신 쌍은 브리핑 홈, 과거 쌍은 /lol/history/{from}-{to}/", () => {
    expect(lolPairHref(pairs[0], pairs)).toBe("/lol/");
    expect(lolPairHref(pairs[1], pairs)).toBe("/lol/history/26.17-26.18/");
  });
  it("슬러그 왕복", () => {
    expect(lolPairSlug(pairs[2])).toBe("26.16-26.17");
    expect(lolPairFromSlug("26.16-26.17", pairs)).toEqual(pairs[2]);
    expect(lolPairFromSlug("26.10-26.11", pairs)).toBeNull();
    expect(lolPairFromSlug("../x", pairs)).toBeNull();
  });
  it("경로에서 지금 보는 쌍을 읽는다 — 과거 쌍 경로가 아니면 null(기본 쌍)", () => {
    expect(pairFromPathname("/lol/history/26.17-26.18/", pairs)).toEqual(pairs[1]);
    expect(pairFromPathname("/lol/", pairs)).toBeNull();
    expect(pairFromPathname("/lol/compare/", pairs)).toBeNull();
  });
});
