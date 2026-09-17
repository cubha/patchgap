// src/pipeline/pubg/asset-path.ts
// PUBG 공식 자산(pubg/api-assets) 경로 규칙 — 순수 함수만. 다운로드는 scripts/run-pubg-assets.ts,
// 소비는 src/components/pubg/*.
//
// **런타임 외부 호출 0 원칙**: 이 모듈이 만드는 원격 URL은 **빌드 이전 스크립트에서만** 쓰인다.
// 브라우저가 보는 것은 `publicWeaponPath`/`publicMapPath`가 가리키는 `public/pubg/` 로컬 경로뿐이다
// (`public/dd/`가 Data Dragon에 대해 하는 것과 같은 구조).
//
// **왜 두 함수로 갈리는가**: 무기는 텔레메트리 키가 곧 파일명인데, **맵은 아니다** —
// `Baltic_Main_No_Text_Low_Res.png`는 404이고 `Erangel_Main_No_Text_Low_Res.png`가 200이다
// (2026-09-17 실측). 맵은 반드시 `PUBG_MAPS`의 `assetName`을 경유한다.

const ASSET_BASE = "https://raw.githubusercontent.com/pubg/api-assets/master";

/** 무기 렌더 원격 URL — `weaponKey`는 정준키(`Item_Weapon_AK47_C`)여야 한다. */
export function remoteWeaponUrl(weaponKey: string): string {
  return `${ASSET_BASE}/Assets/Item/Weapon/Main/${weaponKey}.png`;
}

/** 맵 지형도 원격 URL — `assetName`은 공식 표시명(`Erangel`)이다(텔레메트리 키 아님). */
export function remoteMapUrl(assetName: string): string {
  return `${ASSET_BASE}/Assets/Maps/${assetName}_Main_No_Text_Low_Res.png`;
}

/** 브라우저가 실제로 요청하는 로컬 경로. */
export function publicWeaponPath(weaponKey: string): string {
  return `/pubg/weapon/${weaponKey}.png`;
}

export function publicMapPath(assetName: string): string {
  return `/pubg/map/${assetName}.png`;
}

/**
 * 조달 결과 매니페스트 — `scripts/run-pubg-assets.ts`가 쓰고 화면이 읽는다.
 *
 * **왜 매니페스트가 필요한가**: api-assets에 없는 무기가 실제로 있다(구형·이벤트 무기).
 * 그 경우 화면은 **설계된 폴백 상태**를 그려야 하고, 깨진 `<img>`는 상태가 아니다
 * (시안 §4의 `.detail-splash`에는 null 케이스가 정의돼 있지 않아 여기서 보충한다).
 * 서버 컴포넌트가 빌드 타임에 이 파일을 읽어 폴백 여부를 **미리** 결정하므로,
 * 클라이언트 `onError` 핸들러가 필요 없다.
 */
export interface PubgAssetManifest {
  generatedAt: string;
  source: string;
  /** 조달에 성공한 무기 정준키. */
  weapons: string[];
  /** 조달에 성공한 맵 표시명(`Erangel`). */
  maps: string[];
  /** 원격에 없어서 조달하지 못한 항목 — 숨기지 않고 기록한다. */
  missing: { kind: "weapon" | "map"; key: string; status: number }[];
}
