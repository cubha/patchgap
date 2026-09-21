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

  // **기준선 갱신 2회(2026-09-21)** — 둘 다 판정이 *더 정확해져서* 줄었다. 테스트를 통과시키려고
  // 숫자를 낮춘 것이 아니다. 근거는 전부 `docs/plan/VERIFY-tft-submarine-2026-09-21.md`.
  //   37 → 33 : 아이템 효과 짝짓기가 CDragon **영문 키**를 한국어 노트에서 찾고 있었다.
  //             오탐 4건(금빛 운명+·프리즘 운명+ 골드, 남작의 소굴 능력치, 황금 드래곤 내구력).
  //   33 → 31 : 노트 카탈로그를 CDragon으로 보강해 미해소가 60 → 16줄로 줄었고, 덩굴정령·
  //             어미 부리 공격력 2건이 **잠수함이 아니라 「값 불일치」**임이 드러났다.
  //             이 둘은 사라진 것이 아니라 아래 `noteMismatch` 축으로 옮겨갔다.
  it("18.1 → 18.2 잠수함은 31건이다 (유닛 17 · 아이템 14)", () => {
    expect(submarines).toHaveLength(31);
    expect(submarines.filter((c) => c.entityType === "unit")).toHaveLength(17);
    expect(submarines.filter((c) => c.entityType === "item")).toHaveLength(14);
  });

  it("★ 대상 수와 값 수는 다르다 — 화면은 대상 수로 말한다", () => {
    const entities = new Set(submarines.map((c) => `${c.entityType}:${c.entityKey}`));
    expect(entities.size).toBe(25);
    expect(submarines.length).toBeGreaterThan(entities.size);
  });

  // 카탈로그 보강의 **진짜 값**은 미해소 숫자가 아니라 이 둘이다. 노트가 같은 항목을 말했는데
  // 값이 다르다 — 잠수함으로 세면 틀리고, 그냥 공지로 처리하면 **화면에서 사라진다**.
  it("★ 덩굴정령·어미 부리는 잠수함이 아니라 「값 불일치」다", () => {
    const mismatches = changes.filter((c) => c.noteMismatch);
    expect(mismatches.map((c) => `${c.entityName} ${c.field}`)).toEqual([
      "덩굴정령 공격력",
      "어미 부리 공격력",
    ]);

    const bramble = mismatches.find((c) => c.entityName === "덩굴정령")!;
    expect([bramble.before, bramble.after]).toEqual([110, 115]);
    expect([bramble.noteMismatch!.noteBefore, bramble.noteMismatch!.noteAfter]).toEqual(["115", "120"]);

    // 잠수함과 배타적이다 — 짝이 있어야 불일치가 성립한다.
    expect(mismatches.every((c) => c.matchedNoteIds.length > 0)).toBe(true);
    expect(submarines.some((c) => c.noteMismatch)).toBe(false);
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
