// ST-5 RED — PUBG 피해 격자. 평균이 아니라 격자를 본다(PLAN §2-1).
import { describe, it, expect } from "vitest";
import { mergeGrids, compareGrids, gridToChanges, type DamageGrid } from "../pubg";
import { isSubmarineChange } from "../types";

function grid(
  spec: Record<string, Record<string, { n: number; max: number; top?: [number, number][] }>>
): DamageGrid {
  const out: DamageGrid = {};
  for (const [weapon, reasons] of Object.entries(spec)) {
    out[weapon] = {};
    for (const [reason, v] of Object.entries(reasons)) {
      // top이 없으면 max를 최빈값으로 둔다 — 두 추정자가 같이 움직이는 기본형.
      out[weapon][reason] = { n: v.n, max: v.max, top: v.top ?? [[v.max, v.n]] };
    }
  }
  return out;
}

describe("mergeGrids", () => {
  it("매치별 격자를 합치면 표본은 더해지고 최대치는 최대가 된다", () => {
    const merged = mergeGrids([
      grid({ WeapAK47_C: { TorsoShot: { n: 100, max: 41.0 } } }),
      grid({ WeapAK47_C: { TorsoShot: { n: 50, max: 43.5 } } }),
    ]);
    expect(merged.WeapAK47_C.TorsoShot.n).toBe(150);
    expect(merged.WeapAK47_C.TorsoShot.max).toBe(43.5);
  });

  it("한쪽에만 있는 무기도 살아남는다", () => {
    const merged = mergeGrids([
      grid({ A: { TorsoShot: { n: 10, max: 1 } } }),
      grid({ B: { TorsoShot: { n: 10, max: 2 } } }),
    ]);
    expect(Object.keys(merged).sort()).toEqual(["A", "B"]);
  });
});

describe("compareGrids — 표본 게이트", () => {
  it("부위별 최소 표본을 못 채우면 판정하지 않는다", () => {
    // insufficient-sample과 같은 규율 — 얇은 표본으로 잠수함을 단정하지 않는다.
    const shifts = compareGrids(
      grid({ W: { TorsoShot: { n: 50, max: 40 } } }),
      grid({ W: { TorsoShot: { n: 50, max: 60 } } }),
      { minHits: 120 }
    );
    expect(shifts).toEqual([]);
  });

  it("표본이 충분하고 격자가 고정이면 변화가 아니다", () => {
    // 실측: 무기 52종 중 51종이 1.5% 이내로 고정됐다 — 방법 자체의 검증.
    const shifts = compareGrids(
      grid({ W: { TorsoShot: { n: 500, max: 41.0 } } }),
      grid({ W: { TorsoShot: { n: 500, max: 41.2 } } }),
      { minHits: 120, tolerance: 0.015 }
    );
    expect(shifts).toEqual([]);
  });

  it("★ 허용 오차를 넘으면 격자가 이동한 것이다", () => {
    // 실측 후보: FNFal TorsoShot 51.93 → 56.59 (+9.0%)
    const shifts = compareGrids(
      grid({ WeapFNFal_C: { TorsoShot: { n: 172, max: 51.93 } } }),
      grid({ WeapFNFal_C: { TorsoShot: { n: 149, max: 56.59 } } }),
      { minHits: 120, tolerance: 0.015 }
    );
    expect(shifts).toHaveLength(1);
    expect(shifts[0].weapon).toBe("WeapFNFal_C");
    expect(shifts[0].reason).toBe("TorsoShot");
    expect(shifts[0].relChange).toBeCloseTo((56.59 - 51.93) / 51.93, 6);
  });
});

describe("compareGrids — 이상치 방어 (max는 표본이 커질수록 커지는 편향 추정자다)", () => {
  it("최대치만 움직이고 최빈값이 그대로면 이상치다 — 판정하지 않는다", () => {
    const before = grid({
      W: { TorsoShot: { n: 500, max: 41.0, top: [[41.0, 300], [30.0, 200]] } },
    });
    const after = grid({
      W: { TorsoShot: { n: 500, max: 52.0, top: [[41.0, 300], [30.0, 200]] } },
    });
    expect(compareGrids(before, after, { minHits: 120, tolerance: 0.015 })).toEqual([]);
  });

  it("두 추정자가 함께 이동하면 격자가 실제로 옮겨간 것이다", () => {
    const before = grid({
      W: { TorsoShot: { n: 500, max: 41.0, top: [[41.0, 300], [30.0, 200]] } },
    });
    const after = grid({
      W: { TorsoShot: { n: 500, max: 45.0, top: [[45.0, 300], [33.0, 200]] } },
    });
    const shifts = compareGrids(before, after, { minHits: 120, tolerance: 0.015 });
    expect(shifts).toHaveLength(1);
  });
});

describe("gridToChanges", () => {
  const shifts = compareGrids(
    grid({ WeapFNFal_C: { TorsoShot: { n: 172, max: 51.93 } } }),
    grid({ WeapFNFal_C: { TorsoShot: { n: 149, max: 56.59 } } }),
    { minHits: 120, tolerance: 0.015 }
  );

  it("노트에 없으면 잠수함", () => {
    const changes = gridToChanges(shifts, [], "43.1");
    expect(changes).toHaveLength(1);
    expect(isSubmarineChange(changes[0])).toBe(true);
    expect(changes[0].entityType).toBe("weapon");
    expect(changes[0].entityKey).toBe("WeapFNFal_C");
  });

  it("노트가 그 무기의 피해량을 말하면 공지다", () => {
    const changes = gridToChanges(
      shifts,
      [{ id: "note:fnfal", entity: "FNFal", skill: null, stat: "기본 피해량" }],
      "43.1"
    );
    expect(isSubmarineChange(changes[0])).toBe(false);
  });

  it("같은 무기라도 반동·조준 전환 노트는 피해량을 설명하지 않는다", () => {
    // 43.1 노트는 LMG의 반동·조준 전환·스폰율만 말했고 피해량 축은 건드리지 않았다.
    const changes = gridToChanges(
      shifts,
      [{ id: "note:fnfal-recoil", entity: "FNFal", skill: null, stat: "반동 제어" }],
      "43.1"
    );
    expect(isSubmarineChange(changes[0])).toBe(true);
  });
});
