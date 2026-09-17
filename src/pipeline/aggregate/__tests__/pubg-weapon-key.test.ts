// src/pipeline/aggregate/__tests__/pubg-weapon-key.test.ts
// 무기 키 정규화 회귀 테스트 — PLAN-pubg-normalization-2026-09-17.md ST-1.
//
// 여기 박힌 예외 12건은 data/raw/pubg/telemetry-reduced 전량(7,217건, gitignore라
// 테스트에서 직접 읽지 않는다) 스캔으로 확정한 것이다(계획 §3). attacks∩damageHits가
// 원래 0이었던 이유 — 두 네임스페이스(`Item_Weapon_*` / `Weap*`)가 규칙 하나로는
// 50/77만 맞고, 남은 12개(damageHits 쪽 orphan 전량)가 진짜 예외다. 재조사 시
// `node -e` 스캔 스크립트는 PLAN §3에 남겨져 있다.
import { describe, expect, it } from "vitest";
import { canonicalWeaponKey, weaponCategoryLabel, weaponKind } from "../pubg-weapon-key";

describe("canonicalWeaponKey", () => {
  it("Item_Weapon_ 네임스페이스는 그대로 정준키다", () => {
    expect(canonicalWeaponKey("Item_Weapon_AK47_C")).toBe("Item_Weapon_AK47_C");
  });

  it("Weap 네임스페이스는 Item_Weapon_ 정준키로 변환된다(규칙 매칭 50/77)", () => {
    expect(canonicalWeaponKey("WeapAK47_C")).toBe("Item_Weapon_AK47_C");
    expect(canonicalWeaponKey("WeapM249_C")).toBe("Item_Weapon_M249_C");
  });

  it("네임스페이스 불일치 예외 5종을 규칙 대신 테이블로 맞춘다", () => {
    expect(canonicalWeaponKey("WeapFamasG2_C")).toBe("Item_Weapon_FAMASG2_C");
    expect(canonicalWeaponKey("WeapWin94_C")).toBe("Item_Weapon_Win1894_C");
    expect(canonicalWeaponKey("WeapPanzerFaust100M1_C")).toBe("Item_Weapon_PanzerFaust100M_C");
    expect(canonicalWeaponKey("WeapCrossbow_1_C")).toBe("Item_Weapon_Crossbow_C");
    expect(canonicalWeaponKey("WeapDuncansHK416_C")).toBe("Item_Weapon_HK416_C");
  });

  it("스킨 변종은 베이스 무기로 접힌다 — 양쪽 네임스페이스 모두", () => {
    expect(canonicalWeaponKey("Item_Weapon_Duncans_M416_C")).toBe("Item_Weapon_HK416_C");
    expect(canonicalWeaponKey("Item_Weapon_Julies_Kar98k_C")).toBe("Item_Weapon_Kar98k_C");
    expect(canonicalWeaponKey("Item_Weapon_Lunchmeats_AK47_C")).toBe("Item_Weapon_AK47_C");
    expect(canonicalWeaponKey("WeapJuliesKar98k_C")).toBe("Item_Weapon_Kar98k_C");
    expect(canonicalWeaponKey("WeapLunchmeatsAK47_C")).toBe("Item_Weapon_AK47_C");
  });

  it("근접무기 투척 판정(Projectile) Weap 변종도 베이스로 접힌다", () => {
    expect(canonicalWeaponKey("WeapPanProjectile_C")).toBe("Item_Weapon_Pan_C");
    expect(canonicalWeaponKey("WeapMacheteProjectile_C")).toBe("Item_Weapon_Machete_C");
    expect(canonicalWeaponKey("WeapCowbarProjectile_C")).toBe("Item_Weapon_Cowbar_C");
    expect(canonicalWeaponKey("WeapSickleProjectile_C")).toBe("Item_Weapon_Sickle_C");
    expect(canonicalWeaponKey("WeapPickaxeProjectile_C")).toBe("Item_Weapon_Pickaxe_C");
  });

  it("같은 무기는 어느 네임스페이스로 들어와도 같은 정준키에 도달한다(교차 결합 전제)", () => {
    expect(canonicalWeaponKey("Item_Weapon_HK416_C")).toBe(canonicalWeaponKey("WeapDuncansHK416_C"));
    expect(canonicalWeaponKey("Item_Weapon_AK47_C")).toBe(canonicalWeaponKey("WeapLunchmeatsAK47_C"));
  });

  it("두 네임스페이스 어디에도 속하지 않는 키는 throw한다 — 조용히 떨어뜨리지 않는다", () => {
    expect(() => canonicalWeaponKey("PlayerFemale_A_C")).toThrow();
    expect(() => canonicalWeaponKey("BP_CoupeRB_C")).toThrow();
    expect(() => canonicalWeaponKey("ProjGrenade_C")).toThrow();
  });
});

describe("weaponKind", () => {
  it("총기는 firearm이다", () => {
    for (const key of ["Item_Weapon_AK47_C", "Item_Weapon_RPD_C", "Item_Weapon_M249_C", "WeapHK416_C"]) {
      expect(weaponKind(key), key).toBe("firearm");
    }
  });

  it("근접무기는 melee다", () => {
    for (const key of ["Item_Weapon_Pan_C", "Item_Weapon_Machete_C", "Item_Weapon_Pickaxe_C"]) {
      expect(weaponKind(key), key).toBe("melee");
    }
  });

  it("투척물은 throwable이다", () => {
    for (const key of ["Item_Weapon_Grenade_C", "Item_Weapon_Molotov_C", "Item_Weapon_FlashBang_C"]) {
      expect(weaponKind(key), key).toBe("throwable");
    }
  });

  it("장비류는 equipment다 — N-2 결함(비무기가 무기 획득 분모에 포함)의 근거", () => {
    for (const key of [
      "Item_Weapon_IntegratedRepair_C",
      "Item_Weapon_TraumaBag_C",
      "Item_Weapon_TacPack_C",
      "Item_Weapon_Mortar_C",
      "Item_Weapon_StunGun_C",
      "Item_Weapon_Ziplinegun_C",
      "Item_Weapon_FlareGun_C",
    ]) {
      expect(weaponKind(key), key).toBe("equipment");
    }
  });

  it("스킨 변종은 베이스 무기의 kind를 그대로 따른다", () => {
    expect(weaponKind("Item_Weapon_Duncans_M416_C")).toBe("firearm");
  });

  it("정준화할 수 없는 키는 weaponKind도 throw한다", () => {
    expect(() => weaponKind("PlayerFemale_A_C")).toThrow();
  });
});

// ── weaponCategoryLabel (2026-09-18) ──────────────────────────────────────────────
// 승인 아티팩트 §4의 `.detail-eyebrow`가 "무기 · 돌격소총"처럼 세부 분류를 쓴다. 이 표는
// **텔레메트리에 없는 수기 데이터**라, 지키는 불변식은 "모르면 지어내지 않는다"다.
describe("weaponCategoryLabel", () => {
  it("총기는 세부 카테고리로 표기한다", () => {
    expect(weaponCategoryLabel("Item_Weapon_AK47_C")).toBe("돌격소총");
    expect(weaponCategoryLabel("Item_Weapon_Kar98k_C")).toBe("저격총");
    expect(weaponCategoryLabel("Item_Weapon_RPD_C")).toBe("경기관총");
    expect(weaponCategoryLabel("Item_Weapon_UMP_C")).toBe("기관단총");
  });

  it("스킨 변종도 베이스 기준으로 분류된다", () => {
    expect(weaponCategoryLabel("Item_Weapon_Lunchmeats_AK47_C")).toBe("돌격소총");
  });

  it("표에 없는 총기는 '총기'로 폴백한다 — 분류를 지어내지 않는다", () => {
    // M1911은 FIREARM_BASES에는 있으나 카테고리 표에 없는 유일한 베이스(2026-09-18 실측).
    // 이 테스트가 깨지면 표를 채웠거나 베이스가 늘어난 것이니, 폴백 대상을 다시 고른다.
    expect(weaponCategoryLabel("Item_Weapon_M1911_C")).toBe("총기");
  });

  it("실제 표본 47종은 전부 분류된다(수기 표 커버리지 고정)", () => {
    // QBU88·Mosin 등은 이 저장소의 FIREARM_BASES에 없어 weaponKind 자체가 throw한다 —
    // 카테고리 표에는 있지만 그건 **미래 대비**이지 현재 커버리지가 아니다. 여기서 고정하는
    // 것은 "실제 표본에 등장하는 키"의 커버리지다.
    expect(weaponCategoryLabel("Item_Weapon_G18_C")).toBe("권총");
    expect(weaponCategoryLabel("Item_Weapon_DP12_C")).toBe("산탄총");
    expect(weaponCategoryLabel("Item_Weapon_L6_C")).toBe("경기관총");
  });

  it("총기가 아니면 상위 분류를 쓴다", () => {
    expect(weaponCategoryLabel("Item_Weapon_Pan_C")).toBe("근접");
    expect(weaponCategoryLabel("Item_Weapon_Grenade_C")).toBe("투척");
  });
});
