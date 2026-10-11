// src/lib/__tests__/announcedCount.test.ts
// 「공지된 변화」 수의 단위 = 대상(트랙 B ST-3, 2026-10-11 site-review tft-S5·parity-S5·parity-S6·lol-S15).
// 리뷰 실측: PUBG 히어로·타일 5(조항 수) vs 본문 「공지된 대상 3개」 vs 랜딩 3 — 같은 라벨이 화면마다 조항·대상을 섞었다.
// 히어로·타일·배너·랜딩이 **같은 함수**를 보게 하고, LoL 대조표 커버리지 「관측 짝」도 같은 단위(대상)로 센다.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { computeCoverage } from "@/components/compare/logic";
import { listPatchPairs, loadDeltas, loadNotes } from "@/lib/data";
import { countAnnouncedObservedEntities } from "@/pipeline/shared/headline";
import { pubgNoteTargetCount, tftNoteEntityCount } from "../announcedCount";

describe("공지 대상 수", () => {
  it("PUBG — 조항이 아니라 조항이 가리키는 무기의 합집합", () => {
    const notes = [
      { weaponKeys: ["Item_Weapon_RPD_C", "Item_Weapon_M249_C"] },
      { weaponKeys: ["Item_Weapon_RPD_C"] },
      { weaponKeys: ["Item_Weapon_MG3_C"] },
      { weaponKeys: [] },
    ];
    expect(pubgNoteTargetCount(notes)).toBe(3);
  });

  it("TFT — 줄이 아니라 대상", () => {
    expect(tftNoteEntityCount([{ entity: "a" }, { entity: "a" }, { entity: "b" }])).toBe(2);
  });
});

describe("LoL 대조표 커버리지 「관측 짝」 = 공지 대상 중 관측이 선 대상(결론 문장과 같은 함수)", () => {
  // 실측 결함(2026-10-11 감사): 26.19→26.20 「노트 17대상(184항목) 중 관측 짝 94」 — 행 수를 세서 부분이 전체보다 컸다.
  const pairs = listPatchPairs();
  it("커밋된 쌍이 있다", () => expect(pairs.length).toBeGreaterThan(0));
  it.each(pairs.map((p) => [`${p.from}→${p.to}`, p]))("%s", (_label, pair) => {
    const deltas = loadDeltas(pair.from, pair.to);
    if (!deltas) return;
    const coverage = computeCoverage(deltas.rows, loadNotes(pair.to), deltas.meta.qAlpha);
    expect(coverage.matchedCount).toBe(countAnnouncedObservedEntities(deltas.rows, deltas.meta.qAlpha));
    expect(coverage.matchedCount).toBeLessThanOrEqual(coverage.noteEntityCount);
  });
});

describe("히어로 단위어 — 「N개 대상」(tft-S5)", () => {
  // 히어로의 수는 대상인데 「항목」이라 불러, 바로 아래 타일 부제 「· 97개 항목」(줄 수)과 같은 단어가 두 수를 가리켰다.
  // 리터럴이라 함수로 고정할 수 없어 소스에서 막는다: 「…개 항목」을 히어로·배너 문장에 다시 쓰면 실패한다.
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const FILES = [
    "components/home/HeroSummary.tsx",
    "components/tft/TftBriefing.tsx",
    "components/pubg/PubgBriefing.tsx",
    "components/DeclarationOnly.tsx",
    "components/NewerPatchNotice.tsx",
  ];
  it.each(FILES)("%s", (rel) => {
    const src = fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");
    expect(src).not.toMatch(/개 항목<\/span>을 말했고/);
    expect(src).not.toMatch(/반영됐습니다\(\{entityCount\}개 항목\)/);
  });
  it("PUBG 타일 「공지된 변화」는 조항 수가 아니라 대상 수", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../..", "components/pubg/PubgBriefing.tsx"), "utf8");
    expect(src).not.toMatch(/announcedCount=\{notes\.length\}/);
    expect(src).toMatch(/itemCount=\{notes\.length\}/);
  });
});
