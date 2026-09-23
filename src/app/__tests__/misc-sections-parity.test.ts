// src/app/__tests__/misc-sections-parity.test.ts
// §8-7 #19 — 「기타 변경」 묶음이 **LoL 브리핑에만** 있다.
//
// 이 이탈은 레이아웃이 아니라 **데이터**다. 묶음 규칙(`classifyMiscNote`)은 `PatchNoteItem`만
// 받는 게임 중립 함수이고 TFT 노트도 같은 타입인데, 실측으로 TFT 163줄에는 치장·버그 수정·
// 편의성 줄이 **0건**이다(파서가 밸런스 섹션만 훑는다). 없는 묶음을 지어내면 빈 카드가 남는다.
//
// 그래서 닫는 방식은 「TFT에도 카드를 만든다」가 아니라 **「생기면 알게 한다」**다. 이 테스트가
// 실제 산출물을 세고, 0이 아니게 되는 순간 실패해서 그 게임에도 묶음을 붙이라고 말한다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { classifyMiscNote } from "@/components/home/miscSections";
import type { PatchNoteItem } from "@/pipeline/types";

const ROOT = path.resolve(__dirname, "..", "..", "..");

function tftNotes(): PatchNoteItem[] {
  const dir = path.join(ROOT, "data/aggregated/tft");
  if (!fs.existsSync(dir)) return [];
  const file = fs.readdirSync(dir).find((f) => f.startsWith("notes-"));
  if (!file) return [];
  return (JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as { items: PatchNoteItem[] }).items;
}

describe("§8-7 #19 「기타 변경」 — 규칙은 공용, 데이터는 게임별", () => {
  it("묶음 규칙은 게임 중립이다 — TFT 노트도 그대로 분류할 수 있다", () => {
    const notes = tftNotes();
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(typeof classifyMiscNote(note)).toBe("string");
    }
  });

  it("TFT에 치장·버그 수정·편의성 줄이 생기면 이 테스트가 먼저 실패한다", () => {
    const notes = tftNotes();
    const misc = notes.filter((note) => {
      const category = classifyMiscNote(note);
      return category === "cosmetic" || category === "bugfix" || category === "qol" || category === "augment";
    });
    // 실측 0건(18.2, 163줄). 0이 아니게 되면 TFT 브리핑에도 「기타 변경」 묶음을 붙여야 한다 —
    // 그 판단을 사람이 하도록 여기서 멈춘다(조용히 빠뜨리지 않는다).
    expect(misc.map((n) => `${n.entity} | ${n.summary}`)).toEqual([]);
  });
});
