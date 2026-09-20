// src/app/__tests__/landing-rail.test.ts
// 랜딩 게임 목록이 **카드 수에 따라 영역을 늘리지 않는지**를 기계가 센다(2026-09-20).
//
// 사용자 지시 원문: "width는 지금처럼 고정되고 Size도 지금처럼 고정 → 내부 X Scroll로 볼 수
// 있도록". 이 규칙은 **지금 카드가 4장이라 한 줄에 들어간다**는 사실로는 지킬 수 없다 —
// 다음 게임이 붙는 순간 줄이 늘어나고, 그때는 아무도 이 지시를 기억하지 못한다. 직전 라운드에
// 같은 형태의 지적을 받았다("지금 데이터양 기준으로 측정하면 안 되고").
//
// 렌더 없이 소스를 읽는다: 레일이 실제로 스크롤되는지는 브라우저 실측으로 확인했고(1920·1024·
// 768·390 전 폭에서 레일 높이 388px 고정·페이지 가로 스크롤 0), 여기서 막는 것은 **그 구조가
// 조용히 되돌아가는 것**이다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGE = path.join(ROOT, "src", "app", "page.tsx");
const CSS = path.join(ROOT, "src", "styles", "landing.css");

describe("랜딩 게임 레일", () => {
  const page = fs.readFileSync(PAGE, "utf8");
  const css = fs.readFileSync(CSS, "utf8");

  it("카드 목록 컨테이너는 `.landing-rail`이다", () => {
    expect(page).toContain('className="landing-rail"');
  });

  it("줄이 늘어나는 그리드(auto-fit/auto-fill)로 되돌아가지 않았다", () => {
    // `className=` 값 안에서만 본다 — 설명 주석이 옛 구조를 인용하는 것은 정상이다.
    const classAttrs = [...page.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
      (m) => m[1] ?? m[2] ?? ""
    );
    for (const value of classAttrs) {
      expect(value, `줄이 늘어나는 그리드: ${value}`).not.toMatch(/auto-fit|auto-fill/);
    }
  });

  it("레일 규약은 landing.css 한 곳이 소유한다 — 가로 흐름 + 내부 스크롤", () => {
    const rail = css.slice(css.indexOf(".landing-rail {"));
    expect(rail).toContain("grid-auto-flow: column");
    expect(rail).toContain("overflow-x: auto");
    // 최소폭이 있어야 트랙이 무한히 쪼개지지 않고 넘칠 때 스크롤로 넘어간다.
    expect(rail).toMatch(/grid-auto-columns:\s*minmax\(/);
  });

  it("레일 최소폭은 뷰포트를 넘지 않는다(좁은 화면에서 카드가 화면 밖으로 나가지 않도록)", () => {
    const rail = css.slice(css.indexOf(".landing-rail {"));
    expect(rail).toMatch(/minmax\(\s*min\([^)]*vw\)/);
  });
});
