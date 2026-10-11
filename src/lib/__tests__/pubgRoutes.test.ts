// src/lib/__tests__/pubgRoutes.test.ts
// 슬러그 왕복 검증. `/item/[id]`가 퍼센트 인코딩 슬러그로 정적 배포에서 전부 404가 났던
// 선례(2026-09-05)가 있어, 여기서 지키는 핵심 불변식은 **슬러그에 ASCII 안전 문자만 남는다**다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  legacyMapSlug,
  legacyWeaponSlug,
  mapHref,
  mapKeyFromSlug,
  mapSlug,
  pubgLegacyRedirects,
  weaponHref,
  weaponKeyFromSlug,
  weaponSlug,
} from "../pubgRoutes";
import { PUBG_MAPS } from "@/pipeline/aggregate/pubg-maps";
import { WEAPON_NAME_OVERRIDE_KEYS } from "@/pipeline/aggregate/pubg-weapons";

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

// 2026-10-11 명세 변경(트랙 B ST-2, pubg-S18): 슬러그는 내부 코드명이 아니라 **화면 이름**이다 — 공유된 주소만 보고 어느
// 화면인지 알 수 있어야 한다(에란겔 = `/map/baltic/`이 리뷰 지적). 구 코드명 주소는 `vercel.json`이 새 주소로 넘긴다(아래).
describe("weaponSlug — 표시 이름 기준", () => {
  it("내부명과 통용명이 다른 무기는 통용명으로", () => {
    expect(weaponSlug("Item_Weapon_HK416_C")).toBe("m416");
    expect(weaponSlug("Item_Weapon_Saiga12_C")).toBe("s12k");
    expect(weaponSlug("Item_Weapon_G18_C")).toBe("p18c");
    expect(weaponSlug("Item_Weapon_vz61Skorpion_C")).toBe("skorpion");
    expect(weaponSlug("Item_Weapon_FNFal_C")).toBe("slr");
  });
});

describe("mapSlug / mapKeyFromSlug", () => {
  it("맵 슬러그는 화면 이름(영문 공식명)이다", () => {
    expect(mapSlug("Baltic_Main")).toBe("erangel");
    expect(mapSlug("Desert_Main")).toBe("miramar");
    expect(mapSlug("Savage_Main")).toBe("sanhok");
    expect(mapSlug("DihorOtok_Main")).toBe("vikendi");
  });

  it("등록된 맵 전부 슬러그가 유일하다(에란겔 신·구 키가 같은 이름을 쓰는 충돌 포함)", () => {
    const slugs = Object.keys(PUBG_MAPS).map(mapSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+$/);
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
    expect(mapHref("Baltic_Main")).toBe("/pubg/map/erangel/");
  });
});

describe("구 코드명 주소 보존 — vercel.json 리다이렉트", () => {
  // 디스코드 브리핑(`pipeline/discord/pubg-briefing.ts`)이 무기 상세 링크를 이미 내보냈다(2026-09-20 발송 기록). 어떤 무기가
  // 나갔는지는 페이로드가 저장되지 않아 알 수 없으므로 **슬러그가 바뀐 알려진 키 전부**를 넘긴다.
  const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../vercel.json"), "utf8")) as {
    redirects: { source: string; destination: string; permanent: boolean }[];
  };
  const expected = () => pubgLegacyRedirects([...WEAPON_NAME_OVERRIDE_KEYS], Object.keys(PUBG_MAPS));

  it("슬러그가 바뀐 키가 있다(가드가 공회전하지 않는다)", () => {
    expect(expected().length).toBeGreaterThanOrEqual(10);
  });

  // 영구(301)가 아니다 — `legacy-redirects.test.ts`의 기존 규약(브라우저 영구 캐시로 되돌릴 여지를 잃지 않는다).
  it("바뀐 키마다 슬래시 유무 두 형태가 새 주소로 이동한다", () => {
    for (const r of expected()) {
      for (const source of [r.source, `${r.source}/`]) {
        expect(vercel.redirects).toContainEqual({ source, destination: r.destination, permanent: false });
      }
    }
  });

  it("구 슬러그 = 예전 규칙(접두·접미를 벗긴 내부명)", () => {
    expect(legacyWeaponSlug("Item_Weapon_HK416_C")).toBe("hk416");
    expect(legacyMapSlug("Baltic_Main")).toBe("baltic");
    expect(expected()).toContainEqual({ source: "/pubg/weapon/hk416", destination: "/pubg/weapon/m416/" });
    expect(expected()).toContainEqual({ source: "/pubg/map/baltic", destination: "/pubg/map/erangel/" });
  });

  it("구 주소가 다른 대상의 새 주소와 겹치면 리다이렉트하지 않는다 — Vercel 리다이렉트는 정적 파일보다 먼저라 그 화면을 가린다", () => {
    // 실측(구현 중): 구 맵 `Erangel_Main`의 예전 슬러그 「erangel」 = 에란겔(`Baltic_Main`)의 새 슬러그.
    const live = new Set([
      ...Object.keys(PUBG_MAPS).map((k) => `/pubg/map/${mapSlug(k)}`),
      ...WEAPON_NAME_OVERRIDE_KEYS.map((k) => `/pubg/weapon/${weaponSlug(k)}`),
    ]);
    for (const r of expected()) expect(live.has(r.source)).toBe(false);
    for (const r of vercel.redirects) expect(live.has(r.source.replace(/\/$/, ""))).toBe(false);
  });

  it("슬러그가 같은 키는 리다이렉트를 만들지 않는다(자기 자신으로 도는 고리 방지)", () => {
    for (const r of expected()) expect(r.source + "/").not.toBe(r.destination);
  });
});
