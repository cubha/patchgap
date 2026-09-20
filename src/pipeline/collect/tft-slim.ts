// src/pipeline/collect/tft-slim.ts
// TFT 원본 응답 → `TftMatchSlim`. **실응답을 보고 쓴 변환이다**(문서 추정 아님).
//
// 수집(`tft-crawler.ts`)이 원본을 그대로 적재하는 것과 짝이다 — 변환이 틀려도 재수집이 아니라
// 이 파일만 고쳐 몇 초 만에 다시 돌린다.
import type { TftMatchSlim, TftParticipantSlim, TftTraitSlim } from "../types";

/**
 * 보드에 나타나지만 **플레이어가 고른 유닛이 아닌** 키 — PvE 몬스터·소환물이다.
 * 걸러내지 않으면 등장률 분모가 오염된다(실측 400매치에서 `DA_Sentinel18`만 1,323회 등장).
 *
 * 이 목록은 **세트마다 바뀐다.** 권위 있는 필터는 DDragon 카탈로그 조인(`tft-catalog.ts`)이고,
 * 이 목록은 카탈로그 없이 도는 변환 단계용 1차 거름망이다. 새 세트에서 낯선 키가 보이면
 * 집계 쪽 `unmatched` 보고에 잡힌다 — 조용히 통과하지 않는다.
 */
export const PVE_UNIT_KEYS: readonly string[] = [
  "DA_18_ElderDragon",
  "DA_18_Sentry",
  "DA_Brambleback18",
  "DA_Cinderling18",
  "DA_CrimsonRaptor18",
  "DA_Gromp18_AP",
  "DA_Krug18",
  "DA_Murkwolf18",
  "DA_Scuttlecrab18",
  "DA_Sentinel18",
];

const PVE_SET = new Set(PVE_UNIT_KEYS);

export function isPlayableUnitKey(key: string): boolean {
  return !PVE_SET.has(key);
}

export interface ToSlimOptions {
  /** 참가자 수가 이 값이 아니면 매치를 통째로 버린다. 기본은 검사하지 않음. */
  requiredParticipants?: number;
  /** 유닛 키 필터 주입(테스트·차기 세트용). 기본은 위 PvE 목록. */
  isPlayable?: (key: string) => boolean;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function toParticipant(raw: unknown, isPlayable: (key: string) => boolean): TftParticipantSlim | null {
  const p = raw as Record<string, unknown> | null;
  if (!p) return null;
  const puuid = str(p.puuid);
  const placement = p.placement;
  if (puuid === null || typeof placement !== "number") return null;

  const unitIds: string[] = [];
  const itemIds: string[] = [];
  for (const rawUnit of Array.isArray(p.units) ? p.units : []) {
    const u = rawUnit as { character_id?: unknown; itemNames?: unknown };
    const id = str(u.character_id);
    if (id === null || !isPlayable(id)) continue;
    unitIds.push(id);
    for (const item of Array.isArray(u.itemNames) ? u.itemNames : []) {
      const key = str(item);
      if (key !== null) itemIds.push(key);
    }
  }

  const traits: TftTraitSlim[] = [];
  for (const rawTrait of Array.isArray(p.traits) ? p.traits : []) {
    const t = rawTrait as { name?: unknown; style?: unknown; tier_current?: unknown; num_units?: unknown };
    const name = str(t.name);
    // `style === 0`은 보드에 유닛은 있었지만 **발동 조건을 못 채운** 상태다. 그것까지 세면
    // "특성 등장률"이 "그 특성 유닛을 1개라도 들었나"로 의미가 바뀐다.
    if (name === null || num(t.style) === 0) continue;
    traits.push({ name, tier: num(t.tier_current), numUnits: num(t.num_units) });
  }

  return {
    puuid,
    placement,
    level: num(p.level),
    lastRound: num(p.last_round),
    timeEliminatedSec: num(p.time_eliminated),
    goldLeft: num(p.gold_left),
    unitIds,
    itemIds,
    traits,
  };
}

/** 형태가 어긋나면 `null` — 빈 매치를 지어내지 않는다. */
export function toTftMatchSlim(raw: unknown, patch: string, options: ToSlimOptions = {}): TftMatchSlim | null {
  const isPlayable = options.isPlayable ?? isPlayableUnitKey;
  const root = raw as { metadata?: { match_id?: unknown }; info?: Record<string, unknown> } | null;
  const info = root?.info;
  if (!info) return null;

  const rawParticipants = Array.isArray(info.participants) ? info.participants : [];
  if (rawParticipants.length === 0) return null;
  if (options.requiredParticipants !== undefined && rawParticipants.length !== options.requiredParticipants) {
    return null;
  }

  const participants: TftParticipantSlim[] = [];
  for (const rp of rawParticipants) {
    const p = toParticipant(rp, isPlayable);
    if (p === null) return null; // 한 명이라도 못 읽으면 그 매치는 통째로 신뢰할 수 없다.
    participants.push(p);
  }

  const matchId = str(root?.metadata?.match_id);
  if (matchId === null) return null;

  return {
    matchId,
    patch,
    gameDatetimeMs: num(info.game_datetime),
    gameLengthSec: num(info.game_length),
    queueId: num(info.queue_id ?? info.queueId, -1),
    setNumber: num(info.tft_set_number, -1),
    participants,
  };
}
