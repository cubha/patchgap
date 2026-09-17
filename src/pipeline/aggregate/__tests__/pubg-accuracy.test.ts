// src/pipeline/aggregate/__tests__/pubg-accuracy.test.ts
// §8 반증표(PLAN-pubg-gate-2026-09-16.md) 재현 모듈의 단위 테스트.
//
// **이 모듈은 출하 축이 아니다** — 명중률로 반동·ADS 변경을 분리하려던 시도가 실측
// 반증됐다(너프당한 LMG가 대조군보다 덜 떨어짐, 봇 비율 변화가 유력한 교란원).
// `pubg-delta.ts`의 판정(MatchStatus)에는 절대 연결하지 않는다 — 방법론 페이지에
// "시도했고 버린 축"으로만 노출한다(PLAN-pubg-normalization-2026-09-17.md ST-4).
import { describe, expect, it } from "vitest";
import { accuracyByWeapon, type PubgAccuracyInput } from "../pubg-accuracy";

function input(over: Partial<PubgAccuracyInput> = {}): PubgAccuracyInput {
  return {
    weaponAttacks: {},
    weaponDamageHits: {},
    ...over,
  };
}

describe("accuracyByWeapon", () => {
  it("명중률 = damageHits ÷ attacks, 정준키로 결합한다", () => {
    const rows = accuracyByWeapon([
      input({ weaponAttacks: { Item_Weapon_AK47_C: 100 }, weaponDamageHits: { WeapAK47_C: 25 } }),
    ]);
    const ak = rows.find((r) => r.weaponKey === "Item_Weapon_AK47_C");
    expect(ak?.attacks).toBe(100);
    expect(ak?.hits).toBe(25);
    expect(ak?.accuracy).toBeCloseTo(0.25, 6);
  });

  it("네임스페이스 불일치 예외(WeapDuncansHK416_C 등)도 베이스로 정확히 결합된다", () => {
    const rows = accuracyByWeapon([
      input({
        weaponAttacks: { Item_Weapon_HK416_C: 50, Item_Weapon_Duncans_M416_C: 50 },
        weaponDamageHits: { WeapHK416_C: 10, WeapDuncansHK416_C: 10 },
      }),
    ]);
    const hk = rows.find((r) => r.weaponKey === "Item_Weapon_HK416_C");
    expect(hk?.attacks).toBe(100);
    expect(hk?.hits).toBe(20);
  });

  it("여러 매치의 attacks·hits를 누적한다", () => {
    const rows = accuracyByWeapon([
      input({ weaponAttacks: { Item_Weapon_RPD_C: 100 }, weaponDamageHits: { WeapRPD_C: 10 } }),
      input({ weaponAttacks: { Item_Weapon_RPD_C: 200 }, weaponDamageHits: { WeapRPD_C: 20 } }),
    ]);
    const rpd = rows.find((r) => r.weaponKey === "Item_Weapon_RPD_C");
    expect(rpd?.attacks).toBe(300);
    expect(rpd?.hits).toBe(30);
  });

  it("비무기(투척물·장비·근접) 키는 결과에 섞이지 않는다 — ST-3, 텔레메트리 리듀서의 Weap* 필터 누락 보완", () => {
    const rows = accuracyByWeapon([
      input({
        weaponAttacks: { Item_Weapon_AK47_C: 10, Item_Weapon_Grenade_C: 5, Item_Weapon_Mortar_C: 3 },
        weaponDamageHits: { WeapAK47_C: 2 },
      }),
    ]);
    expect(rows.map((r) => r.weaponKey)).toEqual(["Item_Weapon_AK47_C"]);
  });

  it("attacks가 0이면 accuracy 0, 신뢰구간도 [0,0]", () => {
    const rows = accuracyByWeapon([input({ weaponDamageHits: { WeapAK47_C: 5 } })]);
    const ak = rows.find((r) => r.weaponKey === "Item_Weapon_AK47_C");
    expect(ak?.attacks).toBe(0);
    expect(ak?.accuracy).toBe(0);
    expect(ak?.accuracyCi).toEqual([0, 0]);
  });

  it("빈 입력에서도 무너지지 않는다", () => {
    expect(accuracyByWeapon([])).toEqual([]);
  });
});
