// src/pipeline/collect/pubg/__tests__/api.test.ts
// 텔레메트리 호스트 허용 목록 — **자격증명이 어디로 나가는지**를 코드가 정하게 한다.
//
// 배경(2026-09-21 security-auditor): `telemetry()`가 받는 URL은 우리가 만든 것이 아니라
// `/matches/{id}` 응답이 준 것이다. 그 응답이 예상 밖 호스트를 가리키면 그대로 따라가고,
// 그때까지 `Authorization: Bearer <PUBG_API_KEY>`가 무조건 병합되고 있었다 — CDN은 인증을
// 요구하지도 않는데(api.ts 헤더 주석이 그렇게 적고 있었다).
import { describe, expect, it, vi } from "vitest";


import { PubgApi, isAllowedTelemetryHost } from "../api";

/** 호출 인자를 타입으로 붙잡기 위한 최소 시그니처 — `fetch` 전체를 흉내 내지 않는다. */
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

describe("텔레메트리 호스트 게이트", () => {
  it("PUBG CDN만 허용한다", () => {
    expect(isAllowedTelemetryHost("https://telemetry-cdn.pubg.com/bluehole-pubg/steam/2026/09/15/a.json")).toBe(true);
    expect(isAllowedTelemetryHost("https://evil.example.com/a.json")).toBe(false);
    // 서브도메인 접미 일치로 뚫리지 않는다.
    expect(isAllowedTelemetryHost("https://telemetry-cdn.pubg.com.evil.example/a.json")).toBe(false);
    // 평문 HTTP도 막는다 — 자격증명이 없더라도 본문이 그대로 노출된다.
    expect(isAllowedTelemetryHost("http://telemetry-cdn.pubg.com/a.json")).toBe(false);
    expect(isAllowedTelemetryHost("not-a-url")).toBe(false);
  });

  it("허용되지 않은 호스트는 **던진다** — 조용히 null을 주지 않는다", async () => {
    const fetchImpl = vi.fn();
    const api = new PubgApi({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(api.telemetry("https://evil.example.com/a.json")).rejects.toThrow("허용되지 않은");
    // 호출 자체가 나가지 않아야 한다(키가 실린 요청이 만들어지기 전에 막는다).
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("텔레메트리 요청에 Authorization을 붙이지 않는다", async () => {
    const fetchImpl = vi.fn<FetchLike>(() => Promise.resolve(new Response("[]", { status: 200 })));
    const api = new PubgApi({ apiKey: "secret-key", fetchImpl: fetchImpl as unknown as typeof fetch });
    await api.telemetry("https://telemetry-cdn.pubg.com/a.json");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0][1] as unknown as { headers: Record<string, string> };
    expect(Object.keys(init.headers)).toEqual(["Accept-Encoding"]);
    expect(JSON.stringify(init.headers)).not.toContain("secret-key");
  });

  it("반대로 매치 조회에는 Authorization이 붙는다", async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(new Response(JSON.stringify({ data: {}, included: [] }), { status: 200 }))
    );
    const api = new PubgApi({ apiKey: "secret-key", fetchImpl: fetchImpl as unknown as typeof fetch });
    await api.match("abc");
    const init = fetchImpl.mock.calls[0][1] as unknown as { headers: Record<string, string> };
    expect(init.headers["Authorization"]).toBe("Bearer secret-key");
  });
});
