// src/pipeline/match/__tests__/combined-note-split.test.ts
// C2(2026-09-28, 잔여 로드맵 PR-B) — 한 노트가 여러 아이템을 한 이름으로 묶고(「세계 지도집과 룬 나침반」)
// 단계값(30/100/200)을 늘어놓으면, 어느 값이 어느 아이템인지 파서가 몰랐다 → LLM이 「룬 나침반 30→0」
// (실제는 세계 지도집 값)이라고 썼다. DDragon 수치를 before/after 두 버전에서 대조해 **값이 유일하게
// 맞는 아이템**에만 단계를 배정하고 하위 노트로 나눈다. 하나라도 안 맞으면 현행 유지(지어내지 않는다).
import { describe, expect, it } from "vitest";
import { splitCombinedNotes, type ItemStatTable } from "../combined-note-split";
import { DESC_HP_REGEN_KEY, DESC_MP_REGEN_KEY, descriptionStats } from "../ddragon";
import type { PatchNoteItem } from "../../types";

const table = (rows: Record<string, Record<string, number>>): ItemStatTable => ({
  byName: (name) => (rows[name] ? [{ id: name, stats: rows[name] }] : []),
});
const before = table({ "세계 지도집": { FlatHPPoolMod: 30 }, "룬 나침반": { FlatHPPoolMod: 100 }, "세계의 결실": { FlatHPPoolMod: 200 } });
const after = table({ "세계 지도집": {}, "룬 나침반": { FlatHPPoolMod: 60 }, "세계의 결실": { FlatHPPoolMod: 200 } });
const note = (stat: string, b: string, a: string, extra: Partial<PatchNoteItem> = {}): PatchNoteItem => ({
  id: `note:26.19:item:세계-지도집과-룬-나침반:${stat}`,
  patch: "26.19", section: "item", entity: "세계 지도집과 룬 나침반", skill: null, stat, before: b, after: a,
  direction: "adjust", summary: `${stat}: ${b} ⇒ ${a}`, anchorUrl: "https://x/#patch-items", anchorKind: "section", modeScope: "core", ...extra,
});

describe("splitCombinedNotes", () => {
  const hp = note("체력", "30/100/200", "0/60/200");
  const regen = note("체력 재생", "25%/50%/75%", "50%/75%/75%");
  const other = { ...note("체력", "1", "2"), id: "x", entity: "다른 아이템" };

  it("DDragon 값이 유일하게 맞는 아이템으로 단계를 나누고, 바뀌지 않은 단계는 빼다", () => {
    const { items, report } = splitCombinedNotes([hp, other], before, after);
    const split = items.filter((n) => n.stat === "체력" && n.entity !== "다른 아이템");
    expect(split.map((n) => [n.entity, n.before, n.after, n.direction])).toEqual([
      ["세계 지도집", "30", "0", "nerf"],
      ["룬 나침반", "100", "60", "nerf"],
    ]);
    expect(split.every((n) => n.summary.includes("세계 지도집과 룬 나침반"))).toBe(true);
    expect(items).toContainEqual(other);
    expect(report).toContainEqual(expect.objectContaining({ entity: "세계 지도집과 룬 나침반", outcome: "split" }));
  });

  it("DDragon에 없는 수치(체력 재생)는 같은 대상의 검증된 단계 배정을 따른다", () => {
    const { items } = splitCombinedNotes([hp, regen], before, after);
    expect(items.filter((n) => n.stat === "체력 재생").map((n) => [n.entity, n.before, n.after, n.direction])).toEqual([
      ["세계 지도집", "25%", "50%", "buff"],
      ["룬 나침반", "50%", "75%", "buff"],
    ]);
  });

  it("바뀐 단계가 어느 아이템과도 안 맞으면 현행 유지", () => {
    const wrong = note("체력", "30/100/200", "0/70/200");
    const { items, report } = splitCombinedNotes([wrong], before, after);
    expect(items).toEqual([wrong]);
    expect(report[0]).toMatchObject({ outcome: "kept" });
  });

  it("검증할 수치가 하나도 없으면 현행 유지", () => {
    const { items } = splitCombinedNotes([regen], before, after);
    expect(items).toEqual([regen]);
  });

  it("합친 이름이 아니면 건드리지 않는다", () => {
    const { items, report } = splitCombinedNotes([other], before, after);
    expect(items).toEqual([other]);
    expect(report).toEqual([]);
  });
});

// scope-critic(2026-09-28): 「로컬 최신 두 버전」은 패치를 모른다 — 노트가 DDragon보다 먼저 나오거나 옛 패치를
// 다시 파싱하면 엉뚱한 쌍으로 나눈다. 패치 번호로 버전을 고른다(LoL 26.N ↔ DDragon 16.N.x, 마이너가 같은 패치).
import { ddragonPairForPatch } from "../combined-note-split";
describe("ddragonPairForPatch", () => {
  const versions = ["16.20.1", "16.19.1", "16.18.1", "16.17.1"];
  it("그 패치와 직전 패치의 버전을 고른다", () => {
    expect(ddragonPairForPatch(versions, "26.19")).toEqual({ from: "16.18.1", to: "16.19.1" });
    expect(ddragonPairForPatch(versions, "26.18")).toEqual({ from: "16.17.1", to: "16.18.1" });
  });
  it("어느 한쪽이 없으면 null — 추측하지 않는다", () => {
    expect(ddragonPairForPatch(versions, "26.21")).toBeNull();
    expect(ddragonPairForPatch(["16.19.1"], "26.19")).toBeNull();
  });
  it("같은 마이너에 버전이 여럿이면 가장 새 것", () => {
    expect(ddragonPairForPatch(["16.19.2", "16.19.1", "16.18.1"], "26.19")).toEqual({ from: "16.18.1", to: "16.19.2" });
  });
});

// 이월 R10(2026-09-28): 「체력 재생」 단계 배정은 스탯 표에 없어 검증되지 않았다. DDragon **설명문**의
// 「기본 체력 재생 X%」(16.18 룬 나침반 50% → 16.19 75%)를 교차 검증에 쓴다. 설명문이 빈 아이템(세계 지도집)은
// 「모름」이지 0이 아니다 — 배정을 **만들지는 않고**, 값이 있는데 배정과 어긋나면 분해하지 않는다.
describe("splitCombinedNotes — 설명문 재생 값 교차 검증(R10)", () => {
  const hp = note("체력", "30/100/200", "0/60/200");
  const regen = note("체력 재생", "25%/50%/75%", "50%/75%/75%");
  const withRegen = (base: Record<string, Record<string, number>>, regenByName: Record<string, number>) =>
    table(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, regenByName[k] === undefined ? v : { ...v, [DESC_HP_REGEN_KEY]: regenByName[k] }])));
  const hpBefore = { "세계 지도집": { FlatHPPoolMod: 30 }, "룬 나침반": { FlatHPPoolMod: 100 } };
  const hpAfter = { "세계 지도집": {}, "룬 나침반": { FlatHPPoolMod: 60 } };

  it("설명문 값이 배정과 맞으면 분해한다 — 설명문이 없는 아이템은 모름으로 둔다", () => {
    const { items, report } = splitCombinedNotes(
      [hp, regen],
      withRegen(hpBefore, { "룬 나침반": 50 }),
      withRegen(hpAfter, { "룬 나침반": 75 })
    );
    expect(items.filter((n) => n.stat === "체력 재생").map((n) => [n.entity, n.before, n.after])).toEqual([
      ["세계 지도집", "25%", "50%"],
      ["룬 나침반", "50%", "75%"],
    ]);
    expect(report[0]).toMatchObject({ outcome: "split" });
    expect(report[0].reason).toMatch(/설명문/);
  });

  it("설명문 값이 배정과 어긋나면 현행 유지 — 형식 가정으로 밀어붙이지 않는다", () => {
    const { items, report } = splitCombinedNotes(
      [hp, regen],
      withRegen(hpBefore, { "룬 나침반": 50 }),
      withRegen(hpAfter, { "룬 나침반": 50 })
    );
    expect(items).toEqual([hp, regen]);
    expect(report[0]).toMatchObject({ outcome: "kept" });
    expect(report[0].reason).toMatch(/설명문/);
  });
});

describe("descriptionStats — DDragon 설명문의 기본 재생 백분율(R10)", () => {
  it("「기본 체력 재생 75%」·「기본 마나 재생 50%」를 읽는다", () => {
    // 16.19.1 룬 나침반(3866) 설명문 실물 형식.
    const html = "<mainText><stats>체력 <attention>60</attention><br>기본 체력 재생 <attention>75%</attention><br>기본 마나 재생 <attention>50%</attention><br>10초당 골드 <attention>5</attention></stats></mainText>";
    expect(descriptionStats(html)).toEqual({ [DESC_HP_REGEN_KEY]: 75, [DESC_MP_REGEN_KEY]: 50 });
  });
  it("설명문이 비면 빈 표다(0이 아니다)", () => {
    expect(descriptionStats("")).toEqual({});
  });
});
