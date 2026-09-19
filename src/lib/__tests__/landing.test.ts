// src/lib/__tests__/landing.test.ts
// 랜딩 데이터 층(2026-09-19). 이 파일이 고정하는 계약은 **"게임 수를 단언하지 않는다"**는
// 사용자 요구를 코드가 실제로 지키는지다.
//
// 요구 원문: "이때 추후 게임이 추가될수잇으니 두가지종류만 단언해서 작성하지는마".
// 화면이 게임을 하드코딩하지 않는 것만으로는 부족하다 — 게임마다 집계 산출물 모양이 달라
// 로더는 게임별로 존재할 수밖에 없는데, 그 로더를 **안 붙이고 GAMES에만 추가**하면 새 게임이
// 랜딩에서 조용히 사라진다. 그래서 로더 레지스트리가 GAMES를 전부 덮는지 여기서 센다.
import { describe, expect, it, vi } from "vitest";

// landing.ts는 data.ts와 같은 이유로 "server-only"를 side-effect import한다 — 실제 패키지는
// Next RSC 번들 조건 밖에서 항상 throw하므로(의도된 동작) 순수 vitest에서는 import만으로
// 예외가 난다. data.test.ts가 쓰는 것과 같은 패턴으로 이 파일 범위에서만 무해화한다.
vi.mock("server-only", () => ({}));

import { GAMES, sectionHref } from "../game";
import { LANDING_LOADERS, landingCards, landingTotals, type GameLandingCard } from "../landing";

function card(over: Partial<GameLandingCard> = {}): GameLandingCard {
  return {
    id: "lol",
    label: "리그 오브 레전드",
    tag: "LEAGUE OF LEGENDS",
    art: "/bg/island.webp",
    href: "/lol/",
    pair: { from: "26.17", to: "26.18" },
    sample: "KR · Master+ · 10,000매치",
    announced: 12,
    significant: 403,
    unannounced: 29,
    matches: 30000,
    ...over,
  };
}

describe("LANDING_LOADERS — 누락 차단", () => {
  it("GAMES의 모든 게임이 로더를 갖는다 — 하나라도 빠지면 그 게임은 랜딩에 안 뜬다", () => {
    for (const game of GAMES) {
      expect(typeof LANDING_LOADERS[game.id], game.id).toBe("function");
    }
  });

  it("로더 키가 GAMES 밖으로 새지 않는다", () => {
    const ids = new Set(GAMES.map((g) => g.id));
    for (const key of Object.keys(LANDING_LOADERS)) {
      expect(ids.has(key as (typeof GAMES)[number]["id"]), key).toBe(true);
    }
  });
});

describe("landingTotals — 합산 타일", () => {
  it("카드를 더한다 — 게임이 늘면 합도 자동으로 커진다", () => {
    const totals = landingTotals([
      card({ matches: 30000, significant: 403, unannounced: 29 }),
      card({ id: "pubg", matches: 3329, significant: 7, unannounced: 5 }),
    ]);
    expect(totals).toEqual({ matches: 33329, significant: 410, unannounced: 34 });
  });

  it("카드가 없으면 전부 0이다 — 빈 데이터 빌드에서도 깨지지 않는다", () => {
    expect(landingTotals([])).toEqual({ matches: 0, significant: 0, unannounced: 0 });
  });

  it("카드가 하나여도 합산은 성립한다 — '두 게임'을 전제하지 않는다", () => {
    expect(landingTotals([card({ matches: 10, significant: 2, unannounced: 1 })])).toEqual({
      matches: 10,
      significant: 2,
      unannounced: 1,
    });
  });
});

describe("landingCards — 커밋된 산출물 기준", () => {
  const cards = landingCards();

  it("카드가 1장 이상 나온다(빈 클론이면 이 describe 전체가 무의미하다)", () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it("GAMES 선언 순서를 따른다 — 랜딩 첫 패널이 드롭다운 첫 옵션과 같아야 한다", () => {
    const order = GAMES.map((g) => g.id).filter((id) => cards.some((c) => c.id === id));
    expect(cards.map((c) => c.id)).toEqual(order);
  });

  it("각 카드의 링크가 그 게임의 브리핑이다 — 없는 경로로 보내지 않는다", () => {
    for (const c of cards) {
      expect(c.href, c.id).toBe(sectionHref(c.id, ""));
    }
  });

  it("표시 자산과 수치가 비어 있지 않다 — 회색 카드를 그리지 않는다", () => {
    for (const c of cards) {
      expect(c.label.length, c.id).toBeGreaterThan(0);
      expect(c.tag.length, c.id).toBeGreaterThan(0);
      expect(c.art, c.id).toMatch(/^\/bg\/.+/);
      expect(c.sample.length, c.id).toBeGreaterThan(0);
      expect(c.pair.from.length, c.id).toBeGreaterThan(0);
      expect(c.pair.to.length, c.id).toBeGreaterThan(0);
      expect(c.matches, c.id).toBeGreaterThan(0);
      expect(c.announced, c.id).toBeGreaterThanOrEqual(0);
      expect(c.significant, c.id).toBeGreaterThanOrEqual(0);
      expect(c.unannounced, c.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("미공지는 유의한 관측의 부분집합이다 — 합산 타일이 자기모순을 말하지 않는다", () => {
    for (const c of cards) {
      expect(c.unannounced, c.id).toBeLessThanOrEqual(c.significant);
    }
  });
});
