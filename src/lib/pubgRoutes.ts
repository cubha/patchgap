// src/lib/pubgRoutes.ts
// PUBG 상세 라우트 슬러그 — 정준키 ↔ URL 세그먼트. 순수 함수만.
//
// **왜 키를 URL에 그대로 쓰지 않는가**: `Item_Weapon_BerylM762_C`가 주소창에 그대로 보이면
// 내부 식별자가 UI가 된다. 반대로 한국어 이름을 쓰면 퍼센트 인코딩이 끼는데, 이 저장소는
// 이미 그 길에서 한 번 데였다 — `/item/[id]`가 퍼센트 인코딩 슬러그를 쓰다가 정적 서버에서
// 전부 404가 났고(2026-09-05 실측) 문자 치환 방식으로 갈아엎었다. 그래서 여기서도 **ASCII
// 안전 문자만** 남긴다.
//
// 역변환은 **파싱하지 않고 조회**로 한다(`weaponKeyFromSlug`) — 슬러그→키 규칙을 두 번 쓰면
// 한쪽이 조용히 어긋난다. 후보 목록은 항상 집계 산출물이 준다.
import { mapIdentity } from "@/pipeline/aggregate/pubg-maps";
import { weaponDisplayName } from "@/pipeline/aggregate/pubg-weapons";

/** 내부명 → URL 안전 문자(소문자 영숫자). */
function urlSafe(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * `Item_Weapon_HK416_C` → `m416`. 슬러그는 **화면 이름**이다(트랙 B ST-2, 2026-10-11 site-review pubg-S18) — 전에는 내부
 * 코드명(`hk416`·`saiga12`·`g18`)이라 공유된 주소만 보고 어떤 화면인지 알 수 없었다. 구 주소는 `vercel.json`이 넘긴다.
 */
export function weaponSlug(weaponKey: string): string {
  return urlSafe(weaponDisplayName(weaponKey));
}

/** `Baltic_Main` → `erangel`. 등록되지 않은 맵은 예전 규칙으로 떨어진다(이름을 짓지 않는다). */
export function mapSlug(mapKey: string): string {
  return mapIdentity(mapKey).slug || legacyMapSlug(mapKey);
}

/** 2026-10-11 이전 규칙 — 접두·접미를 벗긴 내부명. 리다이렉트 원천을 만들 때만 쓴다. */
export function legacyWeaponSlug(weaponKey: string): string {
  return urlSafe(weaponKey.replace(/^Item_Weapon_/, "").replace(/_C$/, ""));
}

export function legacyMapSlug(mapKey: string): string {
  return urlSafe(mapKey.replace(/_Main$/, ""));
}

/**
 * 슬러그가 바뀐 키의 구 주소 → 새 주소. `vercel.json` `redirects`가 이 목록을 담는다(테스트가 대조). 정적 export라 Next
 * 런타임 리다이렉트가 없고, 목적지가 쌍에 따라 바뀌지 않는 유한한 정적 매핑이라 서버 리다이렉트(영구)가 맞다.
 */
export function pubgLegacyRedirects(weaponKeys: readonly string[], mapKeys: readonly string[]): { source: string; destination: string }[] {
  // 구 주소가 **다른 대상의 새 주소**와 같으면 넘기지 않는다 — Vercel 리다이렉트는 정적 파일보다 먼저 적용돼 그 화면을 가린다
  // (실측: 구 맵 `Erangel_Main`의 예전 슬러그 「erangel」 = `Baltic_Main`의 새 슬러그).
  const live = new Set([...weaponKeys.map((k) => `/pubg/weapon/${weaponSlug(k)}`), ...mapKeys.map((k) => `/pubg/map/${mapSlug(k)}`)]);
  const out: { source: string; destination: string }[] = [];
  for (const key of weaponKeys) {
    const from = legacyWeaponSlug(key);
    if (from !== weaponSlug(key)) out.push({ source: `/pubg/weapon/${from}`, destination: weaponHref(key) });
  }
  for (const key of mapKeys) {
    const from = legacyMapSlug(key);
    if (from !== mapSlug(key)) out.push({ source: `/pubg/map/${from}`, destination: mapHref(key) });
  }
  return out.filter((r) => !live.has(r.source));
}

export function weaponHref(weaponKey: string): string {
  return `/pubg/weapon/${weaponSlug(weaponKey)}/`;
}

export function mapHref(mapKey: string): string {
  return `/pubg/map/${mapSlug(mapKey)}/`;
}

/**
 * 슬러그 → 정준키. 후보 중 **첫 일치**를 돌려주고 없으면 null이다(추측 금지).
 * 슬러그 충돌이 생기면 첫 후보가 이기는데, 그건 실제로는 발생하지 않는다 —
 * 정준키는 이미 스킨 변종을 접은 뒤라 베이스명이 유일하다.
 */
export function weaponKeyFromSlug(slug: string, candidates: readonly string[]): string | null {
  return candidates.find((key) => weaponSlug(key) === slug) ?? null;
}

export function mapKeyFromSlug(slug: string, candidates: readonly string[]): string | null {
  return candidates.find((key) => mapSlug(key) === slug) ?? null;
}

