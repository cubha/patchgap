// src/app/__tests__/route-meta.test.ts
// 라우트 메타 게이트(ST-1, 트랙 B6). 리뷰 실측 결함은 전부 「페이지가 메타를 따로 썼거나 안 썼다」였다 — LoL 4라우트가
// 루트 「patchgap」을 상속해 title이 겹쳤고(lol-S25), TFT 7라우트가 LoL description을 물려받았다(tft-S25·parity-S31).
// 새 라우트도 같은 틀을 타도록 소스에서 강제한다: 게임 라우트의 page.tsx는 `pageMeta`만 쓰고 title 리터럴을 쓰지 않는다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(__dirname, "..");

function pages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : pages(full);
    return e.name === "page.tsx" ? [full] : [];
  });
}

const GAME_PAGES = pages(APP).filter((f) => /^(lol|tft|pubg)[\\/]/.test(path.relative(APP, f)));

describe("게임 라우트 메타", () => {
  it("게임 라우트가 있다(가드가 공회전하지 않는다)", () => {
    expect(GAME_PAGES.length).toBeGreaterThanOrEqual(18);
  });

  it.each(GAME_PAGES.map((f) => [path.relative(APP, f), f]))("%s — pageMeta로 메타를 만든다", (_rel, file) => {
    const src = fs.readFileSync(file, "utf8");
    expect(src).toMatch(/pageMeta\(/);
    // 메타 객체 리터럴·사이트명 리터럴 금지(방법론의 `title:`은 H1 prop이라 따로 본다).
    expect(src).not.toMatch(/export const metadata(?::\s*Metadata)?\s*=\s*\{/);
    expect(src).not.toMatch(/patchgap[`"']/);
  });

  it("루트 description은 특정 게임을 말하지 않는다(상속하는 라우트가 다른 게임 설명을 물려받지 않게)", () => {
    const layout = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
    const block = layout.slice(layout.indexOf("export const metadata"), layout.indexOf("};", layout.indexOf("export const metadata")));
    expect(block).not.toMatch(/LoL|리그 오브 레전드/);
    expect(layout).toMatch(/metadataBase/);
  });

  it("robots·sitemap 메타 라우트가 있다", () => {
    expect(fs.existsSync(path.join(APP, "robots.ts"))).toBe(true);
    expect(fs.existsSync(path.join(APP, "sitemap.ts"))).toBe(true);
  });

  it("og 이미지가 게임마다 커밋돼 있다", () => {
    for (const name of ["landing", "lol", "tft", "pubg"]) {
      expect(fs.existsSync(path.resolve(APP, "../../public/og", `${name}.png`))).toBe(true);
    }
  });
});
