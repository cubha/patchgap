// ST-1 RED — 게임 무관 diff 엔진. 구현 전에 계약을 고정한다.
import { describe, it, expect } from "vitest";
import { relativeChange, changeId, diffValueMap, buildChange } from "../diff";
import { isSubmarineChange } from "../types";

describe("relativeChange", () => {
  it("숫자끼리면 상대 변화를 낸다", () => {
    expect(relativeChange(61, 58)).toBeCloseTo((58 - 61) / 61, 10);
    expect(relativeChange(3000, 3200)).toBeCloseTo(200 / 3000, 10);
  });

  it("배열 문자열(레벨별 수치)은 null — 한 숫자로 요약하면 거짓말이 된다", () => {
    expect(relativeChange("75/115/155", "70/110/150")).toBeNull();
  });

  it("before가 0이거나 null이면 null — 나눗셈이 성립하지 않는다", () => {
    expect(relativeChange(0, 5)).toBeNull();
    expect(relativeChange(null, 5)).toBeNull();
    expect(relativeChange(5, null)).toBeNull();
  });
});

describe("changeId", () => {
  it("같은 입력이면 같은 id — 재생성해도 화면 링크가 끊기지 않는다", () => {
    const a = changeId("lol", "26.17", "3095", "gold.total");
    const b = changeId("lol", "26.17", "3095", "gold.total");
    expect(a).toBe(b);
    expect(a).toBe("gdc:lol:26.17:3095:gold.total");
  });

  it("필드가 다르면 id가 다르다", () => {
    expect(changeId("lol", "26.17", "3095", "gold.total")).not.toBe(
      changeId("lol", "26.17", "3095", "stats.PercentAttackSpeedMod")
    );
  });
});

describe("diffValueMap", () => {
  it("값이 다른 키만 낸다", () => {
    const out = diffValueMap({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(out).toEqual([{ key: "b", before: 2, after: 3 }]);
  });

  it("한쪽에만 있는 키도 변경이다 — 아이템이 스탯을 갈아끼우면 이 형태로 온다", () => {
    // 실측(26.17 리글의 랜턴): FlatPhysicalDamageMod 25 → 없음 · PercentAttackSpeedMod 없음 → 0.3
    const out = diffValueMap(
      { FlatPhysicalDamageMod: 25, FlatArmorMod: 25 },
      { PercentAttackSpeedMod: 0.3, FlatArmorMod: 25 }
    );
    expect(out).toEqual([
      { key: "FlatPhysicalDamageMod", before: 25, after: null },
      { key: "PercentAttackSpeedMod", before: null, after: 0.3 },
    ]);
  });

  it("양쪽 다 없으면 변경이 아니다", () => {
    expect(diffValueMap({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("키는 정렬된 순서로 나온다 — 산출물이 실행마다 흔들리지 않아야 커밋 diff가 의미를 갖는다", () => {
    const out = diffValueMap({ z: 1, a: 1 }, { z: 2, a: 2 });
    expect(out.map((c) => c.key)).toEqual(["a", "z"]);
  });
});

describe("buildChange", () => {
  const base = {
    game: "lol",
    patch: "26.17",
    entityKey: "3095",
    entityName: "폭풍갈퀴",
    entityType: "item",
    field: "가격",
    fieldPath: "gold.total",
    before: 3000,
    after: 3200,
  };

  it("id와 relChange를 채운다", () => {
    const c = buildChange({ ...base, matchedNoteIds: [] });
    expect(c.id).toBe("gdc:lol:26.17:3095:gold.total");
    expect(c.relChange).toBeCloseTo(200 / 3000, 10);
    expect(c.entityName).toBe("폭풍갈퀴");
  });

  it("노트 짝이 없으면 잠수함 패치다", () => {
    expect(isSubmarineChange(buildChange({ ...base, matchedNoteIds: [] }))).toBe(true);
  });

  it("노트 짝이 있으면 잠수함이 아니다", () => {
    const c = buildChange({ ...base, matchedNoteIds: ["note:26.17:item:stormrazor:0a1d6b43"] });
    expect(isSubmarineChange(c)).toBe(false);
  });
});
