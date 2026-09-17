// src/pipeline/aggregate/pubg-weapon-key.ts
// PUBG 무기 키 정규화 — 순수 함수만(파일 I/O 금지). `Item_Weapon_*`(pickup·attacks)와
// `Weap*`(damageHits·kills) 두 네임스페이스를 단일 정준키로 결합한다.
//
// **왜 필요한가**: `pubg-weapons.ts`가 미이행으로 남겨뒀던 지점(PLAN-pubg-gate-2026-09-16
// §6-6) — attacks∩damageHits가 규칙 하나로는 0이라, §8의 명중률 반증표가 커밋 코드로
// 재현되지 않았다. `PLAN-pubg-normalization-2026-09-17.md §3`이 data/raw/pubg/
// telemetry-reduced 전량(7,217건, gitignore라 여기서 다시 읽지 않는다)을 스캔해 확정한
// 결과가 아래 예외 테이블이다: 규칙 `Item_Weapon_{X}_C` → `Weap{X}_C`는 50/77·시행수
// 커버리지 95.26%로 대부분 맞고, damageHits 쪽 orphan 12개만 진짜 예외다.
//
// **왜 throw인가**: 프로젝트 TS 규칙(미구현은 throw, 조용히 빈 값 반환 금지) + 이 파일이
// 대체하는 구 주석의 경고 그대로다 — "분자·분모가 서로 다른 무기를 가리키고, 그 사실이
// 조용히 숨는다"가 이 모듈이 막으려는 실패 모드다. 두 네임스페이스 밖의 키(플레이어명·
// 차량·투사체 이펙트 등)나 분류표에 없는 베이스명은 기본값으로 떨어뜨리지 않고 예외를
// 던져 호출부가 즉시 알게 한다.

export type WeaponKind = "firearm" | "melee" | "throwable" | "equipment";

/**
 * `Weap*` 네임스페이스에서 규칙(`Weap{X}_C` → `Item_Weapon_{X}_C`)이 실패하는 12건.
 * 전량 damageHits 쪽 orphan 키였다(PLAN §3) — 대소문자·축약·접미 숫자·스킨 내부명·
 * 근접무기 투척 판정(Projectile) 변종이 섞여 있어 규칙 하나로 못 잡는다.
 */
const WEAP_NAMESPACE_EXCEPTIONS: Readonly<Record<string, string>> = {
  WeapFamasG2_C: "FAMASG2",
  WeapWin94_C: "Win1894",
  WeapPanzerFaust100M1_C: "PanzerFaust100M",
  WeapCrossbow_1_C: "Crossbow",
  WeapDuncansHK416_C: "HK416",
  WeapJuliesKar98k_C: "Kar98k",
  WeapLunchmeatsAK47_C: "AK47",
  WeapPanProjectile_C: "Pan",
  WeapMacheteProjectile_C: "Machete",
  WeapCowbarProjectile_C: "Cowbar",
  WeapSickleProjectile_C: "Sickle",
  WeapPickaxeProjectile_C: "Pickaxe",
};

/**
 * `Item_Weapon_*` 네임스페이스의 스킨 변종 → 베이스 무기. 스킨은 판정·집계에서
 * 별도 항목이 아니라 베이스 무기의 픽업일 뿐이다(N-1 결함 수정 — 접히지 않으면
 * `Julies_Kar98k`처럼 내부명이 그대로 화면에 노출된다).
 */
const SKIN_VARIANT_BASE: Readonly<Record<string, string>> = {
  Duncans_M416: "HK416",
  Julies_Kar98k: "Kar98k",
  Lunchmeats_AK47: "AK47",
};

/** `Item_Weapon_X_C` / `WeapX_C` 양쪽에서 접두·접미를 벗기고 베이스명을 얻는다. */
function extractBase(key: string): string {
  const exception = WEAP_NAMESPACE_EXCEPTIONS[key];
  if (exception) return exception;

  let base: string;
  if (key.startsWith("Item_Weapon_") && key.endsWith("_C")) {
    base = key.slice("Item_Weapon_".length, -2);
  } else if (key.startsWith("Weap") && key.endsWith("_C")) {
    base = key.slice("Weap".length, -2);
  } else {
    throw new Error(
      `TODO(pubg-weapon-key): "${key}"는 Item_Weapon_*/Weap* 네임스페이스 밖이다 — ` +
        `무기 텔레메트리가 아닐 수 있다(플레이어·차량·이펙트 액터). 새 무기 키라면 예외표에 추가한다.`
    );
  }
  return SKIN_VARIANT_BASE[base] ?? base;
}

/** 두 네임스페이스를 `Item_Weapon_{베이스}_C` 정준키 하나로 결합한다. */
export function canonicalWeaponKey(key: string): string {
  return `Item_Weapon_${extractBase(key)}_C`;
}

const MELEE_BASES: ReadonlySet<string> = new Set(["Pan", "Machete", "Cowbar", "Sickle", "Pickaxe"]);

const THROWABLE_BASES: ReadonlySet<string> = new Set([
  "Grenade",
  "Molotov",
  "FlashBang",
  "SmokeBomb",
  "StickyGrenade",
  "BluezoneGrenade",
  "Snowball",
  "Rock",
]);

/**
 * N-2 결함의 근거 — 이 7개가 기존 `NON_FIREARM` 정규식(근접·투척만 잡음)을 빠져나가
 * "무기 획득 점유율" 분모에 섞여 있었다. `Mortar`는 실제로 미공지 판정 5건 중 1건으로
 * 화면에 올라가 있었다(PLAN §3 N-3). 나머지(`PackageFlare*`·`CoverStructDropHandFlare`·
 * `CamoNet_Taego`·`C4`·`Apple`·`Juju`)는 attacks에만 나타나는 비무기 이벤트 액터다 —
 * pickup 분모엔 안 섞이지만 §8 명중률 재현(ST-4)에서 firearm과 합산되면 같은 문제가
 * 재발하므로 여기서 함께 막는다.
 */
const EQUIPMENT_BASES: ReadonlySet<string> = new Set([
  "IntegratedRepair",
  "TraumaBag",
  "TacPack",
  "Mortar",
  "StunGun",
  "Ziplinegun",
  "FlareGun",
  "PackageFlare",
  "PackageFlare_nonDest",
  "PackageFlare_summerland",
  "CoverStructDropHandFlare",
  "CamoNet_Taego",
  "C4",
  "Apple",
  "Juju",
]);

/**
 * 실사격 무기 51종(PLAN §3 실측, pickup∪attacks 전량에서 근접·투척·장비를 뺀 나머지).
 * 화이트리스트인 이유 — 블랙리스트(`NON_FIREARM` 정규식)가 이미 한 번 장비류 7종을
 * 놓쳐 N-2를 냈다. 다음 패치에서 새 무기·새 비무기 아이템이 추가되면 둘 다 여기
 * 없는 베이스로 떨어져 **throw**한다 — 조용히 firearm으로 기본 분류되는 쪽보다
 * 안전하다(분류 담당자가 즉시 카테고리를 추가하게 만든다).
 */
const FIREARM_BASES: ReadonlySet<string> = new Set([
  "ACE32",
  "AK47",
  "AUG",
  "AWM",
  "Berreta686",
  "BerylM762",
  "Crossbow",
  "DP12",
  "DesertEagle",
  "Dragunov",
  "FAMASG2",
  "FNFal",
  "G18",
  "G36C",
  "Groza",
  "HK416",
  "JS9",
  "K2",
  "Kar98k",
  "L6",
  "M16A4",
  "M1911",
  "M249",
  "M24",
  "M79",
  "M9",
  "MG3",
  "MP5K",
  "MP9",
  "Mini14",
  "Mk12",
  "Mk14",
  "Mk47Mutant",
  "NagantM1895",
  "OriginS12",
  "P90",
  "PanzerFaust100M",
  "QBZ95",
  "RPD",
  "SCAR-L",
  "SKS",
  "Saiga12",
  "Sawnoff",
  "Thompson",
  "UMP",
  "UZI",
  "VSS",
  "Vector",
  "Win1894",
  "Winchester",
  "vz61Skorpion",
]);

/** 정준화 가능한 아무 키(원시 `Item_Weapon_*`/`Weap*` 또는 이미 정준화된 키)를 분류한다. */
export function weaponKind(key: string): WeaponKind {
  const base = extractBase(key);
  if (MELEE_BASES.has(base)) return "melee";
  if (THROWABLE_BASES.has(base)) return "throwable";
  if (EQUIPMENT_BASES.has(base)) return "equipment";
  if (FIREARM_BASES.has(base)) return "firearm";
  throw new Error(
    `TODO(pubg-weapon-key): 베이스 "${base}"(원시 키 "${key}")가 어느 분류표에도 없다 — ` +
      `MELEE_BASES/THROWABLE_BASES/EQUIPMENT_BASES/FIREARM_BASES 중 하나에 추가한다.`
  );
}

/**
 * 총기 세부 분류 — 승인 아티팩트 §4의 `.detail-eyebrow`가 "무기 · **돌격소총**"처럼 세부
 * 카테고리를 쓰기 때문에 필요하다. `weaponKind`의 4종(firearm/melee/throwable/equipment)은
 * 판정 파이프라인용 구분이라 이 자리에 쓰면 전부 "총기"가 된다.
 *
 * **텔레메트리에 없는 정보다** — PUBG API는 무기 카테고리를 주지 않으므로 이 표는 수기다.
 * 그래서 두 가지를 지킨다: ① 모르는 베이스는 표에 넣지 않는다(빈칸으로 두고 상위 분류로
 * 폴백) ② 여기 없는 무기가 생겨도 화면이 죽지 않는다. 지어낸 분류를 넣느니 "총기"가 낫다.
 * (맵 한국어명 `PUBG_MAPS`와 같은 성격의 수기 표다.)
 */
const FIREARM_CATEGORY: Readonly<Record<string, string>> = {
  // 돌격소총
  AK47: "돌격소총", ACE32: "돌격소총", HK416: "돌격소총", BerylM762: "돌격소총",
  AUG: "돌격소총", M16A4: "돌격소총", "SCAR-L": "돌격소총", G36C: "돌격소총",
  QBZ95: "돌격소총", Groza: "돌격소총", K2: "돌격소총", FAMASG2: "돌격소총",
  Mk47Mutant: "돌격소총",
  // 지정사수소총
  SKS: "지정사수소총", Mini14: "지정사수소총", Mk12: "지정사수소총", SLR: "지정사수소총",
  QBU88: "지정사수소총", VSS: "지정사수소총", Mk14: "지정사수소총", Dragunov: "지정사수소총",
  FNFal: "지정사수소총",
  // 저격총
  Kar98k: "저격총", M24: "저격총", AWM: "저격총", Mosin: "저격총", Win1894: "저격총",
  // 기관단총
  UMP: "기관단총", UZI: "기관단총", Vector: "기관단총", MP5K: "기관단총", Thompson: "기관단총",
  BizonPP19: "기관단총", P90: "기관단총", JS9: "기관단총", vz61Skorpion: "기관단총",
  MP9: "기관단총",
  // 경기관총
  RPD: "경기관총", M249: "경기관총", MG3: "경기관총", DP28: "경기관총", L6: "경기관총",
  // 산탄총
  S12K: "산탄총", Saiga12: "산탄총", DP12: "산탄총", Berreta686: "산탄총",
  Sawnoff: "산탄총", OriginS12: "산탄총", Winchester: "산탄총",
  // 권총
  P18C: "권총", G18: "권총", M9: "권총", DesertEagle: "권총", NagantM1895: "권총", P1911: "권총",
  R1895: "권총", R45: "권총", Skorpion: "권총",
  // 특수
  Crossbow: "석궁", PanzerFaust100M: "발사기", M79: "발사기", Mortar: "발사기",
};

/**
 * 화면 표기용 무기 분류 — 총기는 세부 카테고리, 나머지는 상위 분류.
 * 표에 없는 총기는 "총기"로 폴백한다(분류를 지어내지 않는다).
 */
export function weaponCategoryLabel(key: string): string {
  const kind = weaponKind(key);
  if (kind !== "firearm") {
    return kind === "melee" ? "근접" : kind === "throwable" ? "투척" : "장비";
  }
  return FIREARM_CATEGORY[extractBase(key)] ?? "총기";
}
