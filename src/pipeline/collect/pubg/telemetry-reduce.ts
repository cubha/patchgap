// src/pipeline/collect/pubg/telemetry-reduce.ts
// 텔레메트리 reduce-on-ingest — **순수 함수**다(네트워크·파일 I/O 없음).
//
// 왜 TypeScript로 옮겼나(2026-09-20): 이 축의 원본 구현은
// `docs/plan/provenance/2026-09-16-pubg-harvest/telemetry.py`(Python)였고, 사람이 손으로
// 돌렸다. SCOPE §3이 스택을 TypeScript/Node로 고정하고 있어 CI에 그대로 얹을 수 없었고,
// 그래서 PUBG만 **정기 수집이 없는 게임**으로 남아 있었다.
//
// 원본 30MB(gz 1.3MB)를 매치당 ~3KB로 줄인다. 원본은 디스크에 남기지 않는다 — 7,217건이면
// 200GB가 넘고, 그걸 보관할 이유가 없다(집계가 읽는 것은 이 축약뿐이다).
//
// **이 파일이 순수한 이유**: 이벤트 배열만 받으면 실제 매치로 검증할 수 있다. 실제로 그렇게
// 검증했다 — 같은 매치를 Python 원본과 이 구현으로 각각 줄여 산출 JSON을 바이트 비교했다
// (`__tests__/telemetry-reduce.test.ts`의 골든 픽스처가 그 결과다).

import type { PubgReducedMatch } from "../../aggregate/pubg-weapons";

/** 텔레메트리 이벤트 1건 — 스키마가 이벤트 종류마다 달라 `unknown` 필드 접근으로 다룬다. */
export type TelemetryEvent = Record<string, unknown>;

/** `/matches/{id}` 응답에서 가져오는 매치 속성(축약본의 머리 부분). */
export interface PubgMatchAttributes {
  createdAt: string | null;
  mapName: string | null;
  gameMode: string | null;
  duration: number | null;
}

/**
 * `LogMatchDefinition.MatchId`에서 뽑는 라벨.
 *
 * 형식: `match.bro.official.pc-2018-43.steam.squad-fpp.as.2026.09.11.xx`
 * — 이 문자열이 **패치를 아는 유일한 경로**다. `/matches/{id}` 응답에는 패치 필드가 없다.
 */
export interface MatchDefinitionLabel {
  matchType: string;
  patch: string;
  telMode: string;
  region: string;
}

const MATCH_DEFINITION_RE =
  /match\.[a-z]+\.([a-z0-9]+)\.(pc-\d{4}-\d+)\.steam\.([a-z0-9-]+)\.([a-z]+)\./;

export function parseMatchDefinition(matchIdField: string): MatchDefinitionLabel | null {
  const m = MATCH_DEFINITION_RE.exec(matchIdField);
  if (!m) return null;
  return { matchType: m[1], patch: m[2], telMode: m[3], region: m[4] };
}

function bump(counter: Map<string, number>, key: string, by = 1): void {
  counter.set(key, (counter.get(key) ?? 0) + by);
}

/** Map → 평범한 객체. 키 순서는 **삽입 순서**(Python Counter와 같다). */
function toRecord(counter: Map<string, number>): Record<string, number> {
  return Object.fromEntries(counter);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * 이벤트 배열 1개를 축약 1건으로 접는다.
 *
 * 봇 판정은 `accountId`가 `ai.`로 시작하는지 본다 — PUBG는 봇 계정을 그 접두로 준다.
 * 봇을 **빼지 않고 비율로 병기**하는 것은 집계 쪽 결정이다(`aggregatePubgWeapons`의 botShare):
 * 봇 픽업도 실제 무기 스폰 분포를 반영하고, 빼면 표본이 절반으로 준다.
 */
export function reduceTelemetry(
  matchId: string,
  attributes: PubgMatchAttributes,
  events: readonly TelemetryEvent[]
): PubgReducedMatch & {
  nEvents: number;
  telMode: string | null;
  vehicleDamageHits: Record<string, number>;
  weaponDamageSum: Record<string, number>;
  vehicleDamageSum: Record<string, number>;
} {
  let label: MatchDefinitionLabel | null = null;
  const pickup = new Map<string, number>();
  const kills = new Map<string, number>();
  const damageHits = new Map<string, number>();
  const attacks = new Map<string, number>();
  const vehicleHits = new Map<string, number>();
  const damageSum = new Map<string, number>();
  const vehicleSum = new Map<string, number>();
  const bots = new Set<string>();
  const humans = new Set<string>();

  for (const event of events) {
    const type = event["_T"];
    if (type === "LogMatchDefinition") {
      const field = asString(event["MatchId"]);
      if (field) label = parseMatchDefinition(field) ?? label;
    } else if (type === "LogItemPickup") {
      const item = asRecord(event["item"]);
      const itemId = item ? asString(item["itemId"]) : null;
      if (item?.["category"] === "Weapon" && itemId) bump(pickup, itemId);
    } else if (type === "LogPlayerKillV2") {
      const info = asRecord(event["killerDamageInfo"]);
      const weapon = info ? asString(info["damageCauserName"]) : null;
      if (weapon) bump(kills, weapon);
    } else if (type === "LogPlayerTakeDamage") {
      const weapon = asString(event["damageCauserName"]);
      if (weapon && weapon.startsWith("Weap")) {
        bump(damageHits, weapon);
        bump(damageSum, weapon, Number(event["damage"]) || 0);
      }
    } else if (type === "LogVehicleDamage") {
      const weapon = asString(event["damageCauserName"]);
      if (weapon && weapon.startsWith("Weap")) {
        bump(vehicleHits, weapon);
        bump(vehicleSum, weapon, Number(event["damage"]) || 0);
      }
    } else if (type === "LogPlayerAttack") {
      const weapon = asRecord(event["weapon"]);
      const itemId = weapon ? asString(weapon["itemId"]) : null;
      if (itemId) bump(attacks, itemId);
    } else if (type === "LogPlayerLogin" || type === "LogPlayerCreate") {
      const character = asRecord(event["character"]);
      const accountId = String(event["accountId"] ?? character?.["accountId"] ?? "");
      (accountId.startsWith("ai.") ? bots : humans).add(accountId);
    }
  }

  const round1 = (m: Map<string, number>): Record<string, number> =>
    Object.fromEntries([...m].map(([k, v]) => [k, Math.round(v * 10) / 10]));

  return {
    matchId,
    createdAt: attributes.createdAt,
    map: attributes.mapName,
    gameMode: attributes.gameMode,
    duration: attributes.duration,
    patch: label?.patch ?? null,
    matchType: label?.matchType ?? null,
    telMode: label?.telMode ?? null,
    region: label?.region ?? null,
    nEvents: events.length,
    nBots: bots.size,
    nHumans: humans.size,
    weaponPickup: toRecord(pickup),
    weaponKills: toRecord(kills),
    weaponDamageHits: toRecord(damageHits),
    weaponAttacks: toRecord(attacks),
    vehicleDamageHits: toRecord(vehicleHits),
    weaponDamageSum: round1(damageSum),
    vehicleDamageSum: round1(vehicleSum),
  };
}
