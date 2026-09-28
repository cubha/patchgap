// src/components/__tests__/header-pair-select.test.tsx
// F3(2026-09-28, 사용자 결정 D3 지금분) — 헤더 패치쌍 select는 LoL 쌍이 3개라 **열리는데 onChange가 없어**
// 골라도 아무 일도 없었다(무동작 컨트롤). 쌍별 라우트는 10/6 이후(B3) — 그 전까지는 표시 전용으로 닫고,
// 왜 닫혔는지를 말한다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/lol/", useRouter: () => ({ push: () => {} }) }));
// jsdom엔 ResizeObserver가 없다 — 헤더 높이 측정(useChromeHeight)용이라 이 검사와 무관하다.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
import Header from "../Header";

const pair = (from: string, to: string) => ({ from, to });
const chrome = {
  lol: {
    pairs: [pair("26.18", "26.19"), pair("26.17", "26.18"), pair("26.16", "26.17")],
    currentPair: pair("26.18", "26.19"),
    nBefore: 1,
    nAfter: 2,
    aggregatedAt: "2026-09-24T00:00:00Z",
    sampleChips: [],
    snapshotCaption: null,
  },
  tft: null,
  pubg: null,
};

describe("헤더 패치쌍 select — 표시 전용", () => {
  it("쌍이 여럿이어도 비활성이고, 이유를 설명과 연결한다", () => {
    const { container } = render(<Header chrome={chrome} />);
    const select = container.querySelector("select");
    expect(select?.disabled).toBe(true);
    const describedBy = select?.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(container.querySelector(`#${describedBy}`)?.textContent).toMatch(/준비 중/);
  });
});
