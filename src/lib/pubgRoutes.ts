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

/** `Item_Weapon_BerylM762_C` → `berylm762`. 소문자 + 비영숫자 제거로 URL 안전을 보장한다. */
export function weaponSlug(weaponKey: string): string {
  return weaponKey
    .replace(/^Item_Weapon_/, "")
    .replace(/_C$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** `Baltic_Main` → `baltic`. */
export function mapSlug(mapKey: string): string {
  return mapKey
    .replace(/_Main$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
