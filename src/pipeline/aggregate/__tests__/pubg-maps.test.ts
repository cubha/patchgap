// src/pipeline/aggregate/__tests__/pubg-maps.test.ts
// 맵 축 집계 검증. 무기 축과 달리 맵에는 43.1 패치노트 항목이 0건이라 판정이 붙지 않는다 —
// 그래서 여기서 지키는 불변식은 "판정을 만들지 않는다"가 아니라 **분모·정규화·비대칭 처리**다.
import { describe, expect, it } from "vitest";
import {
  aggregatePubgMaps,
  buildPubgMapDeltas,
  mapIdentity,
  type PubgMapAggregate,
} from "../pubg-maps";
import type { PubgReducedMatch } from "../pubg-weapons";

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

describe("aggregatePubgMaps", () => {
  it("맵별로 묶고 matchShare 분모를 입력 전체로 잡는다", () => {
    const agg = aggregatePubgMaps(
      [
        match({ matchId: "a", map: "Baltic_Main" }),
        match({ matchId: "b", map: "Baltic_Main" }),
        match({ matchId: "c", map: "Savage_Main" }),
        match({ matchId: "d", map: "Savage_Main" }),
      ],
      "42.3",
      "42.3 (9/4~9/8)"
    );
    expect(agg.nMatches).toBe(4);
    expect(agg.maps.map((m) => m.mapKey).sort()).toEqual(["Baltic_Main", "Savage_Main"]);
    expect(agg.maps.every((m) => m.matchShare === 0.5)).toBe(true);
  });

  it("매치수 내림차순으로 정렬한다", () => {
    const agg = aggregatePubgMaps(
      [
        match({ matchId: "a", map: "Savage_Main" }),
        match({ matchId: "b", map: "Baltic_Main" }),
        match({ matchId: "c", map: "Baltic_Main" }),
      ],
      "42.3",
      "L"
    );
    expect(agg.maps[0].mapKey).toBe("Baltic_Main");
  });

  it("map이 null인 매치는 맵 축에서 빠지지만 분모에는 남는다 — 점유율을 부풀리지 않는다", () => {
    const agg = aggregatePubgMaps(
      [match({ matchId: "a", map: "Baltic_Main" }), match({ matchId: "b", map: null })],
      "42.3",
      "L"
    );
    expect(agg.nMatches).toBe(2);
    expect(agg.maps).toHaveLength(1);
    expect(agg.maps[0].matchShare).toBe(0.5);
  });

  it("duration이 null인 매치는 평균의 분모에서도 빠진다(0으로 치지 않는다)", () => {
    const agg = aggregatePubgMaps(
      [
        match({ matchId: "a", duration: 1000 }),
        match({ matchId: "b", duration: null }),
      ],
      "42.3",
      "L"
    );
    expect(agg.maps[0].avgDurationSec).toBe(1000);
  });

  it("duration이 전부 null이면 평균은 null이다 — 0초라고 말하지 않는다", () => {
    const agg = aggregatePubgMaps([match({ duration: null })], "42.3", "L");
    expect(agg.maps[0].avgDurationSec).toBeNull();
  });

  it("무기 점유율은 그 맵 안 총 픽업으로 정규화하고 비총기는 제외한다", () => {
    const agg = aggregatePubgMaps(
      [
        match({
          weaponPickup: {
            Item_Weapon_AK47_C: 30,
            Item_Weapon_RPD_C: 10,
            Item_Weapon_Pan_C: 999, // 근접 — isFirearm이 걸러야 한다
          },
        }),
      ],
      "42.3",
      "L"
    );
    const top = agg.maps[0].topWeapons;
    expect(top.map((w) => w.weaponKey)).not.toContain("Item_Weapon_Pan_C");
    expect(top[0].share).toBeCloseTo(0.75, 10);
    expect(agg.maps[0].pickupsPerMatch).toBe(40);
  });

  it("스킨 변종 키를 정준키로 합산한다", () => {
    const agg = aggregatePubgMaps(
      [match({ weaponPickup: { Item_Weapon_AK47_C: 10, Item_Weapon_Lunchmeats_AK47_C: 10 } })],
      "42.3",
      "L"
    );
    expect(agg.maps[0].topWeapons).toHaveLength(1);
    expect(agg.maps[0].topWeapons[0].pickups).toBe(20);
  });

  it("빈 입력에서도 throw하지 않는다", () => {
    const agg = aggregatePubgMaps([], "42.3", "L");
    expect(agg.nMatches).toBe(0);
    expect(agg.maps).toEqual([]);
  });
});

describe("buildPubgMapDeltas", () => {
  function agg(patch: string, rows: { key: string; n: number }[], total: number): PubgMapAggregate {
    return aggregatePubgMaps(
      rows.flatMap(({ key, n }) =>
        Array.from({ length: n }, (_, i) => match({ matchId: `${key}-${i}`, map: key }))
      ).concat(
        // 분모를 total로 맞추기 위한 map 미상 매치
        Array.from({ length: total - rows.reduce((s, r) => s + r.n, 0) }, (_, i) =>
          match({ matchId: `x-${i}`, map: null })
        )
      ),
      patch,
      patch
    );
  }

  it("양쪽에 다 있는 맵만 비교행을 만든다", () => {
    const result = buildPubgMapDeltas(
      agg("42.3", [{ key: "Baltic_Main", n: 5 }, { key: "Savage_Main", n: 5 }], 10),
      agg("43.1", [{ key: "Baltic_Main", n: 8 }], 10)
    );
    expect(result.rows.map((r) => r.mapKey)).toEqual(["Baltic_Main"]);
    expect(result.onlyBefore).toEqual(["Savage_Main"]);
    expect(result.onlyAfter).toEqual([]);
  });

  it("matchShareDelta는 after - before다", () => {
    const result = buildPubgMapDeltas(
      agg("42.3", [{ key: "Baltic_Main", n: 2 }], 10),
      agg("43.1", [{ key: "Baltic_Main", n: 5 }], 10)
    );
    expect(result.rows[0].matchShareDelta).toBeCloseTo(0.3, 10);
  });
});

describe("mapIdentity", () => {
  it("텔레메트리 키를 api-assets 표시명으로 옮긴다 — 파일명이 키가 아니라 표시명 기준이다", () => {
    expect(mapIdentity("Baltic_Main").assetName).toBe("Erangel");
    expect(mapIdentity("Desert_Main").assetName).toBe("Miramar");
    expect(mapIdentity("Savage_Main").koName).toBe("사녹");
  });

  it("미등록 키는 이름을 지어내지 않고 키 그대로 돌려준다", () => {
    const unknown = mapIdentity("Future_Main");
    expect(unknown.koName).toBe("Future_Main");
    expect(unknown.assetName).toBe("");
  });
});
