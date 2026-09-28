// src/lib/__tests__/pair-routes.test.ts — B3 패치쌍 라우트(2026-09-28, PR-C · 사용자 결정 D3).
// 2026-09-28 이월 R8: 게임별 일반화(LoL·TFT)와 쌍 아래 섹션(대조표·상세) — 기존 LoL 케이스는 그대로 두고 덧붙였다.
import { describe, expect, it } from "vitest";
import {
  hasPairRoutes,
  historySectionOf,
  lolPairHref,
  lolPairFromSlug,
  lolPairSlug,
  pairBasePath,
  pairFromPathname,
  pairHref,
  pairSectionHref,
  pairSelectHref,
  parseHistoryPath,
} from "../pairRoutes";
import { lolEntityHref } from "../detailRoutes";
import { tftEntityHref } from "../tftRoutes";
import { compareCrumbs, detailCrumbs } from "../breadcrumbs";
import { isItemDetailPath } from "../game";
import { gapHrefOf } from "@/components/StatTiles";

const pairs = [
  { from: "26.18", to: "26.19" },
  { from: "26.17", to: "26.18" },
  { from: "26.16", to: "26.17" },
];

const tftPairs = [
  { from: "18.2", to: "18.3" },
  { from: "18.1", to: "18.2" },
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

describe("패치쌍 라우트 — 게임별(LoL·TFT)", () => {
  it("라우트가 있는 게임은 LoL·TFT뿐이다(PUBG는 쌍이 하나)", () => {
    expect(hasPairRoutes("lol")).toBe(true);
    expect(hasPairRoutes("tft")).toBe(true);
    expect(hasPairRoutes("pubg")).toBe(false);
  });
  it("최신 쌍은 평소 주소, 과거 쌍은 /{game}/history/{쌍}/ — 섹션을 유지한다", () => {
    expect(pairHref("tft", tftPairs[0], tftPairs)).toBe("/tft/");
    expect(pairHref("tft", tftPairs[1], tftPairs)).toBe("/tft/history/18.1-18.2/");
    expect(pairHref("tft", tftPairs[0], tftPairs, "compare")).toBe("/tft/compare/");
    expect(pairHref("tft", tftPairs[1], tftPairs, "compare")).toBe("/tft/history/18.1-18.2/compare/");
    expect(pairHref("lol", pairs[2], pairs, "compare")).toBe("/lol/history/26.16-26.17/compare/");
  });
  it("기준 경로와 섹션 링크 — 기준이 없으면 평소 섹션", () => {
    const base = pairBasePath("lol", pairs[2]);
    expect(base).toBe("/lol/history/26.16-26.17");
    expect(pairSectionHref("lol", "", base)).toBe("/lol/history/26.16-26.17/");
    expect(pairSectionHref("lol", "compare", base)).toBe("/lol/history/26.16-26.17/compare/");
    expect(pairSectionHref("lol", "compare", null)).toBe("/lol/compare/");
  });
  it("쌍 아래 경로(대조표·상세)도 지금 보는 쌍으로 읽는다", () => {
    expect(pairFromPathname("/lol/history/26.16-26.17/compare/", pairs)).toEqual(pairs[2]);
    expect(pairFromPathname("/lol/history/26.16-26.17/item/champion~Ahri/", pairs)).toEqual(pairs[2]);
    expect(pairFromPathname("/tft/history/18.1-18.2/unit/unit~DA_18_Rakan/", tftPairs)).toEqual(tftPairs[1]);
    expect(pairFromPathname("/tft/compare/", tftPairs)).toBeNull();
    // 과거 쌍 라우트가 없는 게임의 같은 모양 경로는 읽지 않는다.
    expect(parseHistoryPath("/pubg/history/43.1-43.2/")).toBeNull();
    expect(parseHistoryPath("/lol/history/26.16-26.17/item/x/")).toEqual({
      game: "lol",
      slug: "26.16-26.17",
      rest: ["item", "x"],
    });
  });
  it("쌍 아래 섹션 — 헤더 활성 탭과 select 이동의 기준", () => {
    expect(historySectionOf("/lol/history/26.16-26.17/")).toBe("");
    expect(historySectionOf("/lol/history/26.16-26.17/compare/")).toBe("compare");
    expect(historySectionOf("/tft/history/18.1-18.2/unit/unit~A/")).toBe("unit");
    expect(historySectionOf("/lol/compare/")).toBeNull();
  });
  it("select 이동 — 같은 섹션의 그 쌍, 상세에서는 그 쌍의 브리핑(없는 상세 페이지로 보내지 않는다)", () => {
    expect(pairSelectHref("lol", pairs[1], pairs, "compare")).toBe("/lol/history/26.17-26.18/compare/");
    expect(pairSelectHref("lol", pairs[0], pairs, "compare")).toBe("/lol/compare/");
    expect(pairSelectHref("lol", pairs[1], pairs, "")).toBe("/lol/history/26.17-26.18/");
    expect(pairSelectHref("lol", pairs[1], pairs, "item")).toBe("/lol/history/26.17-26.18/");
    expect(pairSelectHref("lol", pairs[0], pairs, "item")).toBe("/lol/");
    expect(pairSelectHref("tft", tftPairs[1], tftPairs, "unit")).toBe("/tft/history/18.1-18.2/");
  });
});

describe("쌍 맥락이 링크에 실린다(이월 R8)", () => {
  const base = "/lol/history/26.16-26.17";
  it("대상 링크 — 기준이 있으면 그 쌍의 상세, 없으면 평소 상세", () => {
    const row = { entityType: "champion" as const, entityKey: "Ahri" };
    expect(lolEntityHref(row)).toBe("/lol/item/champion~Ahri/");
    expect(lolEntityHref(row, base)).toBe(`${base}/item/champion~Ahri/`);
    expect(tftEntityHref("unit:DA_18_Rakan")).toBe("/tft/unit/unit~DA_18_Rakan/");
    expect(tftEntityHref("unit:DA_18_Rakan", "/tft/history/18.1-18.2")).toBe(
      "/tft/history/18.1-18.2/unit/unit~DA_18_Rakan/"
    );
  });
  it("이동 경로 — 과거 쌍 상세의 「브리핑」「대조표」는 그 쌍 안이다", () => {
    expect(detailCrumbs("lol", "아리", base).map((c) => c.href)).toEqual([`${base}/`, `${base}/compare/`, undefined]);
    expect(compareCrumbs("tft", "/tft/history/18.1-18.2")[0].href).toBe("/tft/history/18.1-18.2/");
    // 기준이 없으면 예전과 같다.
    expect(detailCrumbs("lol", "아리").map((c) => c.href)).toEqual(["/lol/", "/lol/compare/", undefined]);
  });
  it("미공지 타일 — 과거 쌍 브리핑에서는 그 쌍의 대조표 칩으로", () => {
    expect(gapHrefOf("lol", base)).toBe(`${base}/compare/#unannounced`);
    expect(gapHrefOf("lol")).toBe("/lol/compare/#unannounced");
  });
  it("과거 쌍 상세도 상세 스플래시 레이어를 켠다", () => {
    expect(isItemDetailPath(`${base}/item/champion~Ahri/`)).toBe(true);
    expect(isItemDetailPath("/tft/history/18.1-18.2/unit/unit~A/")).toBe(true);
    expect(isItemDetailPath(`${base}/compare/`)).toBe(false);
    expect(isItemDetailPath(`${base}/`)).toBe(false);
  });
});
