// src/pipeline/aggregate/pubg-maps.ts
// PUBG 맵 집계 — 순수 함수만(파일 I/O 금지, 디렉토리 규칙). 입력은 무기 집계와 **같은**
// reduce-on-ingest 산출물(PubgReducedMatch[])이고, 출력은 맵 1종당 한 행이다.
//
// **재수집이 0인 이유**: 텔레메트리 리듀서가 이미 `map` 필드를 채워 두었다(실측: official
// 매치 7,217건 전부 non-null). 맵 축을 새로 만들자고 42.3 구간을 다시 받을 필요가 없다 —
// 42.3의 API 보존창은 2026-09-22에 닫히므로 이건 중요한 차이다.
//
// **`Range_Main`(Camp Jackal)이 결과에 없는 이유**: 훈련장은 `matchType`이 official이 아니다.
// `selectMatches`가 official만 남기므로 별도 제외 목록이 필요 없다 — 규칙 하나가 이미 그것을
// 한다(실측: raw 10,556건 중 Range 1,707건이 전부 비-official로 걸러진다).
//
// **무엇을 지표로 삼는가**: 맵에는 43.1 패치노트 항목이 **하나도 없다**(노트 5건 전부 무기
// 스폰·밸런스). 그래서 이 파일은 판정(MatchStatus)을 만들지 않는다 — 짝지을 선언이 없는데
// 판정 어휘를 붙이면 "노트에 없다"가 관측이 아니라 전제가 된다(LoL에서 집계 엔티티를 미공지에서
// 빼낸 것과 같은 이유, PLAN-patchgap.md 계약 확장 이력 2026-09-13 2차). 대신 **기술 통계**만
// 낸다: 매치 점유율(Wilson CI) · 평균 소요 · 봇 비율 · 매치당 픽업, 그리고 그 맵 안에서의
// 무기 점유율 상위.
import type { Interval } from "../types";
import {
  isFirearm,
  weaponDisplayName,
  wilson,
  type PubgReducedMatch,
} from "./pubg-weapons";
import { canonicalWeaponKey } from "./pubg-weapon-key";

/** 맵 안에서의 무기 점유율 1행 — 상세 화면의 "이 맵에서 많이 줍는 총" 표에 쓴다. */
export interface PubgMapWeaponShare {
  weaponKey: string;
  weaponName: string;
  pickups: number;
  /** 이 맵의 총 무기 픽업 대비 점유율. */
  share: number;
}

/** 한 패치 구간의 맵 1종 집계. */
export interface PubgMapStat {
  /** 텔레메트리 `mapName` 그대로(`Baltic_Main`). 라우트 파라미터의 원천이기도 하다. */
  mapKey: string;
  nMatches: number;
  /** 그 구간 official 매치 전체 대비 이 맵의 비중. */
  matchShare: number;
  matchShareCi: Interval;
  /** 평균 매치 소요(초). duration이 null인 매치는 분모에서도 빠진다. */
  avgDurationSec: number | null;
  botShare: number;
  pickupsPerMatch: number;
  /** 이 맵 안 무기 점유율 내림차순. */
  topWeapons: PubgMapWeaponShare[];
}

/** 한 패치 구간 전체(맵 축). */
export interface PubgMapAggregate {
  patch: string;
  label: string;
  /** 이 구간 official 매치 총수 — matchShare의 분모. */
  nMatches: number;
  maps: PubgMapStat[];
}

/**
 * 맵 1종의 두 구간 비교. 판정(status)을 만들지 않는 이유는 파일 헤더 참고 — 이 행은
 * "무엇이 얼마나 움직였다"까지만 말하고, 그 원인을 패치노트에 귀속시키지 않는다.
 */
export interface PubgMapDeltaRow {
  mapKey: string;
  matchShare: { before: number; after: number };
  /** 두 구간 점유율 차(after - before). 절대 비율 차이(%p가 아니라 0~1 스케일). */
  matchShareDelta: number;
  avgDurationSec: { before: number | null; after: number | null };
  botShare: { before: number; after: number };
  pickupsPerMatch: { before: number; after: number };
  n: { before: number; after: number };
}

/** 표시용 한국어 맵 이름 + 자산 조달용 공식 표시명.
 *
 * ⚠️ `pubg/api-assets`의 맵 이미지 파일명은 **텔레메트리 키가 아니라 표시명** 기준이다 —
 * `Baltic_Main_No_Text_Low_Res.png`는 404이고 `Erangel_Main_No_Text_Low_Res.png`가 200이다
 * (2026-09-17 실측). 그래서 키→표시명 변환을 이 한 곳에 둔다. 영문 표시명은 공식 사전
 * (`dictionaries/telemetry/mapName.json`)과 같은 값이고, 한국어는 그 사전에 없어 여기서 준다.
 */
export interface PubgMapIdentity {
  /** api-assets 파일명 접두사(`Erangel`). */
  assetName: string;
  /** 화면 표기명(한국어). */
  koName: string;
  /** 부제 — 시안 §4 `.detail-eyebrow`의 "맵 · 8×8" 자리. */
  sizeLabel: string;
}

export const PUBG_MAPS: Readonly<Record<string, PubgMapIdentity>> = {
  Baltic_Main: { assetName: "Erangel", koName: "에란겔", sizeLabel: "8×8" },
  Desert_Main: { assetName: "Miramar", koName: "미라마", sizeLabel: "8×8" },
  Tiger_Main: { assetName: "Taego", koName: "태이고", sizeLabel: "8×8" },
  Kiki_Main: { assetName: "Deston", koName: "데스턴", sizeLabel: "8×8" },
  Neon_Main: { assetName: "Rondo", koName: "론도", sizeLabel: "8×8" },
  DihorOtok_Main: { assetName: "Vikendi", koName: "비켄디", sizeLabel: "6×6" },
  Savage_Main: { assetName: "Sanhok", koName: "사녹", sizeLabel: "4×4" },
  Summerland_Main: { assetName: "Karakin", koName: "카라킨", sizeLabel: "2×2" },
  Chimera_Main: { assetName: "Paramo", koName: "파라모", sizeLabel: "3×3" },
  Erangel_Main: { assetName: "Erangel", koName: "에란겔(구)", sizeLabel: "8×8" },
  Heaven_Main: { assetName: "Haven", koName: "헤이븐", sizeLabel: "1×1" },
  Range_Main: { assetName: "Camp_Jackal", koName: "캠프 재칼", sizeLabel: "훈련장" },
} as const;

/** 사전에 없는 맵 키도 화면에서 죽지 않게 한다 — 키 그대로가 정직한 폴백이다(이름을 짓지
 * 않는다). 신규 맵이 추가되면 여기 대신 `PUBG_MAPS`에 한 줄을 넣는 것이 정답이다. */
export function mapIdentity(mapKey: string): PubgMapIdentity {
  return PUBG_MAPS[mapKey] ?? { assetName: "", koName: mapKey, sizeLabel: "미등록" };
}

/** 이 맵 안에서 무기 픽업을 정준키로 합산해 점유율 상위 `limit`건을 낸다. */
function topWeaponsOf(matches: readonly PubgReducedMatch[], limit: number): PubgMapWeaponShare[] {
  const pickups = new Map<string, number>();
  let total = 0;
  for (const match of matches) {
    for (const [rawKey, count] of Object.entries(match.weaponPickup)) {
      if (!isFirearm(rawKey)) continue;
      const key = canonicalWeaponKey(rawKey);
      pickups.set(key, (pickups.get(key) ?? 0) + count);
      total += count;
    }
  }
  if (total === 0) return [];
  return [...pickups.entries()]
    .map(([weaponKey, count]) => ({
      weaponKey,
      weaponName: weaponDisplayName(weaponKey),
      pickups: count,
      share: count / total,
    }))
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
}

/**
 * 구간 1개의 맵 집계. 입력은 **이미 구간·official로 걸러진** 매치여야 한다
 * (`selectMatches`의 산출물 — 필터를 여기서 다시 하지 않는 이유는 무기 집계와 같은 전처리를
 * 두 번 쓰지 않기 위해서다).
 */
export function aggregatePubgMaps(
  matches: readonly PubgReducedMatch[],
  patch: string,
  label: string,
  topWeaponLimit = 5
): PubgMapAggregate {
  const byMap = new Map<string, PubgReducedMatch[]>();
  for (const match of matches) {
    if (!match.map) continue; // 맵을 모르는 매치는 맵 축에 넣지 않는다(추측 금지)
    const list = byMap.get(match.map) ?? [];
    list.push(match);
    byMap.set(match.map, list);
  }

  const nMatches = matches.length;
  const maps: PubgMapStat[] = [];
  for (const [mapKey, rows] of byMap) {
    let bots = 0;
    let humans = 0;
    let pickups = 0;
    let durationSum = 0;
    let durationN = 0;
    for (const row of rows) {
      bots += row.nBots;
      humans += row.nHumans;
      for (const [rawKey, count] of Object.entries(row.weaponPickup)) {
        if (isFirearm(rawKey)) pickups += count;
      }
      if (row.duration !== null) {
        durationSum += row.duration;
        durationN += 1;
      }
    }
    const players = bots + humans;
    maps.push({
      mapKey,
      nMatches: rows.length,
      matchShare: nMatches === 0 ? 0 : rows.length / nMatches,
      matchShareCi: wilson(rows.length, nMatches),
      avgDurationSec: durationN === 0 ? null : durationSum / durationN,
      botShare: players === 0 ? 0 : bots / players,
      pickupsPerMatch: rows.length === 0 ? 0 : pickups / rows.length,
      topWeapons: topWeaponsOf(rows, topWeaponLimit),
    });
  }

  maps.sort((a, b) => b.nMatches - a.nMatches);
  return { patch, label, nMatches, maps };
}

/**
 * 두 구간 맵 집계의 비교표. **양쪽에 다 등장한 맵만** 낸다 — 한쪽에만 있는 맵은 "0%에서
 * 생겼다/사라졌다"가 아니라 표본에 안 걸린 것일 수 있고, 그 둘을 표본만으로 구분할 수 없다.
 * 제외된 키는 `onlyBefore`/`onlyAfter`로 돌려주므로 호출부가 숨기지 않고 말할 수 있다.
 */
export function buildPubgMapDeltas(
  before: PubgMapAggregate,
  after: PubgMapAggregate
): { rows: PubgMapDeltaRow[]; onlyBefore: string[]; onlyAfter: string[] } {
  const beforeByKey = new Map(before.maps.map((m) => [m.mapKey, m] as const));
  const afterByKey = new Map(after.maps.map((m) => [m.mapKey, m] as const));

  const rows: PubgMapDeltaRow[] = [];
  for (const [mapKey, b] of beforeByKey) {
    const a = afterByKey.get(mapKey);
    if (!a) continue;
    rows.push({
      mapKey,
      matchShare: { before: b.matchShare, after: a.matchShare },
      matchShareDelta: a.matchShare - b.matchShare,
      avgDurationSec: { before: b.avgDurationSec, after: a.avgDurationSec },
      botShare: { before: b.botShare, after: a.botShare },
      pickupsPerMatch: { before: b.pickupsPerMatch, after: a.pickupsPerMatch },
      n: { before: b.nMatches, after: a.nMatches },
    });
  }
  rows.sort((x, y) => y.n.before + y.n.after - (x.n.before + x.n.after));

  return {
    rows,
    onlyBefore: [...beforeByKey.keys()].filter((k) => !afterByKey.has(k)),
    onlyAfter: [...afterByKey.keys()].filter((k) => !beforeByKey.has(k)),
  };
}
