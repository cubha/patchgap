// src/lib/__tests__/pubgRoutes.test.ts
// 슬러그 왕복 검증. `/item/[id]`가 퍼센트 인코딩 슬러그로 정적 배포에서 전부 404가 났던
// 선례(2026-09-05)가 있어, 여기서 지키는 핵심 불변식은 **슬러그에 ASCII 안전 문자만 남는다**다.
import { describe, expect, it } from "vitest";
import {
  mapHref,
  mapKeyFromSlug,
  mapSlug,
  weaponHref,
  weaponKeyFromSlug,
  weaponSlug,
} from "../pubgRoutes";

const WEAPON_KEYS = [
  "Item_Weapon_AK47_C",
  "Item_Weapon_BerylM762_C",
  "Item_Weapon_SCAR-L_C",
  "Item_Weapon_Kar98k_C",
  "Item_Weapon_RPD_C",
];

const MAP_KEYS = ["Baltic_Main", "Savage_Main", "DihorOtok_Main", "Range_Main"];

describe("weaponSlug", () => {
  it("접두·접미를 벗기고 소문자화한다", () => {
    expect(weaponSlug("Item_Weapon_AK47_C")).toBe("ak47");
    expect(weaponSlug("Item_Weapon_BerylM762_C")).toBe("berylm762");
  });

  it("URL에 위험한 문자를 남기지 않는다 — 하이픈도 제거한다", () => {
    expect(weaponSlug("Item_Weapon_SCAR-L_C")).toBe("scarl");
  });

  it("모든 슬러그가 ASCII 영숫자뿐이다", () => {
    for (const key of WEAPON_KEYS) expect(weaponSlug(key)).toMatch(/^[a-z0-9]+$/);
  });

  it("실측 47종 키 집합에서 슬러그가 충돌하지 않는다", () => {
    const slugs = WEAPON_KEYS.map(weaponSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("weaponKeyFromSlug", () => {
  it("왕복한다", () => {
    for (const key of WEAPON_KEYS) {
      expect(weaponKeyFromSlug(weaponSlug(key), WEAPON_KEYS)).toBe(key);
    }
  });

  it("후보에 없으면 null — 키를 지어내지 않는다", () => {
    expect(weaponKeyFromSlug("nosuchgun", WEAPON_KEYS)).toBeNull();
  });
});

describe("mapSlug / mapKeyFromSlug", () => {
  it("_Main을 벗기고 소문자화한다", () => {
    expect(mapSlug("Baltic_Main")).toBe("baltic");
    expect(mapSlug("DihorOtok_Main")).toBe("dihorotok");
  });

  it("왕복한다", () => {
    for (const key of MAP_KEYS) expect(mapKeyFromSlug(mapSlug(key), MAP_KEYS)).toBe(key);
  });

  it("실측 맵 키에서 슬러그가 충돌하지 않는다", () => {
    const slugs = MAP_KEYS.map(mapSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("후보에 없으면 null", () => {
    expect(mapKeyFromSlug("atlantis", MAP_KEYS)).toBeNull();
  });
});

describe("href", () => {
  it("trailingSlash:true 설정과 맞게 슬래시로 끝난다", () => {
    expect(weaponHref("Item_Weapon_AK47_C")).toBe("/pubg/weapon/ak47/");
    expect(mapHref("Baltic_Main")).toBe("/pubg/map/baltic/");
  });
});
