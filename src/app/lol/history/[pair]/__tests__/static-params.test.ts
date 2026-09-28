// src/app/lol/history/[pair]/__tests__/static-params.test.ts
// 헤더 select가 보내는 모든 과거 쌍 주소가 **정적 산출물로 실재**한다(2026-09-28, PR-C Phase 3 scope-critic).
// output:'export'라 generateStaticParams에 없는 슬러그는 배포본에서 곧 404다 — select 목록(listPatchPairs)과
// 라우트 목록이 갈리면 조용히 깨진다.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listPatchPairs } from "@/lib/data";
import { lolPairHref } from "@/lib/pairRoutes";
import { generateStaticParams } from "../page";

describe("과거 쌍 라우트 = select 목적지", () => {
  it("select의 모든 과거 쌍 href가 generateStaticParams에 있다", () => {
    const pairs = listPatchPairs();
    const slugs = new Set(generateStaticParams().map((p) => p.pair));
    const targets = pairs.map((pair) => lolPairHref(pair, pairs)).filter((href) => href !== "/lol/");
    expect(targets.length).toBeGreaterThan(0);
    for (const href of targets) {
      const slug = href.replace(/^\/lol\/history\//, "").replace(/\/$/, "");
      expect(slugs.has(slug), href).toBe(true);
    }
  });
});
