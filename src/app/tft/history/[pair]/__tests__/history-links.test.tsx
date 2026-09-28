// src/app/tft/history/[pair]/__tests__/history-links.test.tsx
// TFT 과거 쌍 화면의 링크는 **그 쌍 안**에 머물고 **실재하는 페이지**만 가리킨다(2026-09-28, 이월 R8).
// LoL `lol/history/[pair]/__tests__/history-links.test.tsx`와 같은 모양·같은 이유 — 렌더한 `<a href>`를 모아
// (a) 과거 쌍 상세 링크가 있고 (b) 전부 그 라우트의 generateStaticParams 안이며 (c) 평소 상세로 새지 않는지 본다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/tft/history/",
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

import { AmbientProvider } from "@/components/AmbientContext";
import { listTftPairs } from "@/lib/tftData";
import { pairSlug } from "@/lib/pairRoutes";
import TftHistoryPage, { generateStaticParams as briefingParams } from "../page";
import TftHistoryComparePage, { generateStaticParams as compareParams } from "../compare/page";
import TftHistoryUnitPage, { generateStaticParams as unitParams } from "../unit/[key]/page";

const past = listTftPairs().slice(1);
const detailSlugsOf = (slug: string) => new Set(unitParams().filter((p) => p.pair === slug).map((p) => p.key));

async function hrefsOf(page: Promise<ReactElement>): Promise<string[]> {
  const { container, unmount } = render(<AmbientProvider>{await page}</AmbientProvider>);
  // `next/link`는 테스트 환경에서 후행 슬래시를 떼어 렌더한다 — 비교 전에 떼 둔다.
  const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) => (a.getAttribute("href") ?? "").replace(/\/(?=$|#)/, ""));
  unmount();
  return hrefs;
}

function checkPairLinks(hrefs: string[], slug: string) {
  const base = `/tft/history/${slug}`;
  const unit = new RegExp(`^${base.replace(/\./g, "\\.")}/unit/([^/#]+)$`);
  const linked = hrefs.map((h) => unit.exec(h)?.[1]).filter((s): s is string => s !== undefined);
  const generated = detailSlugsOf(slug);
  expect(linked.filter((s) => !generated.has(s)), `${slug}: 생성되지 않은 상세`).toEqual([]);
  expect(hrefs.filter((h) => h.startsWith("/tft/unit/")), `${slug}: 평소 상세로 새는 링크`).toEqual([]);
  expect(
    hrefs.filter((h) => h.startsWith("/tft/history/") && !h.startsWith(`${base}/`) && h !== base),
    `${slug}: 다른 쌍으로 새는 링크`
  ).toEqual([]);
  return linked;
}

describe("TFT 과거 쌍 — 정적 파라미터", () => {
  it("과거 쌍이 있고(18.1→18.2), 대조표는 브리핑과 같은 쌍을 만든다", () => {
    expect(past.map(pairSlug)).toContain("18_1-18_2");
    expect(compareParams()).toEqual(briefingParams());
    expect(briefingParams().map((p) => p.pair)).toEqual(past.map(pairSlug));
  });
  it("상세는 과거 쌍마다 그 쌍의 대상만 만든다", () => {
    expect(new Set(unitParams().map((p) => p.pair))).toEqual(new Set(past.map(pairSlug)));
    for (const pair of past) expect(detailSlugsOf(pairSlug(pair)).size, pairSlug(pair)).toBeGreaterThan(0);
  });
});

describe("TFT 과거 쌍 — 화면의 링크가 그 쌍 안에 머문다", () => {
  for (const pair of past) {
    const slug = pairSlug(pair);

    it(`${slug} 브리핑: 대상 링크가 그 쌍의 상세이고 전부 생성된다, 미공지 타일은 그 쌍의 대조표`, async () => {
      const hrefs = await hrefsOf(TftHistoryPage({ params: Promise.resolve({ pair: slug }) }));
      expect(checkPairLinks(hrefs, slug).length).toBeGreaterThan(0);
      expect(hrefs).toContain(`/tft/history/${slug}/compare#unannounced`);
      expect(hrefs.some((h) => h.startsWith("/tft/compare"))).toBe(false);
    }, 60_000);

    it(`${slug} 대조표: 표의 상세 링크가 그 쌍의 상세이고 전부 생성된다, 이동 경로는 그 쌍의 브리핑`, async () => {
      const hrefs = await hrefsOf(TftHistoryComparePage({ params: Promise.resolve({ pair: slug }) }));
      expect(checkPairLinks(hrefs, slug).length).toBeGreaterThan(0);
      expect(hrefs).toContain(`/tft/history/${slug}`);
    }, 60_000);

    it(`${slug} 상세: 그 쌍의 관측을 그리고 이동 경로가 그 쌍 안이다`, async () => {
      const key = [...detailSlugsOf(slug)][0];
      const page = TftHistoryUnitPage({ params: Promise.resolve({ pair: slug, key }) });
      const { container } = render(<AmbientProvider>{await page}</AmbientProvider>);
      expect(container.textContent).toContain(`${pair.from} → ${pair.to} · 판정`);
      const crumbs = Array.from(container.querySelectorAll("a[href]")).map((a) => (a.getAttribute("href") ?? "").replace(/\/$/, ""));
      expect(crumbs).toContain(`/tft/history/${slug}`);
      expect(crumbs).toContain(`/tft/history/${slug}/compare`);
      expect(crumbs.filter((h) => h === "/tft" || h === "/tft/compare")).toEqual([]);
    }, 60_000);
  }

  it("최신 쌍 슬러그는 과거 쌍 라우트가 그리지 않는다(평소 주소가 주인이다)", async () => {
    const latest = listTftPairs()[0];
    const page = TftHistoryPage({ params: Promise.resolve({ pair: pairSlug(latest) }) });
    const { container } = render(<AmbientProvider>{await page}</AmbientProvider>);
    expect(container.textContent).toContain("이 패치쌍의 기록이 없습니다.");
  });
});
