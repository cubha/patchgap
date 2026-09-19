// src/app/__tests__/legacy-redirects.test.ts
// 구 경로 리다이렉트 계약(2026-09-19).
//
// 왜 기계가 세는가: LoL이 `/lol` 접두를 받으면서 이미 공유된 `/compare/`·`/item/{id}/`·
// `/methodology/` 링크가 전부 죽는다. `output:'export'`라 Next 런타임 리다이렉트를 못 쓰므로
// **유일한 안전장치가 `vercel.json`의 redirects 한 곳**이고, 그것이 지워지거나 경로가 또
// 바뀌었을 때 아무 게이트도 울리지 않으면 심사 기간에 그대로 404가 나간다(대회 규정상
// "심사 기간 링크 미작동 시 평가 제외"). 산문 규칙은 드리프트하므로 여기서 센다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
}

interface VercelConfig {
  redirects?: VercelRedirect[];
  trailingSlash?: boolean;
}

const config = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
) as VercelConfig;

const redirects = config.redirects ?? [];

/** 구 경로 → 기대 착지점. 접두만 붙고 나머지 경로는 보존되어야 한다. */
const LEGACY = [
  { source: "/compare", lands: "/lol/compare" },
  { source: "/methodology", lands: "/lol/methodology" },
  { source: "/item/:slug", lands: "/lol/item/:slug" },
] as const;

describe("vercel.json redirects — 구 링크 보전", () => {
  it("리다이렉트 목록이 비어 있지 않다", () => {
    expect(redirects.length).toBeGreaterThan(0);
  });

  it("구 3경로가 전부 /lol 접두로 넘어간다", () => {
    for (const legacy of LEGACY) {
      const hit = redirects.find((r) => r.source === legacy.source || r.source === `${legacy.source}/`);
      expect(hit, `${legacy.source} 리다이렉트 없음`).toBeDefined();
      expect(hit?.destination.startsWith(legacy.lands), legacy.source).toBe(true);
    }
  });

  it("항목 상세는 슬러그를 보존한다 — 상세 링크가 목록으로 떨어지면 안 된다", () => {
    const item = redirects.find((r) => r.source.startsWith("/item/"));
    expect(item?.source).toContain(":");
    expect(item?.destination).toContain(":");
  });

  it("영구(301)가 아니다 — 되돌릴 여지를 남긴다(브라우저 영구 캐시 방지)", () => {
    for (const r of redirects) {
      expect(r.permanent ?? false, r.source).toBe(false);
    }
  });

  it("랜딩(`/`)과 헬스체크는 리다이렉트 대상이 아니다 — UptimeRobot이 루트 정적 파일을 본다", () => {
    for (const r of redirects) {
      expect(r.source, "루트를 넘기면 랜딩이 사라진다").not.toBe("/");
      expect(r.source).not.toContain("health.txt");
    }
  });

  it("목적지가 전부 실재하는 라우트 접두를 가리킨다", () => {
    for (const r of redirects) {
      expect(r.destination.startsWith("/lol/") || r.destination.startsWith("/pubg/"), r.source).toBe(
        true
      );
    }
  });
});
