// src/pipeline/aggregate/pubg-weapons.ts
// PUBG 무기 집계 — 순수 함수만(파일 I/O 금지, 디렉토리 규칙). 입력은 텔레메트리
// reduce-on-ingest 산출물(PubgReducedMatch[]), 출력은 PubgPatchAggregate.
//
// **왜 픽업 점유율인가**: 43.1 밸런스 11개 항목이 전부 무기 단위인데, 매치 객체에는 무기
// 정보가 0이다(2026-09-16 게이트 판정, docs/plan/PLAN-pubg-gate-2026-09-16.md §3). 그중
// 텔레메트리로 실제 분리되는 축은 스폰율(#10 RPD·M249 -30%) 하나뿐이었다 — 명중률로 반동
// 변경을 잡으려던 시도는 대조군이 더 크게 움직여 반증됐다(§8). 그래서 이 파일은 픽업
// 점유율 한 축만 산출한다.
//
// **점유율(share)을 쓰는 이유**: 매치당 원시 픽업 수는 패치 사이에 -15.9% 함께 내려갔다
// (평균 인원 98.9→94.9 · 봇 31.6%→27.5% · 매치 길이 1,832→1,761초). 기저 이동을 빼지 않으면
// 모든 무기가 너프된 것처럼 보인다 — 총 픽업 대비 점유율로 정규화해 기저를 분리한다.
import type { Interval } from "../types";

/** 텔레메트리 리듀서(docs/plan/provenance/2026-09-16-pubg-harvest/telemetry.py) 산출 1건. */
export interface PubgReducedMatch {
  matchId: string;
  createdAt: string | null;
  map: string | null;
  gameMode: string | null;
  duration: number | null;
  /** `LogMatchDefinition.MatchId`에서 뽑은 패치 라벨(`pc-2018-42` 등). 없으면 null. */
  patch: string | null;
  /**
   * 매치 종류. `/samples`는 `official` 외에 `airoyale`·`competitive`·`tutorialatoz`·
   * `trainingroom`을 함께 돌려주며 실측 표본의 약 절반이 비경쟁 매치였다 — 집계는 반드시
   * `official`만 쓴다(PLAN §6-1).
   */
  matchType: string | null;
  region: string | null;
  nBots: number;
  nHumans: number;
  weaponPickup: Record<string, number>;
  weaponKills: Record<string, number>;
  weaponDamageHits: Record<string, number>;
  weaponAttacks: Record<string, number>;
}

/** 한 패치 구간의 무기 1종 집계. */
export interface PubgWeaponStat {
  /** 텔레메트리 itemId 그대로(`Item_Weapon_RPD_C`). */
  weaponKey: string;
  /** 화면 표기명(`RPD`). */
  weaponName: string;
  pickups: number;
  /** 총 무기 픽업 대비 점유율. */
  share: number;
  shareCi: Interval;
}

/** 한 패치 구간 전체. */
export interface PubgPatchAggregate {
  patch: string;
  label: string;
  nMatches: number;
  nBots: number;
  nHumans: number;
  totalPickups: number;
  /** 매치당 평균 픽업 — 기저 이동을 화면에 드러내기 위한 값. */
  pickupsPerMatch: number;
  botShare: number;
  weapons: PubgWeaponStat[];
}

/**
 * 표기명 — 텔레메트리 itemId는 `Item_Weapon_{NAME}_C` 꼴이라 규칙만으로 대부분 벗겨진다.
 * 규칙으로 안 되는 것(내부명 ≠ 통용명)만 예외로 적는다. 자산 아이콘은 이 키로 찾는다.
 */
const WEAPON_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  Item_Weapon_DP28_C: "DP-28",
  Item_Weapon_HK416_C: "M416",
  Item_Weapon_Saiga12_C: "S12K",
  Item_Weapon_BerylM762_C: "Beryl M762",
  Item_Weapon_G18_C: "P18C",
  Item_Weapon_vz61Skorpion_C: "Skorpion",
  Item_Weapon_Mk47Mutant_C: "Mk47 Mutant",
  Item_Weapon_FNFal_C: "SLR",
};

export function weaponDisplayName(weaponKey: string): string {
  const override = WEAPON_NAME_OVERRIDES[weaponKey];
  if (override) return override;
  return weaponKey.replace(/^Item_Weapon_/, "").replace(/_C$/, "");
}

/** 근접무기·투척물처럼 "스폰율 밸런스" 논의 대상이 아닌 항목은 점유율 분모에서 뺀다. */
const NON_FIREARM =
  /Pan|Machete|Crowbar|Cowbar|Sickle|Pickaxe|Grenade|Molotov|SmokeBomb|FlashBang|C4|Melee/i;

export function isFirearm(weaponKey: string): boolean {
  return !NON_FIREARM.test(weaponKey);
}

/**
 * 집계 대상 매치인지 판정한다. 세 조건을 모두 만족해야 한다:
 * `official` 매치 · 패치 라벨이 기대값과 일치 · `createdAt` 날짜가 허용 목록 안.
 *
 * 날짜를 따로 거르는 이유는 **요일 교락**이다(PLAN §6-2). 42.3 구간은 9/3(수)~9/8(월),
 * 43.1 구간은 9/11(목)~9/16(화)까지 받을 수 있는데 요일 구성이 다르면 주말 비중 차이가
 * 패치 효과와 섞인다 — 호출부가 같은 요일 집합(목~월 5일씩)을 넘긴다.
 */
export function selectMatches(
  rows: readonly PubgReducedMatch[],
  expectedPatch: string,
  allowedDates: ReadonlySet<string>
): PubgReducedMatch[] {
  return rows.filter(
    (r) =>
      r.matchType === "official" &&
      r.patch === expectedPatch &&
      typeof r.createdAt === "string" &&
      allowedDates.has(r.createdAt.slice(0, 10))
  );
}

function wilson(successes: number, n: number, z = 1.96): Interval {
  if (n <= 0) return [0, 0];
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** 선택된 매치들을 한 패치 구간 집계로 접는다. */
export function aggregatePubgWeapons(
  matches: readonly PubgReducedMatch[],
  patch: string,
  label: string
): PubgPatchAggregate {
  const pickups = new Map<string, number>();
  let totalPickups = 0;
  let nBots = 0;
  let nHumans = 0;

  for (const m of matches) {
    nBots += m.nBots;
    nHumans += m.nHumans;
    for (const [key, count] of Object.entries(m.weaponPickup)) {
      if (!isFirearm(key)) continue;
      pickups.set(key, (pickups.get(key) ?? 0) + count);
      totalPickups += count;
    }
  }

  const weapons: PubgWeaponStat[] = [...pickups.entries()]
    .map(([weaponKey, count]) => ({
      weaponKey,
      weaponName: weaponDisplayName(weaponKey),
      pickups: count,
      share: totalPickups > 0 ? count / totalPickups : 0,
      shareCi: wilson(count, totalPickups),
    }))
    .sort((a, b) => b.pickups - a.pickups);

  const participants = nBots + nHumans;
  return {
    patch,
    label,
    nMatches: matches.length,
    nBots,
    nHumans,
    totalPickups,
    pickupsPerMatch: matches.length > 0 ? totalPickups / matches.length : 0,
    botShare: participants > 0 ? nBots / participants : 0,
    weapons,
  };
}
