// src/app/__tests__/gap-tile-tab.test.tsx
// D2 10/6분(2026-09-28, PR-C) — 「미공지 Gap」 **타일과 탭이 같은 수**를 말한다: 둘 다 (통계 Gap 대상) ∪
// (수치 축 대상: 잠수함 + 값 어긋남). 전에는 타일이 통계만, 탭이 통계+잠수함이라 같은 라벨이 두 수였다
// (LoL 35 vs 36, TFT 31 vs 34). 세 게임 공용 헬퍼(`gapUnionCount`)가 소유한다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/lol/", useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams() }));

// jsdom엔 matchMedia·ResizeObserver가 없다(LoL 홈의 레이아웃 훅용) — 이 검사와 무관한 환경 보강.
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
import { AmbientProvider } from "@/components/AmbientContext";
import LolPage from "../lol/page";
import TftPage from "../tft/page";
import PubgPage from "../pubg/page";

function tileAndTab(container: HTMLElement): { tile: number; tab: number } {
  const tileLink = Array.from(container.querySelectorAll("a")).find((a) => a.textContent?.includes("미공지 Gap ↗"));
  const tabButton = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) => b.textContent?.startsWith("미공지 Gap"));
  const num = (t: string | null | undefined) => Number((t ?? "").replace(/[^\d]/g, ""));
  return { tile: num(tileLink?.querySelector("strong")?.textContent), tab: num(tabButton?.textContent) };
}

describe("미공지 Gap 타일 = 탭(합집합)", () => {
  for (const [id, Page] of [["lol", LolPage], ["tft", TftPage], ["pubg", PubgPage]] as const) {
    it(`${id}: 타일과 탭이 같은 수`, () => {
      const { container } = render(<AmbientProvider><Page /></AmbientProvider>);
      const { tile, tab } = tileAndTab(container);
      expect(tile).toBeGreaterThan(0);
      expect(tile).toBe(tab);
    });
  }
});
