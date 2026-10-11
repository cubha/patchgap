// src/app/__tests__/wording.test.ts
// 렌더 문구 게이트(트랙 B ST-12 — lol-S18·lol-S19·parity-S27·pubg-S14·parity-S12). 문장은 함수로 고정할 수 없어 소스에서 막는다.
// 각 금지 문자열은 리뷰가 실측한 그 문장이다 — 다시 쓰면 같은 결함이 돌아온다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("렌더 문구", () => {
  it("대조표·방법론 안내문에 「왼쪽/오른쪽」 방향어가 없다 — 375폭에서는 위아래로 쌓인다(lol-S18·tft-S14·pubg-S11)", () => {
    for (const rel of [
      "components/compare/LolCompareView.tsx",
      "components/tft/TftCompareView.tsx",
      "app/pubg/compare/page.tsx",
      "app/tft/methodology/page.tsx",
      "app/lol/methodology/page.tsx",
      "app/pubg/methodology/page.tsx",
    ]) {
      expect(read(rel), rel).not.toMatch(/왼쪽에서[^/\n]*오른쪽|오른쪽 표의/);
    }
  });

  it("LoL 방법론 — 픽률 분모는 전체 매치, 승률 분모는 등장 판(lol-S19)", () => {
    const src = read("app/lol/methodology/page.tsx");
    expect(src).not.toMatch(/승률·픽률의 분모는 매치가 아니라/);
    expect(src).toMatch(/픽률·밴률의 분모는/);
  });

  it("PUBG 방법론 — 파일명·API 필드명을 사용자에게 보이지 않는다(parity-S27)", () => {
    const src = read("app/pubg/methodology/page.tsx");
    expect(src).not.toMatch(/meta: "[^"]*\.ts"/);
    expect(src).not.toMatch(/`matchType`/);
    expect(src).not.toMatch(/`\/samples`/);
  });

  it("PUBG 방법론 — 「무기 상세는 판정이 선 무기만」은 사실이 아니다(pubg-S14·parity-S12)", () => {
    expect(read("app/pubg/methodology/page.tsx")).not.toMatch(/무기 상세는 <strong className="text-fg">판정이 선 무기<\/strong>만/);
  });

  it("「탭로」 조사 오류가 소스 어디에도 없다(lol-S30·pubg-S23)", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? (e.name === "__tests__" ? [] : walk(path.join(dir, e.name))) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
      );
    const bad = walk(SRC).filter((f) => /지표 탭\$\{.*\}로 나타납니다|탭로 나타납니다/.test(fs.readFileSync(f, "utf8")));
    expect(bad.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("브리핑 탭 머리 — 세 게임 같은 상수(트랙 B ST-10·ST-13, parity-S25·parity-S9)", () => {
  const files = ["components/home/ReleaseNoteStream.tsx", "components/tft/TftBriefing.tsx", "components/pubg/PubgBriefing.tsx"];
  it.each(files)("%s — 패치 내용 머리·Gap 지표 축 제목을 상수로", (rel) => {
    const src = read(rel);
    expect(src).toMatch(/\{CONTENT_TAB_TITLE\}/);
    expect(src).toMatch(/\{GAP_METRIC_AXIS_TITLE\}/);
    expect(src).not.toMatch(/공지에 없는데 움직였습니다/);
  });
  it("LoL 접힌 행에 유형 줄이 있다(parity-S9 — TFT·PUBG 행과 같은 구성)", () => {
    expect(read("components/home/ReleaseNoteRow.tsx")).toMatch(/data-row-type/);
  });
});

describe("수치 축 행 이름 링크 — 세 브리핑이 hrefOf를 넘긴다(트랙 B ST-14, parity-S11·tft-S11)", () => {
  const usesOf = (rel: string) => read(rel).match(/<SubmarineSection\b[\s\S]*?\/>/g) ?? [];
  it.each(["components/home/LolBriefing.tsx", "components/tft/TftBriefing.tsx"])("%s — 모든 사용처가 링크 함수를 넘긴다", (rel) => {
    const uses = usesOf(rel);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) {
      expect(u).toMatch(/hrefOf=/);
      expect(u).not.toMatch(/hrefOf=\{\(\) => null\}/);
    }
  });
  it("PUBG — 관측 브리핑은 링크를 넘긴다(선언만 쌍은 무기 상세 라우트 자체가 없어 null이 정직하다)", () => {
    const uses = usesOf("components/pubg/PubgBriefing.tsx");
    expect(uses.some((u) => /hrefOf=\{\(change\) => weaponHref/.test(u))).toBe(true);
  });
});
