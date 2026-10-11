// src/lib/__tests__/meta.test.ts
// 라우트 메타 단일 출처(ST-1, 2026-10-11 site-review 트랙 B6). 리뷰 실측: LoL 4라우트 title이 「patchgap」 단독으로
// 겹쳤고(lol-S25), TFT 7라우트 description이 「LoL 패치 미공지 변화 브리핑」이었으며(tft-S25·parity-S31), title 틀이
// 「—」·「·」 두 구분자와 「PUBG/배틀그라운드」 두 게임명을 섞었고(parity-S30), og·canonical은 전 라우트 null이었다.
// 페이지가 리터럴을 쓰면 다시 어긋나므로 틀은 이 함수 하나가 만든다.
import { describe, expect, it } from "vitest";
import { GAMES } from "../game";
import { SITE_URL, ogImagePath, pageMeta, pageTitle } from "../meta";

describe("pageTitle", () => {
  it("브리핑은 쌍을 쓰지 않는다 — 쌍은 헤더 선택기가 말한다", () => {
    expect(pageTitle({ game: "lol", screen: "briefing", path: "/lol/" })).toBe("브리핑 · 리그 오브 레전드");
  });

  it("쌍이 있으면 게임명 뒤에 붙는다", () => {
    expect(pageTitle({ game: "tft", screen: "compare", pair: { from: "18.3", to: "18.4" }, path: "/tft/compare/" })).toBe(
      "대조표 · 전략적 팀 전투 18.3 → 18.4",
    );
  });

  it("상세는 대상명이 화면명을 대신한다", () => {
    expect(
      pageTitle({ game: "pubg", screen: "detail", entity: "Beryl M762", pair: { from: "42.3", to: "43.1" }, path: "/pubg/weapon/berylm762/" }),
    ).toBe("Beryl M762 · 배틀그라운드 42.3 → 43.1");
  });

  it("게임명은 gameLabel 하나에서 온다 — 세 게임 모두 정식 한국어 명칭", () => {
    for (const g of GAMES) {
      expect(pageTitle({ game: g.id, screen: "methodology", path: `${g.prefix}/methodology/` })).toBe(`방법론 · ${g.label}`);
    }
  });

  it("구분자는 「·」 하나다", () => {
    const t = pageTitle({ game: "lol", screen: "detail", entity: "아트록스", pair: { from: "26.19", to: "26.20" }, path: "/lol/item/x/" });
    expect(t).not.toMatch(/—|\|/);
  });
});

describe("pageMeta", () => {
  it("canonical·og:url은 사이트 절대 주소이고 슬래시로 끝난다(trailingSlash)", () => {
    const m = pageMeta({ game: "lol", screen: "compare", path: "/lol/compare" });
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/lol/compare/`);
    expect(m.openGraph?.url).toBe(`${SITE_URL}/lol/compare/`);
  });

  it("og:title은 사이트명까지 붙은 완성형이고 og:image는 게임별 정적 이미지다", () => {
    const m = pageMeta({ game: "tft", screen: "briefing", path: "/tft/" });
    expect(m.openGraph?.title).toBe("브리핑 · 전략적 팀 전투 · patchgap");
    const images = m.openGraph?.images;
    expect(JSON.stringify(images)).toContain(ogImagePath("tft"));
  });

  it("description은 그 게임 이름을 말하고 다른 게임 이름을 말하지 않는다", () => {
    for (const g of GAMES) {
      for (const screen of ["briefing", "compare", "methodology"] as const) {
        const d = String(pageMeta({ game: g.id, screen, path: `${g.prefix}/` }).description);
        expect(d).toContain(g.label);
        for (const other of GAMES.filter((o) => o.id !== g.id)) expect(d).not.toContain(other.label);
        expect(d).not.toMatch(/\bLoL\b/);
      }
    }
  });

  it("화면이 다르면 description도 다르다", () => {
    const ds = (["briefing", "compare", "methodology"] as const).map((screen) =>
      pageMeta({ game: "lol", screen, path: "/lol/" }).description,
    );
    expect(new Set(ds).size).toBe(3);
  });

  it("description을 넘기면 그것을 쓴다(비교 불가 맵처럼 화면이 따로 아는 사실)", () => {
    const m = pageMeta({ game: "pubg", screen: "detail", entity: "미라마", path: "/pubg/map/miramar/", description: "비교할 수 없습니다." });
    expect(m.description).toBe("비교할 수 없습니다.");
    expect(m.openGraph?.description).toBe("비교할 수 없습니다.");
  });

  it("canonicalPath를 따로 주면(별칭 라우트) canonical은 그쪽을 가리킨다", () => {
    const m = pageMeta({ game: "lol", screen: "detail", entity: "아트록스", path: "/lol/item/champion~Aatrox~TOP~pickRate/", canonicalPath: "/lol/item/champion~Aatrox/" });
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/lol/item/champion~Aatrox/`);
  });
});
