// ST-10 RED — TFT 어댑터. 실측(2026-09-21) 32건을 회귀로 고정한다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { diffTft, type CdragonSnapshot } from "../tft";
import { isSubmarineChange } from "../types";
import type { NoteLike } from "../note-link";

function snapshot(version: string): CdragonSnapshot {
  return {
    version,
    ...(JSON.parse(readFileSync(`data/cdragon/${version}/tft.json`, "utf8")) as Omit<
      CdragonSnapshot,
      "version"
    >),
  };
}

function notes(patch: string): NoteLike[] {
  return (
    JSON.parse(readFileSync(`data/aggregated/tft/notes-${patch}.json`, "utf8")) as {
      items: NoteLike[];
    }
  ).items;
}

describe("diffTft — 18.1 → 18.2 회귀 (실측 고정)", () => {
  const changes = diffTft(snapshot("16.17"), snapshot("16.18"), notes("18.2"), "18.2");
  const submarines = changes.filter(isSubmarineChange);

  it("수치 변경을 검출한다", () => {
    expect(changes.length).toBeGreaterThan(0);
  });

  it("★ 장로 드래곤 공격력 110 → 125가 잠수함으로 잡힌다", () => {
    const found = submarines.find(
      (c) => c.entityName === "장로 드래곤" && c.fieldPath === "stats.damage"
    );
    expect(found).toBeDefined();
    expect([found!.before, found!.after]).toEqual([110, 125]);
    expect(found!.relChange).toBeCloseTo(15 / 110, 6);
  });

  it("★ 조약돌·아무무도 잠수함에 들어 있다", () => {
    const names = new Set(submarines.map((c) => c.entityName));
    expect(names.has("조약돌")).toBe(true);
    expect(names.has("아무무")).toBe(true);
  });

  it("유닛과 아이템을 모두 본다", () => {
    const types = new Set(submarines.map((c) => c.entityType));
    expect(types.has("unit")).toBe(true);
    expect(types.has("item")).toBe(true);
  });

  it("★ 엔티티가 노트에 있어도 그 줄이 다른 수치를 말하면 잠수함이다", () => {
    // 폭풍갈퀴와 같은 패턴 — 이것이 필드 단위 대조의 존재 이유다.
    // 카직스 노트는 "기본 공격력 30→40"만 말하는데 체력 850→950이 바뀌었다.
    const kha = submarines.find(
      (c) => c.entityName === "카직스" && c.fieldPath === "stats.hp"
    );
    expect(kha).toBeDefined();
    expect([kha!.before, kha!.after]).toEqual([850, 950]);

    // 마스터 이 노트는 "기본 공격력 65→60"인데 방어력 60→55가 바뀌었다.
    const yi = submarines.find(
      (c) => c.entityName === "마스터 이" && c.fieldPath === "stats.armor"
    );
    expect(yi).toBeDefined();
    expect([yi!.before, yi!.after]).toEqual([60, 55]);
  });

  // **기준선 갱신(2026-09-21)**: 이전 고정값은 37(유닛 19 · 아이템 18)이었다. 사용자 지적으로
  // 패치노트 원문을 전수 대조해 **오탐 4건**(금빛 운명+·프리즘 운명+ 골드, 남작의 소굴 능력치,
  // 황금 드래곤 내구력 — 전부 노트가 값까지 똑같이 공지한 것)을 찾았고, 아이템 효과 사전으로
  // 그 4건이 공지 쪽으로 옮겨갔다. 테스트를 통과시키려고 숫자를 낮춘 것이 아니라 **판정이
  // 실제로 더 정확해져서** 낮아진 것이다 — 근거는 `docs/plan/VERIFY-tft-submarine-2026-09-21.md`.
  it("18.1 → 18.2 잠수함은 33건이다 (유닛 19 · 아이템 14)", () => {
    expect(submarines).toHaveLength(33);
    expect(submarines.filter((c) => c.entityType === "unit")).toHaveLength(19);
    expect(submarines.filter((c) => c.entityType === "item")).toHaveLength(14);
  });

  it("★ 대상 수와 값 수는 다르다 — 화면은 대상 수로 말한다", () => {
    const entities = new Set(submarines.map((c) => `${c.entityType}:${c.entityKey}`));
    expect(entities.size).toBe(27);
    expect(submarines.length).toBeGreaterThan(entities.size);
  });

  it("부동소수점 잡음은 변경이 아니다 — 0.039999961 → 0.039999962 같은 것", () => {
    // CDragon은 float32를 그대로 낸다. 의미 없는 끝자리 차이를 수치 변경으로 읽으면
    // 잠수함이 수십 건 허위로 생긴다.
    const a: CdragonSnapshot = {
      version: "a",
      set: "TFTSet18",
      units: { U: { name: "테스트", cost: 1, stats: { damage: 0.039999961853027344 }, ability: {} } },
      items: {},
    };
    const b: CdragonSnapshot = {
      version: "b",
      set: "TFTSet18",
      units: { U: { name: "테스트", cost: 1, stats: { damage: 0.03999996185302735 }, ability: {} } },
      items: {},
    };
    expect(diffTft(a, b, [], "18.2")).toEqual([]);
  });
});

// 2026-09-21 사용자 지적("건수가 동일대상의 여러항목으로 과다계상된건아닌지 확인해봐")으로
// 패치노트 원문을 전수 대조한 결과 **명백한 오탐 4건**이 나왔다. 원인은 짝짓기 검색어로
// CDragon **영문 키**(`Gold`·`Stats`)를 그대로 넘긴 것 — 노트는 한국어(「골드 제공」·「능력치
// 부여」)라 영원히 못 맞춘다. 유닛 스킬 변수는 같은 문제를 이미 `entityMatchSuffices`로
// 피하고 있었는데 아이템 효과에는 안 걸려 있었다.
describe("diffTft — 아이템 효과는 한국어 낱말로 노트를 찾는다", () => {
  const changes = diffTft(snapshot("16.17"), snapshot("16.18"), notes("18.2"), "18.2");
  const submarines = changes.filter(isSubmarineChange);
  const sub = (name: string, path: string) =>
    submarines.find((c) => c.entityName === name && c.fieldPath === path);
  const any = (name: string, path: string) =>
    changes.find((c) => c.entityName === name && c.fieldPath === path);

  it.each([
    ["금빛 운명+", "effects.Gold", "골드 제공: 6골드 ⇒ 5골드"],
    ["프리즘 운명+", "effects.Gold", "골드 제공: 10골드 ⇒ 7골드"],
    ["남작의 소굴", "effects.Stats", "능력치 부여: 5% ⇒ 4%"],
    ["황금 드래곤", "effects.BonusDurability", "내구력: 20% ⇒ 15%"],
  ])("★ %s %s — 노트가 「%s」로 공지했으므로 잠수함이 아니다", (name, path) => {
    expect(any(name, path)).toBeDefined();
    expect(sub(name, path)).toBeUndefined();
  });

  it("★ 같은 엔티티라도 노트가 말하지 않은 효과는 그대로 잠수함이다", () => {
    // 황금 드래곤 노트는 「내구력」만 말했다 — 추가 체력 700 → 600은 여전히 미공지다.
    expect(sub("황금 드래곤", "effects.BonusHealth")).toBeDefined();
  });

  it("효과 이름을 한국어로 표시한다 — 화면에 `효과 ASMultiplier`가 나가지 않는다", () => {
    const c = any("후방의 핵심", "effects.ASMultiplier");
    expect(c).toBeDefined();
    expect(c!.field).toBe("효과 공격 속도");
  });

  it("사전에 없는 키는 낱말을 지어내지 않고 원문 키를 쓴다", () => {
    for (const c of changes) {
      if (!c.fieldPath.startsWith("effects.")) continue;
      expect(c.field.startsWith("효과 ")).toBe(true);
    }
  });
});
