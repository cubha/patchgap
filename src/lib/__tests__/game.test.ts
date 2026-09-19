// src/lib/__tests__/game.test.ts
// 게임 스위처 경로 계산 — 이 파일이 고정하는 핵심 위험은 **존재하지 않는 라우트로 보내는 것**이다.
// `/item/[id]`는 LoL 전용이고(PLAN-game-switcher-2026-09-17 X2), 정적 export라 404가 곧 빈
// 페이지다. 게임 전환은 어떤 경로에서 눌러도 반드시 실재하는 라우트에 착지해야 한다.
import { describe, expect, it } from "vitest";
import { GAMES, gameFromPathname, gameHref, gameLabel,
  sectionHref,
} from "../game";

describe("gameFromPathname", () => {
  it("/pubg 접두가 붙은 경로는 pubg다", () => {
    for (const p of ["/pubg/", "/pubg/compare/", "/pubg/methodology/"]) {
      expect(gameFromPathname(p), p).toBe("pubg");
    }
  });

  it("그 외는 전부 lol이다 — LoL이 접두 없는 기본 게임이다(X1)", () => {
    for (const p of ["/", "/compare/", "/methodology/", "/item/aatrox-winrate/"]) {
      expect(gameFromPathname(p), p).toBe("lol");
    }
  });

  it("`/pubgfoo/`처럼 접두가 아닌 유사 경로를 pubg로 오인하지 않는다", () => {
    expect(gameFromPathname("/pubgfoo/")).toBe("lol");
  });
});

describe("gameHref", () => {
  // 2026-09-18 라운드6(사용자 C2) 명세 변경: "배틀그라운드, 리그오브레전드 변환하는데 메뉴는 유지됨 →
  // 브리핑 메뉴가 기본값. 테마전환될때마다 초기화되도록". 다른 게임으로 바꾸면 **어느 화면에서든** 그
  // 게임의 브리핑으로 간다(같은 섹션으로 건너뛰지 않는다).
  it("다른 게임으로 바꾸면 어느 섹션에서든 그 게임의 브리핑으로 간다", () => {
    expect(gameHref("pubg", "/")).toBe("/pubg/");
    expect(gameHref("pubg", "/compare/")).toBe("/pubg/");
    expect(gameHref("pubg", "/methodology/")).toBe("/pubg/");
    expect(gameHref("lol", "/pubg/")).toBe("/");
    expect(gameHref("lol", "/pubg/compare/")).toBe("/");
    expect(gameHref("lol", "/pubg/methodology/")).toBe("/");
  });

  it("대응 라우트가 없는 경로(상세)에서도 브리핑 — 404 방지", () => {
    expect(gameHref("pubg", "/item/aatrox-winrate/")).toBe("/pubg/");
    expect(gameHref("lol", "/pubg/weapon/rpd/")).toBe("/");
  });

  it("같은 게임을 고르면 현재 경로를 그대로 둔다 — 상세 화면에서 이탈시키지 않는다", () => {
    expect(gameHref("lol", "/item/aatrox-winrate/")).toBe("/item/aatrox-winrate/");
    expect(gameHref("pubg", "/pubg/compare/")).toBe("/pubg/compare/");
  });

  it("후행 슬래시가 없어도 같은 결과를 낸다", () => {
    expect(gameHref("pubg", "/compare")).toBe("/pubg/");
    expect(gameHref("lol", "/pubg/compare")).toBe("/");
  });
});

describe("GAMES", () => {
  it("두 게임을 LoL 먼저 노출한다 — 진입 기본값이 LoL이다(HANDOFF §3)", () => {
    expect(GAMES.map((g) => g.id)).toEqual(["lol", "pubg"]);
  });

  it("드롭다운 라벨은 사용자가 말한 한국어 정식 명칭이다", () => {
    expect(gameLabel("lol")).toBe("리그 오브 레전드");
    expect(gameLabel("pubg")).toBe("배틀그라운드");
  });
});

describe("sectionHref — 내비 섹션 경로(2026-09-19 회귀 수정)", () => {
  // 실측 결함: 내비가 `gameHref(game, "/" + section)`으로 링크를 만들고 있었다. 라운드6에서
  // gameHref가 "다른 게임이면 항상 그 게임의 브리핑"으로 바뀌면서, PUBG에서 대조표·방법론
  // 링크가 둘 다 `/pubg/`(브리핑)로 굳었다 — 사용자 보고: "대조표, 방법론 메뉴를 클릭해도
  // 안들어가지는 버그". 섹션 이동과 게임 전환은 서로 다른 계산이므로 함수를 가른다.
  it("LoL은 무접두, PUBG는 /pubg 접두이며 언제나 슬래시로 끝난다(trailingSlash:true)", () => {
    expect(sectionHref("lol", "")).toBe("/");
    expect(sectionHref("lol", "compare")).toBe("/compare/");
    expect(sectionHref("lol", "methodology")).toBe("/methodology/");
    expect(sectionHref("pubg", "")).toBe("/pubg/");
    expect(sectionHref("pubg", "compare")).toBe("/pubg/compare/");
    expect(sectionHref("pubg", "methodology")).toBe("/pubg/methodology/");
  });
});
