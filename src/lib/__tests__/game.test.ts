// src/lib/__tests__/game.test.ts
// 게임 스위처 경로 계산 — 이 파일이 고정하는 핵심 위험은 **존재하지 않는 라우트로 보내는 것**이다.
// `/lol/item/[id]`는 LoL 전용이고(PLAN-game-switcher-2026-09-17 X2), 정적 export라 404가 곧 빈
// 페이지다. 게임 전환은 어떤 경로에서 눌러도 반드시 실재하는 라우트에 착지해야 한다.
//
// **2026-09-19 명세 변경(사용자 지시)**: 루트에 랜딩이 생기고 LoL이 `/lol` 접두를 받는다. 이전
// 명세("무접두 = LoL, 모든 경로는 어느 한 게임에 속한다")는 폐기됐다 — 랜딩은 **어느 게임에도
// 속하지 않는** 첫 경로이므로 `gameFromPathname`이 `null`을 돌려줄 수 있어야 한다. 이 파일의
// 기존 단언 일부는 그래서 바뀌었고, 그것은 테스트 약화가 아니라 명세 반영이다.
import { describe, expect, it } from "vitest";
import {
  GAMES,
  gameFromPathname,
  gameHref,
  gameLabel,
  isGameHome,
  isItemDetailPath,
  sectionHref,
  sectionOfPathname,
} from "../game";

describe("gameFromPathname", () => {
  it("/pubg 접두가 붙은 경로는 pubg다", () => {
    for (const p of ["/pubg/", "/pubg/compare/", "/pubg/methodology/"]) {
      expect(gameFromPathname(p), p).toBe("pubg");
    }
  });

  it("/lol 접두가 붙은 경로는 lol이다 — 더 이상 무접두가 LoL이 아니다", () => {
    for (const p of ["/lol/", "/lol/compare/", "/lol/methodology/", "/lol/item/aatrox-winrate/"]) {
      expect(gameFromPathname(p), p).toBe("lol");
    }
  });

  it("랜딩(루트)은 어느 게임에도 속하지 않는다", () => {
    expect(gameFromPathname("/")).toBeNull();
  });

  it("접두가 아닌 유사 경로를 오인하지 않는다", () => {
    expect(gameFromPathname("/pubgfoo/")).toBeNull();
    expect(gameFromPathname("/lolfoo/")).toBeNull();
  });

  it("구 경로는 이제 어느 게임도 아니다 — 리다이렉트가 처리할 몫이다", () => {
    for (const p of ["/compare/", "/methodology/", "/item/aatrox-winrate/"]) {
      expect(gameFromPathname(p), p).toBeNull();
    }
  });
});

describe("gameHref", () => {
  // 2026-09-18 라운드6(사용자 C2) 명세: 다른 게임으로 바꾸면 **어느 화면에서든** 그 게임의
  // 브리핑으로 간다(같은 섹션으로 건너뛰지 않는다).
  it("다른 게임으로 바꾸면 어느 섹션에서든 그 게임의 브리핑으로 간다", () => {
    expect(gameHref("pubg", "/lol/")).toBe("/pubg/");
    expect(gameHref("pubg", "/lol/compare/")).toBe("/pubg/");
    expect(gameHref("lol", "/pubg/")).toBe("/lol/");
    expect(gameHref("lol", "/pubg/methodology/")).toBe("/lol/");
  });

  it("대응 라우트가 없는 경로(상세)에서도 브리핑 — 404 방지", () => {
    expect(gameHref("pubg", "/lol/item/aatrox-winrate/")).toBe("/pubg/");
    expect(gameHref("lol", "/pubg/weapon/rpd/")).toBe("/lol/");
  });

  it("같은 게임을 고르면 현재 경로를 그대로 둔다 — 상세 화면에서 이탈시키지 않는다", () => {
    expect(gameHref("lol", "/lol/item/aatrox-winrate/")).toBe("/lol/item/aatrox-winrate/");
    expect(gameHref("pubg", "/pubg/compare/")).toBe("/pubg/compare/");
  });

  it("랜딩에서 게임을 고르면 그 게임의 브리핑으로 간다", () => {
    expect(gameHref("lol", "/")).toBe("/lol/");
    expect(gameHref("pubg", "/")).toBe("/pubg/");
  });

  it("후행 슬래시가 없어도 같은 결과를 낸다", () => {
    expect(gameHref("pubg", "/lol/compare")).toBe("/pubg/");
    expect(gameHref("lol", "/pubg/compare")).toBe("/lol/");
  });
});

describe("GAMES", () => {
  it("LoL을 먼저 노출한다 — 드롭다운·랜딩 패널의 첫 자리다", () => {
    expect(GAMES.map((g) => g.id)).toEqual(["lol", "pubg"]);
  });

  it("드롭다운 라벨은 사용자가 말한 한국어 정식 명칭이다", () => {
    expect(gameLabel("lol")).toBe("리그 오브 레전드");
    expect(gameLabel("pubg")).toBe("배틀그라운드");
  });

  it("모든 게임이 접두를 갖는다 — 무접두 게임은 더 이상 없다(랜딩이 루트를 쓴다)", () => {
    for (const g of GAMES) {
      expect(g.prefix, g.id).toMatch(/^\/[a-z]+$/);
    }
  });

  it("랜딩 패널이 쓸 표시 자산을 게임마다 갖는다 — 없으면 패널을 못 그린다", () => {
    for (const g of GAMES) {
      expect(g.tag.length, g.id).toBeGreaterThan(0);
      expect(g.art, g.id).toMatch(/^\/bg\/.+/);
    }
  });
});

describe("sectionHref — 내비 섹션 경로", () => {
  // 실측 결함(2026-09-19 이전 라운드): 내비가 `gameHref(game, "/" + section)`으로 링크를 만들어
  // PUBG에서 대조표·방법론이 둘 다 브리핑으로 굳었다. 섹션 이동과 게임 전환은 다른 계산이다.
  it("게임마다 접두를 붙이고 언제나 슬래시로 끝난다(trailingSlash:true)", () => {
    expect(sectionHref("lol", "")).toBe("/lol/");
    expect(sectionHref("lol", "compare")).toBe("/lol/compare/");
    expect(sectionHref("lol", "methodology")).toBe("/lol/methodology/");
    expect(sectionHref("pubg", "")).toBe("/pubg/");
    expect(sectionHref("pubg", "compare")).toBe("/pubg/compare/");
    expect(sectionHref("pubg", "methodology")).toBe("/pubg/methodology/");
  });
});

describe("sectionOfPathname — 헤더 활성 탭 판정", () => {
  // Header.tsx가 `rest[0] === "pubg"`를 하드코딩해 직접 파싱하고 있었다. 접두가 둘로 늘면
  // 그 하드코딩은 LoL 경로를 섹션 "lol"로 읽어 활성 탭을 전부 잃는다 — 경로 해석은 한 곳에서만.
  it("게임 접두를 벗기고 첫 세그먼트를 돌려준다", () => {
    expect(sectionOfPathname("/lol/")).toBe("");
    expect(sectionOfPathname("/lol/compare/")).toBe("compare");
    expect(sectionOfPathname("/lol/item/aatrox-winrate/")).toBe("item");
    expect(sectionOfPathname("/pubg/")).toBe("");
    expect(sectionOfPathname("/pubg/weapon/rpd/")).toBe("weapon");
  });

  it("게임에 속하지 않는 경로는 섹션이 없다(null) — 랜딩에는 활성 탭이 없다", () => {
    expect(sectionOfPathname("/")).toBeNull();
    expect(sectionOfPathname("/compare/")).toBeNull();
  });
});

describe("isGameHome · isItemDetailPath — 앰비언트 레이어 게이트", () => {
  // AmbientBackground.tsx가 `pathname === "/"`와 `startsWith("/item/")`로 직접 판정하고 있었다.
  // 접두 이동 후 그대로 두면 **랜딩에서 라인 카메라·인트로가 켜지고** LoL 홈에서는 꺼진다.
  it("게임 브리핑만 홈이다 — 랜딩은 홈이 아니다", () => {
    expect(isGameHome("/lol/")).toBe(true);
    expect(isGameHome("/lol")).toBe(true);
    expect(isGameHome("/pubg/")).toBe(true);
    expect(isGameHome("/")).toBe(false);
    expect(isGameHome("/lol/compare/")).toBe(false);
  });

  it("상세 스플래시는 LoL 항목 상세에서만 켠다", () => {
    expect(isItemDetailPath("/lol/item/aatrox-winrate/")).toBe(true);
    expect(isItemDetailPath("/item/aatrox-winrate/")).toBe(false);
    expect(isItemDetailPath("/lol/")).toBe(false);
    expect(isItemDetailPath("/pubg/weapon/rpd/")).toBe(false);
  });
});
