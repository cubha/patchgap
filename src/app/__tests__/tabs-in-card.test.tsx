// src/app/__tests__/tabs-in-card.test.tsx
// B2(2026-09-28, PR-C · 사용자 결정 D4 — TFT·PUBG를 LoL식으로): 세 게임 모두 탭 바가 **카드 안** 맨 위에 있다.
// LoL은 원래 그랬고(ReleaseNoteStream), TFT·PUBG는 탭 바가 카드 **위**에 떠 있어 탭 위치가 게임마다 달랐다.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams() }));
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

import { AmbientProvider } from "@/components/AmbientContext";
import LolPage from "../lol/page";
import TftPage from "../tft/page";
import PubgPage from "../pubg/page";

describe("탭 바는 카드 안 맨 위(세 게임 동일)", () => {
  for (const [id, Page] of [["lol", LolPage], ["tft", TftPage], ["pubg", PubgPage]] as const) {
    it(`${id}: 탭 바를 품은 카드가 패널 내용까지 품고, 탭 바가 그 카드의 첫 자식이다`, () => {
      const { container } = render(<AmbientProvider><Page /></AmbientProvider>);
      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();
      const card = tablist?.parentElement;
      expect(card?.className).toContain("panel-surface-glass");
      expect(card?.firstElementChild).toBe(tablist);
      const contentTab = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) => b.textContent?.startsWith("패치 내용"));
      fireEvent.click(contentTab as Element);
      // 패치 내용 탭의 목록(행)이 같은 카드 안에 있다.
      expect(card?.querySelectorAll("li").length ?? 0).toBeGreaterThan(0);
      // 카드 안에 또 다른 유리 카드로 탭 패널을 감싸지 않는다(카드 속 카드 금지 — 수치 축 섹션은 예외).
      const nested = Array.from(card?.querySelectorAll(".panel-surface-glass") ?? []).filter((el) => !el.textContent?.includes("잠수함"));
      expect(nested).toHaveLength(0);
    });
  }
});
