// src/app/__tests__/gap-tile-tab.test.tsx
// D2 10/6분(2026-09-28, PR-C) — 「미공지 Gap」 **타일과 탭이 같은 수**를 말한다: 둘 다 (통계 Gap 대상) ∪
// (수치 축 대상: 잠수함 + 값 어긋남). 전에는 타일이 통계만, 탭이 통계+잠수함이라 같은 라벨이 두 수였다
// (LoL 35 vs 36, TFT 31 vs 34). 랜딩 카드도 같은 수 — `lib/gapTotals`가 소유한다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/lol/", useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams() }));

// jsdom엔 matchMedia·ResizeObserver가 없다(LoL 홈의 레이아웃 훅용) — 이 검사와 무관한 환경 보강.
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
import { AmbientProvider } from "@/components/AmbientContext";
import { landingCards } from "@/lib/landing";
import { latestObservedPair, observedBriefing } from "./observed-briefing";

function tileAndTab(container: HTMLElement): { tile: number; tab: number } {
  const tileLink = Array.from(container.querySelectorAll("a")).find((a) => a.textContent?.includes("미공지 Gap ↗"));
  const tabButton = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) => b.textContent?.startsWith("미공지 Gap"));
  const num = (t: string | null | undefined) => Number((t ?? "").replace(/[^\d]/g, ""));
  return { tile: num(tileLink?.querySelector("strong")?.textContent), tab: num(tabButton?.textContent) };
}

describe("미공지 Gap 타일 = 탭(합집합)", () => {
  // 최신 쌍이 선언 중이면 그 직전 관측 쌍으로 검사한다(`observed-briefing.tsx` — 10/7 TFT 18.4).
  for (const id of ["lol", "tft", "pubg"] as const) {
    it(`${id}: 타일과 탭이 같은 수`, async () => {
      const { container } = render(<AmbientProvider>{await observedBriefing(id)}</AmbientProvider>);
      const { tile, tab } = tileAndTab(container);
      expect(tile).toBeGreaterThan(0);
      expect(tile).toBe(tab);
      // 랜딩 카드도 같은 라벨(`TILE_LABELS.gap`)을 쓴다 — 같은 수여야 한다(`lib/gapTotals` 단일 소유).
      // 랜딩 카드는 **최신** 쌍을 말하므로, 최신이 선언 중이면 비교 대상이 아니다(그때 카드는 「—」=null).
      const latestIsObserved = id === "pubg" || latestObservedPair(id)?.isLatest === true;
      const card = landingCards().find((c) => c.id === id);
      expect(card?.unannounced).toBe(latestIsObserved ? tile : null);
    });
  }
});
