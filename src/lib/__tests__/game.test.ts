// src/lib/__tests__/game.test.ts
// 게임 스위처 경로 계산 — 이 파일이 고정하는 핵심 위험은 **존재하지 않는 라우트로 보내는 것**이다.
// `/item/[id]`는 LoL 전용이고(PLAN-game-switcher-2026-09-17 X2), 정적 export라 404가 곧 빈
// 페이지다. 게임 전환은 어떤 경로에서 눌러도 반드시 실재하는 라우트에 착지해야 한다.
import { describe, expect, it } from "vitest";
import { GAMES, gameFromPathname, gameHref, gameLabel } from "../game";

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
  it("공용 섹션은 같은 섹션끼리 이동한다", () => {
    expect(gameHref("pubg", "/")).toBe("/pubg/");
    expect(gameHref("pubg", "/compare/")).toBe("/pubg/compare/");
    expect(gameHref("pubg", "/methodology/")).toBe("/pubg/methodology/");
    expect(gameHref("lol", "/pubg/")).toBe("/");
    expect(gameHref("lol", "/pubg/compare/")).toBe("/compare/");
    expect(gameHref("lol", "/pubg/methodology/")).toBe("/methodology/");
  });

  it("대응 라우트가 없는 경로에서는 그 게임의 브리핑으로 떨어진다 — 404 방지", () => {
    expect(gameHref("pubg", "/item/aatrox-winrate/")).toBe("/pubg/");
    expect(gameHref("pubg", "/item/aatrox-winrate")).toBe("/pubg/");
  });

  it("같은 게임을 고르면 현재 경로를 그대로 둔다 — 상세 화면에서 이탈시키지 않는다", () => {
    expect(gameHref("lol", "/item/aatrox-winrate/")).toBe("/item/aatrox-winrate/");
    expect(gameHref("pubg", "/pubg/compare/")).toBe("/pubg/compare/");
  });

  it("후행 슬래시가 없어도 같은 결과를 낸다 — next.config trailingSlash 유무에 안 물린다", () => {
    expect(gameHref("pubg", "/compare")).toBe("/pubg/compare/");
    expect(gameHref("lol", "/pubg/compare")).toBe("/compare/");
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
