import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { PANEL_SCROLL_BODY, PANEL_SPLIT_BODY, PANEL_SPLIT_COLUMN, PANEL_SPLIT_HEIGHT } from "../panelScroll";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("상한은 데이터량이 아니라 구조로 보장된다", () => {
  // 사용자 지적(2026-09-20): "지금 데이터양 기준으로 측정하면 안 되고, 데이터가 많이 들어올 걸
  // 상정해서 구현해둬야지". 맞는 지적이다 — PUBG 노트는 지금 5건(수기 입력)이지만 실제 패치는
  // 수십 건이고 무기·맵도 는다. `max-h`는 행 수와 무관하게 컨테이너를 묶으므로 **적용 여부만**
  // 지키면 되고, 이 테스트가 그 적용을 고정한다(브라우저 없이 판정 가능해야 회귀를 막는다).
  const GROWABLE = [
    ["src/app/tft/compare/page.tsx", "TFT 대조표 — 엔티티가 늘면 무한정 늘어난다"],
    ["src/app/tft/page.tsx", "TFT 브리핑 표 2종"],
    ["src/app/tft/unit/[key]/page.tsx", "TFT 상세 — 한 엔티티에 노트가 여러 건일 수 있다"],
    ["src/app/pubg/page.tsx", "PUBG 브리핑 — 공지 표·미공지 목록·맵 그리드"],
    ["src/components/pubg/PubgCompareTable.tsx", "PUBG 대조표 — 무기 수가 는다"],
    // 2026-09-21 — 이 목록이 **파일 이름을 손으로 세는 게이트**라 F9 신설 컴포넌트가 그대로
    // 빠져나갔다(사용자 재지적: "미공지 Gap의 패치노트에 없는 수치 변경 섹션이 스크롤 폭발").
    // 세 게임 홈이 같은 컴포넌트를 쓰므로 여기 한 줄이 세 화면을 동시에 묶는다.
    ["src/components/gamedata/SubmarineSection.tsx", "잠수함 섹션 — 대상 수는 패치가 정한다(TFT 18.2 실측 31종)"],
    ["src/components/gamedata/SubmarineDetailBlock.tsx", "잠수함 상세 구획 — 한 엔티티의 변경 값 수도 데이터가 정한다"],
  ] as const;

  for (const [file, why] of GROWABLE) {
    it(`${file} — ${why}`, () => {
      expect(read(file)).toContain("PANEL_SCROLL_BODY");
    });
  }

  it("좌우 분할(LoL 대조표)은 행 높이 + flex로 묶인다", () => {
    const explorer = read("src/components/compare/CompareExplorer.tsx");
    expect(explorer).toContain("PANEL_SPLIT_HEIGHT");
    expect(explorer).toContain("PANEL_SPLIT_COLUMN");
    // `items-start`가 두 열을 각자 내용 높이로 만들어 아래 끝이 어긋났다(실측 809 vs 773).
    // 주석에는 남아 있어도 된다(왜 뺐는지 기록) — **className에 없어야** 한다.
    const classNames = [...explorer.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
      .map((m) => m[1] ?? m[2] ?? "");
    expect(classNames.filter((c) => c.split(/\s+/).includes("items-start"))).toEqual([]);

    for (const f of ["src/components/compare/NoteNavigator.tsx", "src/components/compare/DeltaTable.tsx"]) {
      expect(read(f)).toContain("PANEL_SPLIT_BODY");
    }
  });

  it("**640px 상한의 사본이 생기지 않았다** — 소유자는 panelScroll.ts 하나뿐", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(e.name) && rel !== "src/lib/panelScroll.ts" && !rel.includes("__tests__")) {
          if (/max-h-\[\d+px\]/.test(read(rel))) offenders.push(rel);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});

describe("클래스 규약", () => {
  it("분할 본문은 모바일 상한 + 데스크톱 flex 둘 다 갖는다", () => {
    expect(PANEL_SPLIT_BODY).toContain(PANEL_SCROLL_BODY);
    // `min-h-0`이 load-bearing — flex 자식의 기본 min-height:auto는 내용 아래로 줄지 않아,
    // 이게 없으면 flex-1을 줘도 스크롤이 안 생기고 패널이 그냥 늘어난다.
    expect(PANEL_SPLIT_BODY).toContain("lg:min-h-0");
    expect(PANEL_SPLIT_BODY).toContain("lg:flex-1");
    expect(PANEL_SPLIT_BODY).toContain("lg:max-h-none");
  });

  it("행 높이는 데스크톱에만 걸린다 — 모바일은 적층이라 고정하면 안 된다", () => {
    expect(PANEL_SPLIT_HEIGHT.startsWith("lg:")).toBe(true);
    expect(PANEL_SPLIT_COLUMN.split(" ").every((c) => c.startsWith("lg:"))).toBe(true);
  });

  it("뷰포트 연동이다 — 고정 px만 두면 세로 짧은 화면에서 원래 증상으로 돌아간다", () => {
    expect(PANEL_SPLIT_HEIGHT).toContain("100vh");
  });
});
