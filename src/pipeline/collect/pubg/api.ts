// src/pipeline/collect/pubg/api.ts
// PUBG API 클라이언트 — **PUBG 외부 호출이 발생하는 유일한 계층**(CLAUDE.md 디렉토리 규칙:
// `src/pipeline/collect/*`만 외부 API를 친다).
//
// 세 엔드포인트만 쓴다:
//   GET /shards/steam/samples?filter[createdAt-start]={day}  — 그날의 무작위 매치 id 묶음
//   GET /shards/steam/matches/{id}                            — 매치 속성 + 텔레메트리 asset URL
//   GET {telemetry URL}                                       — 이벤트 원본(gzip, CDN·인증 없음)
//
// **리밋이 엔드포인트마다 다르다**(2026-09-16 실측, harvest.py 주석): `/samples`는 10 RPM이라
// 7초 간격으로 부르고, `/matches/{id}`는 문서·실측 모두 제한이 없어 동시 호출한다. 텔레메트리
// CDN도 제한이 없다. 그래서 `bottleneck` 2단 체이닝(Riot 쪽 규약)을 그대로 가져오지 않는다 —
// 제한이 있는 호출이 하루 10여 건뿐이라 스케줄러를 얹으면 읽기만 어려워진다.
//
// 336시간(14일) 보존창: 텔레메트리는 매치 생성 후 336시간이 지나면 CDN에서 사라진다. 그래서
// 수집은 "패치가 끝난 뒤 한가하게"가 아니라 **창 안에** 돌아야 한다(patch-calendar.ts가 그 판정).

import zlib from "node:zlib";
import type { TelemetryEvent } from "./telemetry-reduce";

export const PUBG_BASE = "https://api.pubg.com/shards";
/** `/samples` 리밋 10 RPM에 맞춘 호출 간격(여유 1초 포함). */
export const SAMPLES_INTERVAL_MS = 7_000;
/** 텔레메트리 보존창 — 이보다 오래된 매치는 CDN에서 404다. */
export const TELEMETRY_RETENTION_HOURS = 336;

/**
 * 텔레메트리 CDN 호스트 허용 목록.
 *
 * **왜 필요한가**(2026-09-21 security-auditor 지적): `telemetry()`가 받는 URL은 우리가 만든 것이
 * 아니라 `/matches/{id}` 응답이 준 것이다. 그 응답은 인증된 1st-party API에서 TLS로 오지만,
 * 공격자가 조작할 수 없다는 것이 **호스트를 확인하지 않아도 된다는 뜻은 아니다** — 응답이
 * 예상 밖 호스트를 가리키면 그대로 따라간다. 여기서 막는다.
 */
const TELEMETRY_HOSTS: readonly string[] = ["telemetry-cdn.pubg.com"];

export function isAllowedTelemetryHost(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    return TELEMETRY_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

export interface PubgApiOptions {
  apiKey: string;
  /** 플랫폼 샤드. 이 프로젝트는 steam만 본다(표본 정의에 그렇게 적혀 있다). */
  shard?: string;
  fetchImpl?: typeof fetch;
  /** 테스트에서 실제로 기다리지 않게 하려고 주입한다. */
  sleepImpl?: (ms: number) => Promise<void>;
}

export interface PubgMatchResponse {
  data: {
    attributes: {
      createdAt: string | null;
      mapName: string | null;
      gameMode: string | null;
      duration: number | null;
    };
  };
  included: Array<{ type: string; attributes: Record<string, unknown> }>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 텔레메트리 asset URL — 없으면 null(그 매치는 축약할 수 없다). */
export function telemetryUrlOf(match: PubgMatchResponse): string | null {
  for (const item of match.included) {
    if (item.type !== "asset") continue;
    if (item.attributes["name"] !== "telemetry") continue;
    const url = item.attributes["URL"];
    if (typeof url === "string" && url.length > 0) return url;
  }
  return null;
}

export class PubgApi {
  private readonly apiKey: string;
  private readonly shard: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private lastSampleAt = 0;

  constructor(options: PubgApiOptions) {
    if (!options.apiKey) throw new Error("PubgApi: apiKey가 비어 있다(PUBG_API_KEY).");
    this.apiKey = options.apiKey;
    this.shard = options.shard ?? "steam";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? sleep;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, Accept: "application/vnd.api+json" };
  }

  /**
   * 429는 `Retry-After`를 지켜 재시도하고, 그 외 5xx·네트워크 오류는 지수 대기로 재시도한다.
   * 404·400은 **재시도하지 않는다** — 그 매치가 없다는 사실이지 일시 오류가 아니다.
   */
  private async request(
    url: string,
    extraHeaders: Record<string, string> = {},
    retries = 4,
    /** false면 `Authorization`을 붙이지 않는다 — 텔레메트리 CDN이 그 경우다(인증 불필요). */
    authenticated = true
  ): Promise<Response | null> {
    for (let attempt = 0; attempt < retries; attempt += 1) {
      let res: Response;
      try {
        const headers = authenticated ? { ...this.headers(), ...extraHeaders } : { ...extraHeaders };
        res = await this.fetchImpl(url, { headers });
      } catch {
        await this.sleepImpl(2_000 * (attempt + 1));
        continue;
      }
      if (res.status === 429) {
        const after = Number(res.headers.get("retry-after") ?? 6);
        await this.sleepImpl((Number.isFinite(after) ? after : 6) * 1000 + 1000);
        continue;
      }
      if (res.status === 404 || res.status === 400) return null;
      if (res.ok) return res;
      await this.sleepImpl(2_000 * (attempt + 1));
    }
    return null;
  }

  /**
   * 그날(UTC) 생성된 매치의 무작위 표본 id. **표본 정의가 여기서 정해진다** — 우리가 고르는
   * 것이 아니라 PUBG가 주는 무작위 묶음이고, 그 안에는 비경쟁 매치(airoyale·competitive 등)가
   * 절반가량 섞여 있다(집계가 `matchType === "official"`로 거른다).
   */
  async sampleMatchIds(dayIso: string): Promise<string[]> {
    const wait = SAMPLES_INTERVAL_MS - (Date.now() - this.lastSampleAt);
    if (this.lastSampleAt > 0 && wait > 0) await this.sleepImpl(wait);
    this.lastSampleAt = Date.now();

    const url = `${PUBG_BASE}/${this.shard}/samples?filter[createdAt-start]=${dayIso}T00:00:00Z`;
    const res = await this.request(url);
    if (!res) return [];
    const body = (await res.json()) as {
      data?: { relationships?: { matches?: { data?: Array<{ id: string }> } } };
    };
    return (body.data?.relationships?.matches?.data ?? []).map((m) => m.id);
  }

  /** 매치 1건. 없으면 null(404). */
  async match(matchId: string): Promise<PubgMatchResponse | null> {
    const res = await this.request(`${PUBG_BASE}/${this.shard}/matches/${matchId}`);
    if (!res) return null;
    return (await res.json()) as PubgMatchResponse;
  }

  /**
   * 텔레메트리 이벤트 배열. gzip으로 오는데 `Accept-Encoding: identity`를 줘도 CDN이 gzip 본문을
   * 그대로 주는 경우가 있어 **양쪽을 다 처리한다**(Python 원본이 gzip.decompress를 무조건 걸던
   * 자리다 — fetch는 투명 해제를 하기도 해서 무조건 풀면 깨진다).
   *
   * **API 키를 붙이지 않는다**(2026-09-21). CDN은 인증을 요구하지 않는데 헤더만 따라가면,
   * `/samples`·`/matches`와 **다른 호스트**로 자격증명이 나가는 셈이다. 호스트도 함께 확인한다.
   */
  async telemetry(url: string): Promise<TelemetryEvent[] | null> {
    if (!isAllowedTelemetryHost(url)) {
      throw new Error(`PubgApi.telemetry: 허용되지 않은 텔레메트리 호스트 — ${new URL(url).hostname}`);
    }
    const res = await this.request(url, { "Accept-Encoding": "identity" }, 4, false);
    if (!res) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    let text: string;
    try {
      text = zlib.gunzipSync(buffer).toString("utf8");
    } catch {
      text = buffer.toString("utf8");
    }
    return JSON.parse(text) as TelemetryEvent[];
  }
}
