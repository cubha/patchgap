import { describe, it, expect, vi } from "vitest";

import { createTftClient, maskedUrl, normalizeGameVersion, readMatchEnvelope, type TftClient } from "../tft-client";

const FAST = { appLimiterOptions: { minTime: 0, maxConcurrent: 8 }, globalLimiterOptions: { reservoir: 10_000 } };

function client(fetchImpl: typeof fetch, sleepImpl = vi.fn(async () => {})): TftClient {
  return createTftClient({ apiKey: "k", platform: "kr", region: "asia", fetchImpl, sleepImpl, ...FAST });
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

describe("maskedUrl — 로그에 PII를 남기지 않는다", () => {
  const PUUID = "5I8XpVPd0YWNz39J4jMH3YezaaOgE4Tg9_H6RFEViiCkYFLgqMglocPRQ2B";

  it("**경로의 puuid를 가린다** — 쿼리가 아니라 경로라 `?` 자르기로는 안 지워진다", () => {
    const url = `https://asia.api.riotgames.com/tft/match/v1/matches/by-puuid/${PUUID}/ids?start=0&count=200`;
    const masked = maskedUrl(url);
    expect(masked).not.toContain(PUUID);
    expect(masked).toBe("https://asia.api.riotgames.com/tft/match/v1/matches/by-puuid/***/ids");
  });

  it("쿼리스트링은 그대로 떼어낸다", () => {
    expect(maskedUrl("https://x/a/b?c=1")).toBe("https://x/a/b");
    expect(maskedUrl("https://x/a/b")).toBe("https://x/a/b");
  });
});

describe("오류 메시지에 puuid가 실리지 않는다", () => {
  it("429 예산 소진 메시지", async () => {
    const PUUID = "SECRET_PUUID_VALUE";
    const c = client(async () => new Response("", { status: 429, headers: { "Retry-After": "0" } }), vi.fn(async () => {}));
    await expect(c.getMatchIdsByPuuid(PUUID)).rejects.toThrow(/429/);
    await expect(c.getMatchIdsByPuuid(PUUID)).rejects.not.toThrow(new RegExp(PUUID));
    await c.dispose();
  });
});

describe("normalizeGameVersion", () => {
  it("클라이언트 버전 문자열에서 주·부 버전만 뽑는다", () => {
    expect(normalizeGameVersion("Version 16.18.679.1234 (Sep 09 2026)")).toBe("16.18");
    expect(normalizeGameVersion("16.18.679.1234")).toBe("16.18");
  });

  it("못 읽으면 null — 빈 문자열로 뭉개지 않는다", () => {
    expect(normalizeGameVersion("알 수 없음")).toBeNull();
  });
});

describe("readMatchEnvelope", () => {
  it("제어에 쓰는 두 필드만 좁히고 원본을 보존한다", () => {
    const raw = { metadata: { match_id: "KR_1" }, info: { game_datetime: 1_700_000_000_000, game_version: "Version 16.18.1", participants: [1, 2] } };
    const env = readMatchEnvelope(raw, "fallback");
    expect(env.matchId).toBe("KR_1");
    expect(env.gameDatetime).toBe(1_700_000_000_000);
    expect(env.raw).toBe(raw);
  });

  it("형태가 달라도 던지지 않고 fallback id를 쓴다 — 실응답을 아직 못 봤다", () => {
    const env = readMatchEnvelope({ unexpected: true }, "KR_2");
    expect(env.matchId).toBe("KR_2");
    expect(Number.isNaN(env.gameDatetime)).toBe(true);
    expect(env.gameVersion).toBe("");
  });
});

describe("createTftClient — 리그/매치", () => {
  it("puuid 없는 엔트리는 버린다", async () => {
    const c = client(async () => json({ entries: [{ puuid: "p1", leaguePoints: 900 }, { leaguePoints: 800 }] }));
    await expect(c.getLeagueEntries("challenger")).resolves.toEqual([
      { puuid: "p1", leaguePoints: 900, wins: 0, losses: 0 },
    ]);
    await c.dispose();
  });

  it("매치 ID 조회는 초 단위 시각으로 변환해 보낸다", async () => {
    const seen: string[] = [];
    const c = client(async (input) => {
      seen.push(String(input));
      return json(["KR_1", 42, "KR_2"]);
    });
    await expect(
      c.getMatchIdsByPuuid("p1", { startTime: 1_700_000_000_000, count: 50 })
    ).resolves.toEqual(["KR_1", "KR_2"]);
    expect(seen[0]).toContain("startTime=1700000000");
    expect(seen[0]).toContain("count=50");
    await c.dispose();
  });

  it("404 매치는 null — 던지지 않는다", async () => {
    const c = client(async () => new Response("", { status: 404 }));
    await expect(c.getMatch("KR_X")).resolves.toBeNull();
    await c.dispose();
  });
});

describe("createTftClient — 오류 처리", () => {
  it("429는 Retry-After만큼 쉬고 재시도한다", async () => {
    const sleep = vi.fn(async () => {});
    let n = 0;
    const c = client(async () => {
      n += 1;
      return n === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "2" } })
        : json({ metadata: { match_id: "KR_1" }, info: { game_datetime: 1, game_version: "Version 16.18.1" } });
    }, sleep);
    await expect(c.getMatch("KR_1")).resolves.toMatchObject({ matchId: "KR_1" });
    expect(sleep).toHaveBeenCalledWith(2000);
    await c.dispose();
  });

  it("403은 재시도하지 않고 조치까지 알려준다 — 재시도해도 안 풀린다", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const c = client(async () => {
      calls += 1;
      return new Response(JSON.stringify({ status: { status_code: 403 } }), { status: 403 });
    }, sleep);
    await expect(c.getLeagueEntries("challenger")).rejects.toThrow(/TFT 제품 권한/);
    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
    await c.dispose();
  });

  it("5xx는 예산 소진까지 재시도한 뒤 던진다", async () => {
    const c = client(async () => new Response("", { status: 503 }));
    await expect(c.getLeagueEntries("challenger")).rejects.toThrow(/5xx/);
    await c.dispose();
  });

  it("API 키를 오류 메시지에 싣지 않는다", async () => {
    const c = client(async () => new Response("", { status: 400, statusText: "Bad Request" }));
    await expect(c.getLeagueEntries("challenger")).rejects.toThrow(/400/);
    await expect(c.getLeagueEntries("challenger")).rejects.not.toThrow(/k$/);
    await c.dispose();
  });
});
