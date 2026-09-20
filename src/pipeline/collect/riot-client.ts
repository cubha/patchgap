// src/pipeline/collect/riot-client.ts
// Riot API 클라이언트 — 이 프로젝트에서 Riot API를 호출하는 유일한 계층(CLAUDE.md 디렉토리 규칙).
// fetch + bottleneck 2단 체이닝(app 20/1s ⟵ 전역 100/120s, Personal 키 고정 리밋), 429
// Retry-After 재시도(5회) · 5xx/네트워크 지수 백오프(3회) · 404=null(match/timeline 한정) ·
// 403=즉시 throw(키 값은 메시지에 포함하지 않는다). 방법 리밋 헤더는 로깅용 콜백으로만 노출한다.

import Bottleneck from "bottleneck";
import type { MatchSlim, ParticipantSlim, TeamObjectiveRecord, TeamObjectives, TeamSlim } from "../types";
import { canonicalPatch } from "../shared/patches";

const RETRYABLE_429_MAX_ATTEMPTS = 5;
const RETRYABLE_5XX_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;

/** 응답 헤더에서 로깅용으로만 뽑아내는 리밋 정보 — 429 재시도 판단에는 쓰지 않는다(그건 상태코드로 한다). */
export interface RateLimitHeaderSnapshot {
  appRateLimit: string | null;
  appRateLimitCount: string | null;
  methodRateLimit: string | null;
  methodRateLimitCount: string | null;
}

export interface RiotClientOptions {
  apiKey: string;
  /** 플랫폼 라우팅(예: "kr") — league-v4/summoner-v4. */
  platform: string;
  /** 지역 라우팅(예: "asia") — match-v5. */
  region: string;
  /** 테스트 주입용. 기본값 전역 fetch. */
  fetchImpl?: typeof fetch;
  /** 테스트 주입용 sleep. 기본값 실제 setTimeout 기반 대기. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** app 리밋(20/1s) 오버라이드 — 테스트에서 minTime:0 등으로 주입. */
  appLimiterOptions?: Bottleneck.ConstructorOptions;
  /** 전역 리밋(100/120s) 오버라이드. */
  globalLimiterOptions?: Bottleneck.ConstructorOptions;
  /** X-Method-Rate-Limit* 헤더 로깅 훅(호출부 책임 — 클라이언트는 로깅하지 않는다). */
  onRateLimit?: (snapshot: RateLimitHeaderSnapshot, url: string) => void;
}

export type LeagueTier = "challenger" | "grandmaster" | "master";

/** league-v4 entries 원소 중 이 파이프라인이 쓰는 필드. puuid 부재 시 summoner-v4 폴백으로 채운다. */
export interface LeagueEntrySlim {
  puuid: string;
  summonerId: string | null;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface GetMatchIdsOptions {
  startTime?: number;
  endTime?: number;
  queue?: number;
  type?: string;
  start?: number;
  count?: number;
}

// ─── Riot 원본 응답(wire) 타입 — match-v5 문서 스키마 기준, 라이브 스모크로 검증한다. ──────
// 도메인 타입(MatchSlim 등)은 src/pipeline/types.ts에만 둔다는 규칙에 따라, 이 wire DTO들은
// collect 계층 내부 전용이며 다른 모듈로 export하지 않는다(riot-client.ts 밖에서 참조 금지).

interface RiotLeagueEntryDto {
  puuid?: string;
  summonerId?: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

interface RiotLeagueListDto {
  tier: string;
  leagueId: string;
  queue: string;
  name: string;
  entries: RiotLeagueEntryDto[];
}

interface RiotSummonerDto {
  puuid: string;
}

interface RiotParticipantChallengesDto {
  goldPerMinute?: number;
  laneMinionsFirst10Minutes?: number;
  damagePerMinute?: number;
}

interface RiotParticipantDto {
  puuid: string;
  championId: number;
  championName: string;
  teamId: number;
  teamPosition: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  goldEarned: number;
  challenges?: RiotParticipantChallengesDto;
}

interface RiotObjectiveDto {
  first: boolean;
  kills: number;
}

interface RiotTeamDto {
  teamId: number;
  win: boolean;
  bans: Array<{ championId: number; pickTurn: number }>;
  objectives: {
    baron: RiotObjectiveDto;
    dragon: RiotObjectiveDto;
    riftHerald: RiotObjectiveDto;
    tower: RiotObjectiveDto;
    // void 유충(2024+). 명칭이 패치에 따라 바뀔 수 있어 라이브 확인 전까지 방어적으로 optional.
    horde?: RiotObjectiveDto;
  };
}

export interface RiotMatchDto {
  metadata: { matchId: string };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameVersion: string;
    queueId: number;
    participants: RiotParticipantDto[];
    teams: RiotTeamDto[];
  };
}

export interface RiotMatchTimelineDto {
  metadata: { matchId: string };
  info: {
    frameInterval: number;
    frames: Array<{
      timestamp: number;
      participantFrames: Record<string, { totalGold: number }>;
      events: Array<{ type: string; timestamp: number; [key: string]: unknown }>;
    }>;
  };
}

export interface RiotClient {
  getLeagueEntries(tier: LeagueTier, queue?: string): Promise<LeagueEntrySlim[]>;
  getMatchIdsByPuuid(puuid: string, options?: GetMatchIdsOptions): Promise<string[]>;
  getMatch(matchId: string): Promise<RiotMatchDto | null>;
  getMatchTimeline(matchId: string): Promise<RiotMatchTimelineDto | null>;
  /** bottleneck의 reservoirRefreshInterval 타이머를 정리한다 — 호출하지 않으면 프로세스가 종료되지 않는다. */
  dispose(): Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** attempt;
}

export function maskedUrl(url: string): string {
  // API 키는 헤더로만 전달하므로 URL엔 원래 포함되지 않는다 — 쿼리스트링을 떼어 로그를 짧게 유지한다.
  //
  // **경로의 puuid도 가린다**(2026-09-20 security-auditor 지적). `/by-puuid/{puuid}/ids`는
  // 쿼리가 아니라 **경로**라 `?` 자르기로는 안 지워진다. 이 URL은 429/5xx 재시도 소진 시
  // 예외 메시지에 실리고, 그 예외는 CI 로그로 나가 실패 시 아티팩트로 업로드된다 —
  // 즉 특정 플레이어의 puuid가 공개 로그에 남을 수 있었다. puuid는 이 프로젝트가 PII로
  // 취급하는 값이다(집계 산출물에서도 전수 배제한다).
  const withoutQuery = url.indexOf("?") === -1 ? url : url.slice(0, url.indexOf("?"));
  return withoutQuery.replace(/\/by-puuid\/[^/]+/g, "/by-puuid/***");
}

export function createRiotClient(options: RiotClientOptions): RiotClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;

  const appLimiter = new Bottleneck({
    reservoir: 20,
    reservoirRefreshAmount: 20,
    reservoirRefreshInterval: 1000,
    minTime: 50,
    maxConcurrent: 4,
    ...options.appLimiterOptions,
  });
  const globalLimiter = new Bottleneck({
    reservoir: 100,
    reservoirRefreshAmount: 100,
    reservoirRefreshInterval: 120_000,
    ...options.globalLimiterOptions,
  });
  appLimiter.chain(globalLimiter);

  function readRateLimitHeaders(res: Response): RateLimitHeaderSnapshot {
    return {
      appRateLimit: res.headers.get("X-App-Rate-Limit"),
      appRateLimitCount: res.headers.get("X-App-Rate-Limit-Count"),
      methodRateLimit: res.headers.get("X-Method-Rate-Limit"),
      methodRateLimitCount: res.headers.get("X-Method-Rate-Limit-Count"),
    };
  }

  /** 429/5xx/네트워크 오류만 재시도한다. 그 외 상태코드(200·403·404 등)는 그대로 반환한다. */
  async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let retries429 = 0;
    let retries5xx = 0;
    for (;;) {
      let res: Response;
      try {
        res = await fetchImpl(url, init);
      } catch (error) {
        if (retries5xx >= RETRYABLE_5XX_MAX_ATTEMPTS) {
          throw new Error(
            `Riot API network error: retry budget exhausted for ${maskedUrl(url)}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        await sleepImpl(backoffMs(retries5xx));
        retries5xx += 1;
        continue;
      }

      options.onRateLimit?.(readRateLimitHeaders(res), maskedUrl(url));

      if (res.status === 429) {
        if (retries429 >= RETRYABLE_429_MAX_ATTEMPTS) {
          throw new Error(`Riot API 429: retry budget exhausted for ${maskedUrl(url)}`);
        }
        const retryAfterHeader = res.headers.get("Retry-After");
        const waitMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : backoffMs(retries429);
        await sleepImpl(waitMs);
        retries429 += 1;
        continue;
      }

      if (res.status >= 500) {
        if (retries5xx >= RETRYABLE_5XX_MAX_ATTEMPTS) {
          throw new Error(`Riot API 5xx: retry budget exhausted (status=${res.status}) for ${maskedUrl(url)}`);
        }
        await sleepImpl(backoffMs(retries5xx));
        retries5xx += 1;
        continue;
      }

      return res;
    }
  }

  async function requestJson<T>(url: string, opts: { allow404: boolean }): Promise<T | null> {
    const res = await appLimiter.schedule(() =>
      fetchWithRetry(url, { headers: { "X-Riot-Token": options.apiKey } })
    );

    if (res.status === 403) {
      throw new Error("Riot API 403: forbidden (invalid or unauthorized API key)");
    }
    if (res.status === 404) {
      if (opts.allow404) return null;
      throw new Error(`Riot API 404: ${maskedUrl(url)}`);
    }
    if (!res.ok) {
      throw new Error(`Riot API error ${res.status}: ${maskedUrl(url)}`);
    }
    return (await res.json()) as T;
  }

  async function resolvePuuidBySummonerId(summonerId: string): Promise<string> {
    const url = `https://${options.platform}.api.riotgames.com/lol/summoner/v4/summoners/${summonerId}`;
    const dto = await requestJson<RiotSummonerDto>(url, { allow404: false });
    if (!dto) {
      throw new Error(`Riot API: summoner-v4 returned no body for summonerId lookup`);
    }
    return dto.puuid;
  }

  async function getLeagueEntries(
    tier: LeagueTier,
    queue = "RANKED_SOLO_5x5"
  ): Promise<LeagueEntrySlim[]> {
    const url = `https://${options.platform}.api.riotgames.com/lol/league/v4/${tier}leagues/by-queue/${queue}`;
    const dto = await requestJson<RiotLeagueListDto>(url, { allow404: false });
    if (!dto) {
      throw new Error(`Riot API: league-v4 returned no body for tier=${tier}`);
    }

    const resolved: LeagueEntrySlim[] = [];
    for (const entry of dto.entries) {
      let puuid = entry.puuid;
      if (!puuid) {
        if (!entry.summonerId) {
          throw new Error(
            "Riot API: league-v4 entry has neither puuid nor summonerId — cannot resolve"
          );
        }
        puuid = await resolvePuuidBySummonerId(entry.summonerId);
      }
      resolved.push({
        puuid,
        summonerId: entry.summonerId ?? null,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
      });
    }
    return resolved;
  }

  async function getMatchIdsByPuuid(
    puuid: string,
    matchIdsOptions: GetMatchIdsOptions = {}
  ): Promise<string[]> {
    const { startTime, endTime, queue = 420, type = "ranked", start = 0, count = 100 } =
      matchIdsOptions;
    const params = new URLSearchParams({
      queue: String(queue),
      type,
      start: String(start),
      count: String(count),
    });
    if (startTime !== undefined) params.set("startTime", String(startTime));
    if (endTime !== undefined) params.set("endTime", String(endTime));

    const url = `https://${options.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${params.toString()}`;
    const dto = await requestJson<string[]>(url, { allow404: false });
    return dto ?? [];
  }

  async function getMatch(matchId: string): Promise<RiotMatchDto | null> {
    const url = `https://${options.region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    return requestJson<RiotMatchDto>(url, { allow404: true });
  }

  async function getMatchTimeline(matchId: string): Promise<RiotMatchTimelineDto | null> {
    const url = `https://${options.region}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
    return requestJson<RiotMatchTimelineDto>(url, { allow404: true });
  }

  async function dispose(): Promise<void> {
    await appLimiter.disconnect();
    await globalLimiter.disconnect();
  }

  return { getLeagueEntries, getMatchIdsByPuuid, getMatch, getMatchTimeline, dispose };
}

function riotObjectiveToRecord(objective: RiotObjectiveDto): TeamObjectiveRecord {
  return { first: objective.first, kills: objective.kills };
}

function toTeamObjectives(dto: RiotTeamDto["objectives"]): TeamObjectives {
  const objectives: TeamObjectives = {
    baron: riotObjectiveToRecord(dto.baron),
    dragon: riotObjectiveToRecord(dto.dragon),
    riftHerald: riotObjectiveToRecord(dto.riftHerald),
    tower: riotObjectiveToRecord(dto.tower),
  };
  if (dto.horde) {
    objectives.grubs = riotObjectiveToRecord(dto.horde);
  }
  return objectives;
}

function toParticipantSlim(dto: RiotParticipantDto): ParticipantSlim {
  return {
    puuid: dto.puuid,
    championId: dto.championId,
    championName: dto.championName,
    teamId: dto.teamId,
    teamPosition: isTeamPosition(dto.teamPosition) ? dto.teamPosition : "",
    win: dto.win,
    kills: dto.kills,
    deaths: dto.deaths,
    assists: dto.assists,
    items: [dto.item0, dto.item1, dto.item2, dto.item3, dto.item4, dto.item5, dto.item6],
    goldEarned: dto.goldEarned,
    challenges: {
      goldPerMinute: dto.challenges?.goldPerMinute,
      laneMinionsFirst10Minutes: dto.challenges?.laneMinionsFirst10Minutes,
      damagePerMinute: dto.challenges?.damagePerMinute,
    },
  };
}

const TEAM_POSITIONS = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", ""]);
function isTeamPosition(value: string): value is ParticipantSlim["teamPosition"] {
  return TEAM_POSITIONS.has(value);
}

/**
 * raw match-v5 응답 → MatchSlim reduce-on-ingest. 순수 함수(부수효과 없음).
 * 불변식 위반(참가자 10명·팀 2개가 아님)은 데이터 손상으로 보고 throw한다 — 조용히 잘라내지 않는다.
 */
export function toMatchSlim(raw: RiotMatchDto): MatchSlim {
  const { info, metadata } = raw;

  if (info.participants.length !== 10) {
    throw new Error(
      `toMatchSlim(${metadata.matchId}): expected 10 participants, got ${info.participants.length}`
    );
  }
  if (info.teams.length !== 2) {
    throw new Error(`toMatchSlim(${metadata.matchId}): expected 2 teams, got ${info.teams.length}`);
  }

  const teams: TeamSlim[] = info.teams.map((team) => ({
    teamId: team.teamId,
    win: team.win,
    bans: team.bans.map((ban) => ban.championId),
    objectives: toTeamObjectives(team.objectives),
  }));

  return {
    matchId: metadata.matchId,
    gameVersion: info.gameVersion,
    patch: canonicalPatch(info.gameVersion),
    gameCreationMs: info.gameCreation,
    gameDurationSec: info.gameDuration,
    queueId: info.queueId,
    participants: info.participants.map(toParticipantSlim),
    teams,
  };
}
