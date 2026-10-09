// src/lib/__tests__/pair-routes.test.ts — B3 패치쌍 라우트(2026-09-28, PR-C · 사용자 결정 D3).
// 2026-09-28 이월 R8: 게임별 일반화(LoL·TFT)와 쌍 아래 섹션(대조표·상세) — 기존 LoL 케이스는 그대로 두고 덧붙였다.
import { describe, expect, it } from "vitest";
import {
  hasPairRoutes,
  historySectionOf,
  pairBasePath,
  pairFromPathname,
  pairFromSlug,
  pairSlug,
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
    expect(pairHref("lol", pairs[0], pairs[0])).toBe("/lol/");
    expect(pairHref("lol", pairs[1], pairs[0])).toBe("/lol/history/26_17-26_18/");
  });
  it("슬러그 왕복", () => {
    expect(pairSlug(pairs[2])).toBe("26_16-26_17");
    expect(pairFromSlug("26_16-26_17", pairs)).toEqual(pairs[2]);
    expect(pairFromSlug("26.10-26.11", pairs)).toBeNull();
    expect(pairFromSlug("../x", pairs)).toBeNull();
  });
  it("경로에서 지금 보는 쌍을 읽는다 — 과거 쌍 경로가 아니면 null(기본 쌍)", () => {
    expect(pairFromPathname("/lol/history/26_17-26_18/", pairs)).toEqual(pairs[1]);
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
  it("홈이 목록 첫 칸이 아니어도(최신이 선언만 stub) 홈이 평소 주소고, 더 새 쌍은 과거 쌍 라우트다", () => {
    // 2026-10-09(PLAN-home-observed-pair ST-2): 「평소 주소」의 주인은 목록 첫 칸이 아니라 **홈 쌍**(관측이 있는 최신 쌍).
    const newer = { from: "18.3", to: "18.4" };
    expect(pairHref("tft", tftPairs[0], tftPairs[0])).toBe("/tft/");
    expect(pairHref("tft", newer, tftPairs[0])).toBe("/tft/history/18_3-18_4/");
    expect(pairHref("tft", newer, tftPairs[0], "compare")).toBe("/tft/history/18_3-18_4/compare/");
    expect(pairSelectHref("tft", newer, tftPairs[0], "")).toBe("/tft/history/18_3-18_4/");
    expect(pairHref("tft", newer, null)).toBe("/tft/history/18_3-18_4/");
  });

  it("최신 쌍은 평소 주소, 과거 쌍은 /{game}/history/{쌍}/ — 섹션을 유지한다", () => {
    expect(pairHref("tft", tftPairs[0], tftPairs[0])).toBe("/tft/");
    expect(pairHref("tft", tftPairs[1], tftPairs[0])).toBe("/tft/history/18_1-18_2/");
    expect(pairHref("tft", tftPairs[0], tftPairs, "compare")).toBe("/tft/compare/");
    expect(pairHref("tft", tftPairs[1], tftPairs, "compare")).toBe("/tft/history/18_1-18_2/compare/");
    expect(pairHref("lol", pairs[2], pairs[0], "compare")).toBe("/lol/history/26_16-26_17/compare/");
  });
  it("기준 경로와 섹션 링크 — 기준이 없으면 평소 섹션", () => {
    const base = pairBasePath("lol", pairs[2]);
    expect(base).toBe("/lol/history/26_16-26_17");
    expect(pairSectionHref("lol", "", base)).toBe("/lol/history/26_16-26_17/");
    expect(pairSectionHref("lol", "compare", base)).toBe("/lol/history/26_16-26_17/compare/");
    expect(pairSectionHref("lol", "compare", null)).toBe("/lol/compare/");
  });
  it("쌍 아래 경로(대조표·상세)도 지금 보는 쌍으로 읽는다", () => {
    expect(pairFromPathname("/lol/history/26_16-26_17/compare/", pairs)).toEqual(pairs[2]);
    expect(pairFromPathname("/lol/history/26_16-26_17/item/champion~Ahri/", pairs)).toEqual(pairs[2]);
    expect(pairFromPathname("/tft/history/18_1-18_2/unit/unit~DA_18_Rakan/", tftPairs)).toEqual(tftPairs[1]);
    expect(pairFromPathname("/tft/compare/", tftPairs)).toBeNull();
    // 과거 쌍 라우트가 없는 게임의 같은 모양 경로는 읽지 않는다.
    expect(parseHistoryPath("/pubg/history/43.1-43.2/")).toBeNull();
    expect(parseHistoryPath("/lol/history/26_16-26_17/item/x/")).toEqual({
      game: "lol",
      slug: "26_16-26_17",
      rest: ["item", "x"],
    });
  });
  it("쌍 아래 섹션 — 헤더 활성 탭과 select 이동의 기준", () => {
    expect(historySectionOf("/lol/history/26_16-26_17/")).toBe("");
    expect(historySectionOf("/lol/history/26_16-26_17/compare/")).toBe("compare");
    expect(historySectionOf("/tft/history/18_1-18_2/unit/unit~A/")).toBe("unit");
    expect(historySectionOf("/lol/compare/")).toBeNull();
  });
  it("select 이동 — 같은 섹션의 그 쌍, 상세에서는 그 쌍의 브리핑(없는 상세 페이지로 보내지 않는다)", () => {
    expect(pairSelectHref("lol", pairs[1], pairs[0], "compare")).toBe("/lol/history/26_17-26_18/compare/");
    expect(pairSelectHref("lol", pairs[0], pairs[0], "compare")).toBe("/lol/compare/");
    expect(pairSelectHref("lol", pairs[1], pairs[0], "")).toBe("/lol/history/26_17-26_18/");
    expect(pairSelectHref("lol", pairs[1], pairs[0], "item")).toBe("/lol/history/26_17-26_18/");
    expect(pairSelectHref("lol", pairs[0], pairs[0], "item")).toBe("/lol/");
    expect(pairSelectHref("tft", tftPairs[1], tftPairs[0], "unit")).toBe("/tft/history/18_1-18_2/");
  });
});

describe("쌍 맥락이 링크에 실린다(이월 R8)", () => {
  const base = "/lol/history/26_16-26_17";
  it("대상 링크 — 기준이 있으면 그 쌍의 상세, 없으면 평소 상세", () => {
    const row = { entityType: "champion" as const, entityKey: "Ahri" };
    expect(lolEntityHref(row)).toBe("/lol/item/champion~Ahri/");
    expect(lolEntityHref(row, base)).toBe(`${base}/item/champion~Ahri/`);
    expect(tftEntityHref("unit:DA_18_Rakan")).toBe("/tft/unit/unit~DA_18_Rakan/");
    expect(tftEntityHref("unit:DA_18_Rakan", "/tft/history/18_1-18_2")).toBe(
      "/tft/history/18_1-18_2/unit/unit~DA_18_Rakan/"
    );
  });
  it("이동 경로 — 과거 쌍 상세의 「브리핑」「대조표」는 그 쌍 안이다", () => {
    expect(detailCrumbs("lol", "아리", base).map((c) => c.href)).toEqual([`${base}/`, `${base}/compare/`, undefined]);
    expect(compareCrumbs("tft", "/tft/history/18_1-18_2")[0].href).toBe("/tft/history/18_1-18_2/");
    // 기준이 없으면 예전과 같다.
    expect(detailCrumbs("lol", "아리").map((c) => c.href)).toEqual(["/lol/", "/lol/compare/", undefined]);
  });
  it("미공지 타일 — 과거 쌍 브리핑에서는 그 쌍의 대조표 칩으로", () => {
    expect(gapHrefOf("lol", base)).toBe(`${base}/compare/#unannounced`);
    expect(gapHrefOf("lol")).toBe("/lol/compare/#unannounced");
  });
  it("과거 쌍 상세도 상세 스플래시 레이어를 켠다", () => {
    expect(isItemDetailPath(`${base}/item/champion~Ahri/`)).toBe(true);
    expect(isItemDetailPath("/tft/history/18_1-18_2/unit/unit~A/")).toBe(true);
    expect(isItemDetailPath(`${base}/compare/`)).toBe(false);
    expect(isItemDetailPath(`${base}/`)).toBe(false);
  });
});

// 2026-09-28 명세 변경(이월 R8 후속): 슬러그에 점을 쓰지 않는다 — Next가 마지막 세그먼트의 점을 확장자로 보고
// 링크의 후행 슬래시를 떼 `out/…/index.html`과 어긋났다. 점 형식 주소는 받아만 준다.
describe("패치쌍 슬러그 — 점 없음", () => {
  it("만드는 슬러그·경로에 점이 없다", () => {
    const pair = { from: "26.16", to: "26.17" };
    expect(pairSlug(pair)).toBe("26_16-26_17");
    expect(pairBasePath("lol", pair)).not.toMatch(/\./);
  });
  it("점 형식 슬러그도 같은 쌍으로 푼다", () => {
    const pairs = [{ from: "26.17", to: "26.18" }, { from: "26.16", to: "26.17" }];
    expect(pairFromSlug("26.16-26.17", pairs)).toEqual(pairs[1]);
    expect(pairFromSlug("26_16-26_17", pairs)).toEqual(pairs[1]);
  });
});
