// scripts/__tests__/run-ddragon-args.test.ts
// 2026-09-29: LoL 워크플로는 DDragon 단계가 판정(노트 생성)보다 먼저라, 새 패치 스킬은 아이콘 대상에서 늘 빠졌다
// (26.19 스킬 22개 중 아이콘 2개). 판정 뒤에 아이콘만 다시 맞추는 `--spells-only`를 둔다.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRunDdragonArgs } from "../run-ddragon";

describe("run-ddragon 인자", () => {
  it("--spells-only", () => {
    expect(parseRunDdragonArgs(["--spells-only"]).spellsOnly).toBe(true);
    expect(parseRunDdragonArgs([]).spellsOnly).toBe(false);
  });
});

describe("collect.yml — 스킬 아이콘 동기화는 판정(노트 생성) 뒤", () => {
  const yml = fs.readFileSync(".github/workflows/collect.yml", "utf8");
  it("판정 스텝 뒤에 --spells-only 스텝이 있다", () => {
    const match = yml.indexOf("- name: Match + verdict");
    const spells = yml.indexOf("run-ddragon.ts --spells-only");
    expect(match).toBeGreaterThan(0);
    expect(spells).toBeGreaterThan(match);
  });
});
