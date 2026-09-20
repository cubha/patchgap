// src/pipeline/collect/tft-client.ts
// TFT API 클라이언트 — `tft-league-v1` → `tft-match-v1`.
//
// **리밋은 키 단위다.** 여기 붙인 20/1s ∧ 100/120s는 `riot-client.ts`(LoL)와 **같은 예산을
// 나눠 쓴다**. 두 파이프라인을 동시에 돌리면 합계가 리밋을 넘어 양쪽 모두 429를 맞는다.
// 지금 리미터 인스턴스를 공유하지 않는 이유는 `riot-client.ts`가 LoL 크리티컬 패스(9/24 크론)에
// 있어서 착수 직전에 손대고 싶지 않아서다 — 공유가 필요해지면 그때 리미터를 주입 가능하게
// 뽑아낸다. 그때까지는 **순차 실행이 전제**다.
//
// **스키마를 여기서 고정하지 않는다.** 2026-09-20 현재 TFT 엔드포인트는 이 프로젝트의 키로
// 403(제품 미등록)이라 실응답을 한 번도 못 봤다. 문서 기반으로 타입을 박아 두면 그 추정이
// 하류(집계·판정)까지 굳는다. 그래서 이 계층은 **원본 JSON을 그대로 돌려주고**, 슬림 변환은
// 실응답을 본 뒤 별도 모듈에서 한다. 여기서 읽는 필드는 수집 제어에 꼭 필요한 둘뿐이다
// (`game_datetime` · `game_version`).
import Bottleneck from "bottleneck";

const BASE_BACKOFF_MS = 1_000;
const MAX_429_RETRIES = 5;
const MAX_5XX_RETRIES = 3;

export type TftTier = "challenger" | "grandmaster" | "master";

/** `tft-league-v1` 엔트리 중 이 파이프라인이 쓰는 필드. 2025-06-20 이후 puuid를 직접 준다. */
export interface TftLeagueEntry {
  puuid: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface TftMatchIdsOptions {
  startTime?: number;
  endTime?: number;
  start?: number;
  count?: number;
}

/**
 * 매치 1건의 **원본** 응답. 수집 제어에 필요한 두 필드만 타입으로 안다 —
 * 나머지는 `raw`에 그대로 있고, 실응답을 본 뒤 슬림 변환에서 읽는다.
 */
export interface TftMatchEnvelope {
  matchId: string;
  /** epoch ms. */
  gameDatetime: number;
  /** 예: "Version 16.18.679.1234 (…)" — 패치 창 분류에 쓴다. */
  gameVersion: string;
  raw: unknown;
}

export interface TftClientOptions {
  apiKey: string;
  /** 플랫폼 라우팅(예: "kr") — league-v1. */
  platform: string;
  /** 지역 라우팅(예: "asia") — match-v1. */
  region: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  appLimiterOptions?: Bottleneck.ConstructorOptions;
  globalLimiterOptions?: Bottleneck.ConstructorOptions;
  onRateLimit?: (headers: { appRateLimit: string | null; appRateLimitCount: string | null }, url: string) => void;
}

export interface TftClient {
  getLeagueEntries(tier: TftTier): Promise<TftLeagueEntry[]>;
  getMatchIdsByPuuid(puuid: string, options?: TftMatchIdsOptions): Promise<string[]>;
  /** 404는 `null`(삭제·미전파 매치) — 그 외 오류는 던진다. */
  getMatch(matchId: string): Promise<TftMatchEnvelope | null>;
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

/** `{ metadata: { match_id }, info: { game_datetime, game_version } }`만 좁힌다. */
export function readMatchEnvelope(raw: unknown, fallbackId: string): TftMatchEnvelope {
  const root = raw as { metadata?: { match_id?: unknown }; info?: Record<string, unknown> } | null;
  const metaId = root?.metadata?.match_id;
  const info = root?.info ?? {};
  const datetime = info.game_datetime;
  const version = info.game_version;
  return {
    matchId: typeof metaId === "string" ? metaId : fallbackId,
    gameDatetime: typeof datetime === "number" ? datetime : Number.NaN,
    gameVersion: typeof version === "string" ? version : "",
    raw,
  };
}

/**
 * `"Version 16.18.679.1234 (Sep 09 2026)"` → `"16.18"`.
 * TFT는 게임 클라이언트 버전을 주고 패치노트는 세트 기준(18.2)이라 **둘은 다른 축이다** —
 * 그래서 이 값은 그룹핑 키로만 쓰고, 패치 라벨과 동일시하지 않는다.
 */
export function normalizeGameVersion(raw: string): string | null {
  const m = /(\d+)\.(\d+)/.exec(raw.replace(/^Version\s+/i, ""));
  return m ? `${m[1]}.${m[2]}` : null;
}

export function createTftClient(options: TftClientOptions): TftClient {
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

  async function request(url: string, allow404: boolean): Promise<unknown | null> {
    let retries429 = 0;
    let retries5xx = 0;
    for (;;) {
      let res: Response;
      try {
        res = await appLimiter.schedule(() => fetchImpl(url, { headers: { "X-Riot-Token": options.apiKey } }));
      } catch (error) {
        if (retries5xx >= MAX_5XX_RETRIES) {
          throw new Error(
            `TFT API network error: retry budget exhausted for ${maskedUrl(url)}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        await sleepImpl(backoffMs(retries5xx));
        retries5xx += 1;
        continue;
      }

      options.onRateLimit?.(
        { appRateLimit: res.headers.get("X-App-Rate-Limit"), appRateLimitCount: res.headers.get("X-App-Rate-Limit-Count") },
        // LoL 쪽(riot-client.ts)과 대칭 — 소비처가 이 값을 로깅해도 puuid가 새지 않게 한다.
        maskedUrl(url)
      );

      if (res.status === 404 && allow404) return null;
      if (res.status === 429) {
        if (retries429 >= MAX_429_RETRIES) {
          throw new Error(`TFT API 429: retry budget exhausted for ${maskedUrl(url)}`);
        }
        const header = res.headers.get("Retry-After");
        await sleepImpl(header ? Number(header) * 1000 : backoffMs(retries429));
        retries429 += 1;
        continue;
      }
      if (res.status === 403) {
        // 이 프로젝트에서 실제로 밟은 경로다(2026-09-20). 원인이 특정돼 있으므로 일반 오류로
        // 뭉뚱그리지 않고 조치까지 적어 준다 — 재시도해도 풀리지 않는다.
        throw new Error(
          `TFT API 403: 이 키에 TFT 제품 권한이 없다. developer.riotgames.com에서 TFT 제품을 등록하거나 ` +
            `개발 키를 재발급한다. (${maskedUrl(url)})`
        );
      }
      if (res.status >= 500) {
        if (retries5xx >= MAX_5XX_RETRIES) {
          throw new Error(`TFT API 5xx: retry budget exhausted (status=${res.status}) for ${maskedUrl(url)}`);
        }
        await sleepImpl(backoffMs(retries5xx));
        retries5xx += 1;
        continue;
      }
      if (!res.ok) {
        throw new Error(`TFT API ${res.status} ${res.statusText} for ${maskedUrl(url)}`);
      }
      return (await res.json()) as unknown;
    }
  }

  return {
    async getLeagueEntries(tier) {
      const url = `https://${options.platform}.api.riotgames.com/tft/league/v1/${tier}`;
      const body = await request(url, false);
      const entries = (body as { entries?: unknown[] } | null)?.entries ?? [];
      const out: TftLeagueEntry[] = [];
      for (const raw of entries) {
        const e = raw as { puuid?: unknown; leaguePoints?: unknown; wins?: unknown; losses?: unknown };
        if (typeof e.puuid !== "string" || e.puuid.length === 0) continue;
        out.push({
          puuid: e.puuid,
          leaguePoints: typeof e.leaguePoints === "number" ? e.leaguePoints : 0,
          wins: typeof e.wins === "number" ? e.wins : 0,
          losses: typeof e.losses === "number" ? e.losses : 0,
        });
      }
      return out;
    },

    async getMatchIdsByPuuid(puuid, opts = {}) {
      const params = new URLSearchParams();
      if (opts.startTime !== undefined) params.set("startTime", String(Math.floor(opts.startTime / 1000)));
      if (opts.endTime !== undefined) params.set("endTime", String(Math.floor(opts.endTime / 1000)));
      params.set("start", String(opts.start ?? 0));
      params.set("count", String(opts.count ?? 20));
      const url = `https://${options.region}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?${params}`;
      const body = await request(url, false);
      return Array.isArray(body) ? body.filter((x): x is string => typeof x === "string") : [];
    },

    async getMatch(matchId) {
      const url = `https://${options.region}.api.riotgames.com/tft/match/v1/matches/${matchId}`;
      const body = await request(url, true);
      return body === null ? null : readMatchEnvelope(body, matchId);
    },

    async dispose() {
      await Promise.all([appLimiter.stop({ dropWaitingJobs: true }), globalLimiter.stop({ dropWaitingJobs: true })]);
    },
  };
}
