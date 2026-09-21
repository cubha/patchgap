// ST-5 — PUBG 피해 격자. 평균이 아니라 격자를 본다(PLAN §2-1).
//
// 2026-09-21 판별자 교체(6번째 — 이번엔 규칙이 아니라 **통계**를 바꿨다): 값 하나가 움직였나가 아니라
// **분포 전체가 같은 비율로 옮겨갔나**를 본다. 아래 계약은 실측(전량 5,079매치)으로 먼저 확정했다:
//   - 같은 패치를 무작위 반반으로 갈라 비교(무변화 대조군 381셀): 이동 이득 D 최대 0.021
//   - 실제 42.3→43.1(191셀): D 최대 0.027
//   - 격자 전체를 ×1.03 / ×0.97 / ×1.10 한 합성 변경: D 중앙값 0.42, 5분위 0.13
// 이전 규칙 5종(max·최빈·순위·집합 생존)은 전부 "어느 한 값"을 물었기 때문에 틀렸다.
import { describe, it, expect } from "vitest";
import {
  mergeGrids,
  compareGrids,
  gridToChanges,
  expandPubgNotes,
  type DamageGrid,
  type GridCell,
} from "../pubg";
import { isSubmarineChange } from "../types";
import fixture from "./fixtures/pubg-grid-42.3-43.1.json";

function grid(
  spec: Record<string, Record<string, { n: number; max: number; top?: [number, number][] }>>
): DamageGrid {
  const out: DamageGrid = {};
  for (const [weapon, reasons] of Object.entries(spec)) {
    out[weapon] = {};
    for (const [reason, v] of Object.entries(reasons)) {
      out[weapon][reason] = { n: v.n, max: v.max, top: v.top ?? [[v.max, v.n]] };
    }
  }
  return out;
}

/** 격자 전체를 같은 비율로 옮긴다 — 기본 데미지·부위 배율이 바뀌면 이렇게 된다. */
function scaled(cell: GridCell, ratio: number): GridCell {
  return {
    n: cell.n,
    max: Math.round(cell.max * ratio * 100) / 100,
    top: cell.top.map(([v, c]) => [Math.round(v * ratio * 100) / 100, c] as const),
  };
}

/** 값은 그대로, 빈도만 다른 표본 — 방어구·거리 구성이 바뀌면 이렇게 된다(수치 변경이 아니다). */
function resampled(cell: GridCell, seed: number): GridCell {
  return {
    n: cell.n,
    max: cell.max,
    top: cell.top.map(([v, c], i) => [v, Math.max(1, Math.round(c * (0.7 + ((i * seed) % 7) / 10)))] as const),
  };
}

const OPTS = { minHits: 120 } as const;
const AK = fixture.ak47Torso as { before: GridCell; after: GridCell };
const DP12 = fixture.dp12Leg as { before: GridCell; after: GridCell };
const UMP = fixture.umpTorso as { before: GridCell; after: GridCell };

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
    const shifts = compareGrids(
      { W: { TorsoShot: AK.before } },
      { W: { TorsoShot: { ...scaled(AK.after, 1.1), n: 50 } } },
      OPTS
    );
    expect(shifts).toEqual([]);
  });
});

describe("compareGrids — 실측 격자 (42.3 → 43.1 전량)", () => {
  it("AK47 몸통: 격자가 그대로면 이동이 아니다", () => {
    expect(compareGrids({ W: { TorsoShot: AK.before } }, { W: { TorsoShot: AK.after } }, OPTS)).toEqual([]);
  });

  it("★ AK47 몸통 ×1.05: 분포 전체가 옮겨가면 이동이다 — 비율과 대표값까지 맞아야 한다", () => {
    const shifts = compareGrids(
      { W: { TorsoShot: AK.before } },
      { W: { TorsoShot: scaled(AK.after, 1.05) } },
      OPTS
    );
    expect(shifts).toHaveLength(1);
    expect(shifts[0].relChange).toBeCloseTo(0.05, 2);
    // 대표값은 최빈 격자값(28.8)과 그 짝이다 — 화면이 "28.8 → 30.24"로 말한다.
    expect(shifts[0].before).toBe(28.8);
    expect(shifts[0].after).toBeCloseTo(30.24, 2);
  });

  it("★ UMP 몸통(연속값 26.46/26.45/26.44…): 이산 격자가 아니어도 ×0.97 이동을 잡는다", () => {
    // 5번째 실패의 원인이었던 무기 — "격자값이 사라졌나"로는 판정 불가였다.
    const same = compareGrids({ W: { TorsoShot: UMP.before } }, { W: { TorsoShot: UMP.after } }, OPTS);
    expect(same).toEqual([]);
    const nerf = compareGrids(
      { W: { TorsoShot: UMP.before } },
      { W: { TorsoShot: scaled(UMP.after, 0.97) } },
      OPTS
    );
    expect(nerf).toHaveLength(1);
    expect(nerf[0].relChange).toBeCloseTo(-0.03, 2);
  });

  it("DP12 다리(얇은 표본 270/217, 실측 D=0.027 근접 사례): 이동으로 읽지 않는다", () => {
    expect(compareGrids({ W: { LegShot: DP12.before } }, { W: { LegShot: DP12.after } }, OPTS)).toEqual([]);
  });
});

describe("compareGrids — 이전 오탐 5종의 재현 방지", () => {
  it("① max만 이상치로 움직인 경우(FNFal)는 이동이 아니다", () => {
    const after: GridCell = { ...AK.after, max: 56.59, top: [...AK.after.top, [56.59, 1]] };
    expect(compareGrids({ W: { TorsoShot: AK.before } }, { W: { TorsoShot: after } }, OPTS)).toEqual([]);
  });

  it("② 꼬리값이 top에서 빠지거나 들어와도 이동이 아니다(DP12)", () => {
    const after: GridCell = { ...AK.after, top: AK.after.top.slice(0, 30) };
    expect(compareGrids({ W: { TorsoShot: AK.before } }, { W: { TorsoShot: after } }, OPTS)).toEqual([]);
  });

  it("③ 동률 최빈값의 순위가 뒤집혀도 이동이 아니다(ACE32)", () => {
    const before = grid({ W: { ArmShot: { n: 4000, max: 23.22, top: [[23.22, 1947], [19.35, 1937], [30.0, 116]] } } });
    const after = grid({ W: { ArmShot: { n: 4000, max: 23.22, top: [[19.35, 1950], [23.22, 1930], [30.0, 120]] } } });
    expect(compareGrids(before, after, OPTS)).toEqual([]);
  });

  it("④⑤ 값은 그대로고 빈도 구성만 바뀐 표본(방어구·거리 구성)은 이동이 아니다", () => {
    expect(
      compareGrids({ W: { TorsoShot: AK.before } }, { W: { TorsoShot: resampled(AK.after, 3) } }, OPTS)
    ).toEqual([]);
    expect(
      compareGrids({ W: { TorsoShot: UMP.before } }, { W: { TorsoShot: resampled(UMP.after, 5) } }, OPTS)
    ).toEqual([]);
  });
});

describe("compareGrids — 부위별 독립 판정", () => {
  it("★ 한 부위만 옮겨가도 그 부위만 이동이다(부위 배율 단독 변경)", () => {
    const shifts = compareGrids(
      { W: { HeadShot: AK.before, TorsoShot: AK.before } },
      { W: { HeadShot: scaled(AK.after, 1.2), TorsoShot: AK.after } },
      OPTS
    );
    expect(shifts).toHaveLength(1);
    expect(shifts[0].reason).toBe("HeadShot");
    expect(shifts[0].relChange).toBeCloseTo(0.2, 2);
  });

  it("1.2% 미만의 이동은 격자 고정으로 본다(부동소수·반올림 허용 오차)", () => {
    expect(
      compareGrids({ W: { TorsoShot: AK.before } }, { W: { TorsoShot: scaled(AK.after, 1.008) } }, OPTS)
    ).toEqual([]);
  });
});

describe("expandPubgNotes — 노트는 entity 대신 weaponKeys를 갖는다", () => {
  it("weaponKeys 하나마다 표시명을 엔티티로 하는 NoteLike를 만든다", () => {
    const notes = expandPubgNotes([
      { id: "note:pubg-43.1:vehicledmg:lmg", stat: "차량 피해 배수", weaponKeys: ["Item_Weapon_RPD_C", "Item_Weapon_M249_C"] },
      { id: "note:pubg-43.1:misc", stat: "기타", weaponKeys: [] },
    ]);
    expect(notes).toEqual([
      { id: "note:pubg-43.1:vehicledmg:lmg", entity: "RPD", skill: null, stat: "차량 피해 배수" },
      { id: "note:pubg-43.1:vehicledmg:lmg", entity: "M249", skill: null, stat: "차량 피해 배수" },
    ]);
  });
});

describe("gridToChanges", () => {
  const shifts = compareGrids(
    { WeapFNFal_C: { TorsoShot: AK.before } },
    { WeapFNFal_C: { TorsoShot: scaled(AK.after, 1.09) } },
    OPTS
  );

  it("노트에 없으면 잠수함", () => {
    const changes = gridToChanges(shifts, [], "43.1");
    expect(changes).toHaveLength(1);
    expect(isSubmarineChange(changes[0])).toBe(true);
    expect(changes[0].entityType).toBe("weapon");
    expect(changes[0].entityKey).toBe("WeapFNFal_C");
    expect(changes[0].entityName).toBe("FNFal");
  });

  it("노트가 그 무기의 피해량을 말하면 공지다", () => {
    const changes = gridToChanges(
      shifts,
      [{ id: "note:fnfal", entity: "FNFal", skill: null, stat: "기본 피해량" }],
      "43.1"
    );
    expect(isSubmarineChange(changes[0])).toBe(false);
  });

  it("같은 무기라도 반동·조준 전환·차량 피해 노트는 플레이어 피해량을 설명하지 않는다", () => {
    const changes = gridToChanges(
      shifts,
      [
        { id: "note:fnfal-recoil", entity: "FNFal", skill: null, stat: "반동 제어" },
        { id: "note:fnfal-vehicle", entity: "FNFal", skill: null, stat: "차량 피해 배수" },
      ],
      "43.1"
    );
    expect(isSubmarineChange(changes[0])).toBe(true);
  });
});
