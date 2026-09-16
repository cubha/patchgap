// src/pipeline/aggregate/__tests__/pubg-weapons.test.ts
// PUBG 집계 검증 — 특히 **표본 오염 필터**를 건다.
// `/samples`는 official 외에 airoyale·competitive·tutorialatoz·trainingroom을 함께 돌려주며
// 2026-09-16 실측에서 표본의 약 절반이 비경쟁 매치였다. 최초 리듀서가 이걸 놓쳐 튜토리얼
// 매치(이벤트 1,583건짜리)가 통계에 들어갈 뻔했다 — 이 테스트가 그 회귀를 막는다.
import { describe, expect, it } from "vitest";
import {
  aggregatePubgWeapons,
  isFirearm,
  selectMatches,
  weaponDisplayName,
  type PubgReducedMatch,
} from "../pubg-weapons";

function match(over: Partial<PubgReducedMatch> = {}): PubgReducedMatch {
  return {
    matchId: "m1",
    createdAt: "2026-09-05T12:00:00Z",
    map: "Baltic_Main",
    gameMode: "squad",
    duration: 1800,
    patch: "pc-2018-42",
    matchType: "official",
    region: "as",
    nBots: 30,
    nHumans: 70,
    weaponPickup: { Item_Weapon_AK47_C: 10, Item_Weapon_RPD_C: 5 },
    weaponKills: {},
    weaponDamageHits: {},
    weaponAttacks: {},
    ...over,
  };
}

const WINDOW = new Set(["2026-09-04", "2026-09-05"]);

describe("selectMatches", () => {
  it("official 매치만 통과시킨다 — 비경쟁 매치는 통계를 오염시킨다", () => {
    const rows = [
      match({ matchId: "ok" }),
      match({ matchId: "tut", matchType: "tutorialatoz" }),
      match({ matchId: "air", matchType: "airoyale" }),
      match({ matchId: "comp", matchType: "competitive" }),
      match({ matchId: "train", matchType: "trainingroom" }),
    ];
    expect(selectMatches(rows, "pc-2018-42", WINDOW).map((r) => r.matchId)).toEqual(["ok"]);
  });

  it("패치 라벨이 다르면 뺀다 — 경계 구간 혼입 방지", () => {
    const rows = [match({ matchId: "a" }), match({ matchId: "b", patch: "pc-2018-43" })];
    expect(selectMatches(rows, "pc-2018-42", WINDOW).map((r) => r.matchId)).toEqual(["a"]);
  });

  it("허용 날짜 밖이면 뺀다 — 요일 교락을 집계 단계에서 자른다", () => {
    const rows = [match({ matchId: "in" }), match({ matchId: "out", createdAt: "2026-09-08T01:00:00Z" })];
    expect(selectMatches(rows, "pc-2018-42", WINDOW).map((r) => r.matchId)).toEqual(["in"]);
  });

  it("패치 라벨이 null이면 뺀다 — 라벨을 못 읽은 매치를 날짜로 추정하지 않는다", () => {
    expect(selectMatches([match({ patch: null })], "pc-2018-42", WINDOW)).toHaveLength(0);
  });
});

describe("isFirearm", () => {
  it("근접무기·투척물은 점유율 분모에서 뺀다", () => {
    for (const key of [
      "Item_Weapon_Pan_C",
      "Item_Weapon_Cowbar_C",
      "Item_Weapon_Sickle_C",
      "Item_Weapon_Pickaxe_C",
      "Item_Weapon_Grenade_C",
      "Item_Weapon_Molotov_C",
    ]) {
      expect(isFirearm(key), key).toBe(false);
    }
  });

  it("총기는 남긴다", () => {
    for (const key of ["Item_Weapon_AK47_C", "Item_Weapon_RPD_C", "Item_Weapon_M249_C"]) {
      expect(isFirearm(key), key).toBe(true);
    }
  });
});

describe("weaponDisplayName", () => {
  it("규칙으로 접두·접미를 벗긴다", () => {
    expect(weaponDisplayName("Item_Weapon_AK47_C")).toBe("AK47");
  });

  it("내부명과 통용명이 다르면 예외표를 따른다", () => {
    expect(weaponDisplayName("Item_Weapon_HK416_C")).toBe("M416");
    expect(weaponDisplayName("Item_Weapon_FNFal_C")).toBe("SLR");
  });
});

describe("aggregatePubgWeapons", () => {
  it("점유율은 총 획득 대비로 정규화한다 — 기저 이동을 분리하기 위해서다", () => {
    const agg = aggregatePubgWeapons([match(), match({ matchId: "m2" })], "42.3", "42.3");
    expect(agg.nMatches).toBe(2);
    expect(agg.totalPickups).toBe(30);
    const ak = agg.weapons.find((w) => w.weaponKey === "Item_Weapon_AK47_C");
    expect(ak?.pickups).toBe(20);
    expect(ak?.share).toBeCloseTo(20 / 30, 6);
  });

  it("매치 수가 늘어도 점유율은 유지되지만 매치당 획득은 유지된다", () => {
    const one = aggregatePubgWeapons([match()], "42.3", "42.3");
    const two = aggregatePubgWeapons([match(), match({ matchId: "m2" })], "42.3", "42.3");
    expect(two.weapons[0]?.share).toBeCloseTo(one.weapons[0]?.share ?? 0, 6);
    expect(two.pickupsPerMatch).toBeCloseTo(one.pickupsPerMatch, 6);
  });

  it("근접무기는 분모에 들어가지 않는다", () => {
    const withPan = aggregatePubgWeapons(
      [match({ weaponPickup: { Item_Weapon_AK47_C: 10, Item_Weapon_Pan_C: 90 } })],
      "42.3",
      "42.3"
    );
    expect(withPan.totalPickups).toBe(10);
    expect(withPan.weapons.map((w) => w.weaponKey)).not.toContain("Item_Weapon_Pan_C");
  });

  it("봇 비율을 병기한다 — 전후로 다르면 그 자체가 교락이다", () => {
    const agg = aggregatePubgWeapons([match({ nBots: 25, nHumans: 75 })], "42.3", "42.3");
    expect(agg.botShare).toBeCloseTo(0.25, 6);
  });

  it("빈 입력에서도 무너지지 않는다(빈 데이터 빌드 보장)", () => {
    const agg = aggregatePubgWeapons([], "42.3", "42.3");
    expect(agg.nMatches).toBe(0);
    expect(agg.totalPickups).toBe(0);
    expect(agg.pickupsPerMatch).toBe(0);
    expect(agg.botShare).toBe(0);
    expect(agg.weapons).toEqual([]);
  });
});
