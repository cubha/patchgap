import { describe, expect, it } from "vitest";

import { fetchWithRetry } from "../retry";

function scripted(steps: Array<number | Error>): { fetchImpl: typeof fetch; calls: () => number } {
  let i = 0;
  const fetchImpl = (async () => {
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step instanceof Error) throw step;
    return new Response("body", { status: step });
  }) as typeof fetch;
  return { fetchImpl, calls: () => i };
}

const noSleep = async (): Promise<void> => {};

describe("fetchWithRetry — 공개 CDN(DDragon·CDragon)의 일시 장애", () => {
  it("5xx(Cloudflare 522 실측)는 재시도해 성공 응답을 돌려준다", async () => {
    const { fetchImpl, calls } = scripted([522, 503, 200]);
    const res = await fetchWithRetry("https://x", { fetchImpl, sleepImpl: noSleep });
    expect(res.status).toBe(200);
    expect(calls()).toBe(3);
  });

  it("네트워크 오류(fetch throw)도 재시도한다", async () => {
    const { fetchImpl, calls } = scripted([new TypeError("fetch failed"), 200]);
    const res = await fetchWithRetry("https://x", { fetchImpl, sleepImpl: noSleep });
    expect(res.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it("4xx는 재시도하지 않고 그대로 돌려준다(없는 버전은 기다려도 안 생긴다)", async () => {
    const { fetchImpl, calls } = scripted([404, 200]);
    const res = await fetchWithRetry("https://x", { fetchImpl, sleepImpl: noSleep });
    expect(res.status).toBe(404);
    expect(calls()).toBe(1);
  });

  it("시도 상한을 넘으면 마지막 5xx 응답을 돌려준다(호출부가 status로 실패를 말한다)", async () => {
    const { fetchImpl, calls } = scripted([522]);
    const res = await fetchWithRetry("https://x", { fetchImpl, sleepImpl: noSleep, attempts: 3 });
    expect(res.status).toBe(522);
    expect(calls()).toBe(3);
  });

  it("시도 상한까지 네트워크 오류면 마지막 오류를 던진다", async () => {
    const { fetchImpl } = scripted([new TypeError("fetch failed")]);
    await expect(
      fetchWithRetry("https://x", { fetchImpl, sleepImpl: noSleep, attempts: 2 })
    ).rejects.toThrow("fetch failed");
  });

  it("대기는 지수 백오프다(base × 2^attempt)", async () => {
    const waits: number[] = [];
    const { fetchImpl } = scripted([500, 500, 500, 200]);
    await fetchWithRetry("https://x", {
      fetchImpl,
      sleepImpl: async (ms) => {
        waits.push(ms);
      },
      baseMs: 100,
      attempts: 4,
    });
    expect(waits).toEqual([100, 200, 400]);
  });
});
