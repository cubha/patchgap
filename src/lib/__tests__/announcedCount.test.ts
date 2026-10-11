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
