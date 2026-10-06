// src/app/lol/history/[pair]/__tests__/history-links.test.tsx
// 과거 쌍 화면의 링크는 **그 쌍 안**에 머물고, **실재하는 페이지**만 가리킨다(2026-09-28, 이월 R8).
//
// 왜 렌더로 재나: 링크를 만드는 곳이 서버 본문(색인·타일)과 클라이언트 카드·셀(컨텍스트) 두 갈래다. 행을 돌며
// `lolEntityHref(row, base)`를 불러 보는 검사는 **컨텍스트가 실제로 걸렸는지**를 못 본다 — 페이지를 그려서 나온
// `<a href>`를 모아, (a) 과거 쌍 상세 링크가 실제로 있고 (b) 전부 그 라우트의 generateStaticParams 안이며
// (c) 평소 상세(`/lol/item/…`)로 새는 링크가 0건인지 본다. output:'export'라 (b)가 깨지면 배포본에서 곧 404다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/lol/history/",
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
// jsdom엔 matchMedia·ResizeObserver가 없다(LoL 홈의 레이아웃 훅용) — 이 검사와 무관한 환경 보강.
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

import { AmbientProvider } from "@/components/AmbientContext";
import { listPatchPairs } from "@/lib/data";
import { pairSlug } from "@/lib/pairRoutes";
import LolHistoryPage, { generateStaticParams as briefingParams } from "../page";
import LolHistoryComparePage, { generateStaticParams as compareParams } from "../compare/page";
import LolHistoryItemPage, { generateStaticParams as itemParams } from "../item/[id]/page";

const past = listPatchPairs().slice(1);
const detailSlugsOf = (slug: string) => new Set(itemParams().filter((p) => p.pair === slug).map((p) => p.id));

async function hrefsOf(page: Promise<ReactElement>): Promise<string[]> {
  const { container, unmount } = render(<AmbientProvider>{await page}</AmbientProvider>);
  // `next/link`는 테스트 환경에서 후행 슬래시를 떼어 렌더한다 — 비교 전에 떼 둔다.
  const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) => (a.getAttribute("href") ?? "").replace(/\/(?=$|#)/, ""));
  unmount();
  return hrefs;
}

function checkPairLinks(hrefs: string[], slug: string) {
  const base = `/lol/history/${slug}`;
  const item = new RegExp(`^${base.replace(/\./g, "\\.")}/item/([^/#]+)$`);
  const linked = hrefs.map((h) => item.exec(h)?.[1]).filter((s): s is string => s !== undefined);
  const generated = detailSlugsOf(slug);
  // (b) 전부 실재 — 없는 페이지를 가리키는 링크 0건.
  expect(linked.filter((s) => !generated.has(s)), `${slug}: 생성되지 않은 상세`).toEqual([]);
  // (c) 평소 상세·다른 쌍 상세로 새지 않는다.
  expect(hrefs.filter((h) => h.startsWith("/lol/item/")), `${slug}: 평소 상세로 새는 링크`).toEqual([]);
  expect(
    hrefs.filter((h) => h.startsWith("/lol/history/") && !h.startsWith(`${base}/`) && h !== base),
    `${slug}: 다른 쌍으로 새는 링크`
  ).toEqual([]);
  return linked;
}

describe("LoL 과거 쌍 — 정적 파라미터", () => {
  it("대조표는 브리핑과 같은 과거 쌍을 만들고, 과거 쌍이 있으면 placeholder가 아니다", () => {
    expect(past.length).toBeGreaterThan(0);
    expect(compareParams()).toEqual(briefingParams());
    expect(briefingParams().map((p) => p.pair)).toEqual(past.map(pairSlug));
  });
  it("상세는 과거 쌍마다 그 쌍의 대상만 만든다 — 최신 쌍은 만들지 않는다", () => {
    const params = itemParams();
    const pairsInParams = new Set(params.map((p) => p.pair));
    expect(pairsInParams).toEqual(new Set(past.map(pairSlug)));
    for (const pair of past) expect(detailSlugsOf(pairSlug(pair)).size, pairSlug(pair)).toBeGreaterThan(0);
  });
});

describe("LoL 과거 쌍 — 화면의 링크가 그 쌍 안에 머문다", () => {
  for (const pair of past) {
    const slug = pairSlug(pair);

    it(`${slug} 브리핑: 대상 링크가 그 쌍의 상세이고 전부 생성된다, 미공지 타일은 그 쌍의 대조표`, async () => {
      const hrefs = await hrefsOf(LolHistoryPage({ params: Promise.resolve({ pair: slug }) }));
      // (a) 링크가 실제로 있다 — 0건이면 위 검사들이 공회전한다.
      expect(checkPairLinks(hrefs, slug).length).toBeGreaterThan(0);
      expect(hrefs).toContain(`/lol/history/${slug}/compare#unannounced`);
      expect(hrefs.some((h) => h.startsWith("/lol/compare"))).toBe(false);
    }, 60_000);

    it(`${slug} 대조표: 표의 대상 링크가 그 쌍의 상세이고 전부 생성된다, 이동 경로는 그 쌍의 브리핑`, async () => {
      const hrefs = await hrefsOf(LolHistoryComparePage({ params: Promise.resolve({ pair: slug }) }));
      expect(checkPairLinks(hrefs, slug).length).toBeGreaterThan(0);
      expect(hrefs).toContain(`/lol/history/${slug}`);
    }, 60_000);

    it(`${slug} 상세: 그 쌍의 관측을 그리고 이동 경로가 그 쌍 안이다`, async () => {
      const id = [...detailSlugsOf(slug)][0];
      const page = LolHistoryItemPage({ params: Promise.resolve({ pair: slug, id }) });
      const { container } = render(<AmbientProvider>{await page}</AmbientProvider>);
      const text = container.textContent ?? "";
      // 2026-10-06 **명세 변경**(상세 공통 관측 섹션): 머리 문장이 「관측 N건」(숨김 상태까지 센 행 수) → 「보고할 관측 N건」
      // 또는 자격 조합이 0인 대상의 「통계 게이트 … 변화가 없습니다」로 바뀌었다. 지키는 것은 그대로 — 그 쌍을 그린다.
      expect(text).toMatch(new RegExp(`${pair.from} → ${pair.to} (보고할 관측|통계 게이트)`));
      const crumbs = Array.from(container.querySelectorAll("a[href]")).map((a) => (a.getAttribute("href") ?? "").replace(/\/$/, ""));
      expect(crumbs).toContain(`/lol/history/${slug}`);
      expect(crumbs).toContain(`/lol/history/${slug}/compare`);
      expect(crumbs.filter((h) => h === "/lol" || h === "/lol/compare")).toEqual([]);
    }, 60_000);
  }

  it("최신 쌍 슬러그는 과거 쌍 라우트가 그리지 않는다(평소 주소가 주인이다)", async () => {
    const latest = listPatchPairs()[0];
    const page = LolHistoryComparePage({ params: Promise.resolve({ pair: pairSlug(latest) }) });
    const { container } = render(<AmbientProvider>{await page}</AmbientProvider>);
    expect(container.textContent).toContain("이 패치쌍의 기록이 없습니다.");
  });
});
