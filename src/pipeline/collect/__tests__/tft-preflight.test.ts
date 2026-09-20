import { describe, it, expect, vi } from "vitest";

import { classifyTftPreflight, runTftPreflight } from "../tft-preflight";

describe("classifyTftPreflight — 401과 403은 조치가 다르다", () => {
  it("**401 = 개발 키 만료** → 사용자가 재발급해야 한다", () => {
    const r = classifyTftPreflight(401);
    expect(r.kind).toBe("key-expired");
    expect(r.proceed).toBe(false);
    expect(r.fatal).toBe(false);
    expect(r.message).toMatch(/재발급/);
  });

  it("**403 = 제품 미승인** → 사람이 할 일이 없다, 심사 대기다", () => {
    const r = classifyTftPreflight(403);
    expect(r.kind).toBe("product-unapproved");
    expect(r.proceed).toBe(false);
    expect(r.fatal).toBe(false);
    expect(r.message).toMatch(/승인|심사/);
  });

  it("둘 다 잡을 실패시키지 않는다 — 심사 기간 중 반복되는 빨간 X는 진짜 실패를 가린다", () => {
    expect(classifyTftPreflight(401).fatal).toBe(false);
    expect(classifyTftPreflight(403).fatal).toBe(false);
  });

  it("200이면 진행", () => {
    const r = classifyTftPreflight(200);
    expect(r.kind).toBe("ok");
    expect(r.proceed).toBe(true);
    expect(r.fatal).toBe(false);
  });

  it("**그 외는 진짜 실패다** — 조용히 삼키면 '돌고 있다'는 착각을 만든다", () => {
    for (const status of [429, 500, 502, 503]) {
      const r = classifyTftPreflight(status);
      expect(r.kind).toBe("error");
      expect(r.proceed).toBe(false);
      expect(r.fatal).toBe(true);
    }
  });

  it("메시지에 키를 싣지 않는다", () => {
    for (const status of [401, 403, 500]) {
      expect(classifyTftPreflight(status).message).not.toMatch(/RGAPI-/);
    }
  });
});

describe("runTftPreflight — 가장 싼 TFT 엔드포인트 1회", () => {
  it("challenger 리그를 친다 — 매치 조회보다 싸고 권한 신호는 같다", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response("{}", { status: 200 });
    });
    const r = await runTftPreflight({ apiKey: "k", platform: "kr", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.proceed).toBe(true);
    expect(seen[0]).toContain("/tft/league/v1/challenger");
    expect(seen[0]).toContain("kr.api.riotgames.com");
  });

  it("키는 헤더로만 간다 — URL에 싣지 않는다", async () => {
    let headerSeen: string | null = null;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      headerSeen = new Headers(init?.headers).get("X-Riot-Token");
      return new Response("{}", { status: 200 });
    });
    await runTftPreflight({ apiKey: "secret-key", platform: "kr", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(headerSeen).toBe("secret-key");
  });

  it("403이면 proceed=false이고 던지지 않는다 — 호출부가 깨끗이 스킵할 수 있어야 한다", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 403 }));
    const r = await runTftPreflight({ apiKey: "k", platform: "kr", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.kind).toBe("product-unapproved");
    expect(r.proceed).toBe(false);
  });

  it("네트워크 오류는 fatal — 권한 문제로 오인하면 안 된다", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = await runTftPreflight({ apiKey: "k", platform: "kr", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.fatal).toBe(true);
    expect(r.proceed).toBe(false);
  });
});
