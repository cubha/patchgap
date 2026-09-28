// src/components/__tests__/header-pair-select.test.tsx
// 헤더 패치쌍 select.
//  - F3(2026-09-28, D3 지금분): 쌍별 라우트가 없을 때는 표시 전용으로 닫고 이유를 말했다.
//  - B3(2026-09-28, D3 10/6분 — 명세 변경): LoL은 과거 쌍 라우트(`/lol/history/[pair]/`)가 생겨 **실제로 이동**한다.
//    라우트가 없는 게임(쌍이 하나)은 여전히 닫혀 있고 이유를 말한다.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const push = vi.fn();
let pathname = "/lol/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push }) }));
// jsdom엔 ResizeObserver가 없다 — 헤더 높이 측정(useChromeHeight)용이라 이 검사와 무관하다.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
import Header from "../Header";

const pair = (from: string, to: string) => ({ from, to });
const lolChrome = {
  pairs: [pair("26.18", "26.19"), pair("26.17", "26.18"), pair("26.16", "26.17")],
  currentPair: pair("26.18", "26.19"),
  nBefore: 1,
  nAfter: 2,
  aggregatedAt: "2026-09-24T00:00:00Z",
  sampleChips: [],
  snapshotCaption: null,
};
const tftChrome = { ...lolChrome, pairs: [pair("18.2", "18.3")], currentPair: pair("18.2", "18.3") };

describe("헤더 패치쌍 select", () => {
  it("LoL: 쌍이 여럿이면 열리고, 과거 쌍을 고르면 그 쌍의 라우트로 간다", () => {
    pathname = "/lol/";
    push.mockClear();
    const { container } = render(<Header chrome={{ lol: lolChrome, tft: null, pubg: null }} />);
    const select = container.querySelector("select[aria-describedby=\"pair-select-hint\"]") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    fireEvent.change(select, { target: { value: "1" } });
    expect(push).toHaveBeenCalledWith("/lol/history/26.17-26.18/");
  });
  it("LoL 과거 쌍 경로에서는 그 쌍이 선택돼 있고, 최신 쌍을 고르면 브리핑 홈으로 간다", () => {
    pathname = "/lol/history/26.16-26.17/";
    push.mockClear();
    const { container } = render(<Header chrome={{ lol: lolChrome, tft: null, pubg: null }} />);
    const select = container.querySelector("select[aria-describedby=\"pair-select-hint\"]") as HTMLSelectElement;
    expect(select.value).toBe("2");
    fireEvent.change(select, { target: { value: "0" } });
    expect(push).toHaveBeenCalledWith("/lol/");
  });
  it("쌍이 하나뿐인 게임은 닫혀 있고 이유를 설명과 연결한다", () => {
    pathname = "/tft/";
    const { container } = render(<Header chrome={{ lol: lolChrome, tft: tftChrome, pubg: null }} />);
    const select = container.querySelector("select[aria-describedby=\"pair-select-hint\"]") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    const describedBy = select.getAttribute("aria-describedby");
    expect(container.querySelector(`#${describedBy}`)?.textContent).toMatch(/하나뿐/);
  });
  // 2026-09-28 이월 R16: 닫힌 이유가 title(hover)뿐이면 터치 화면에서 안 보인다.
  it("닫힌 select의 이유는 모바일에서 글로 보이고(md 이상만 sr-only), 라벨 밖이라 접근성 이름에 섞이지 않는다", () => {
    pathname = "/tft/";
    const { container } = render(<Header chrome={{ lol: lolChrome, tft: tftChrome, pubg: null }} />);
    const hint = container.querySelector("#pair-select-hint") as HTMLElement;
    expect(hint.className.split(/\s+/)).not.toContain("sr-only");
    expect(hint.className.split(/\s+/)).toContain("md:sr-only");
    expect(hint.closest("label")).toBeNull();
  });
  it("열린 select(LoL)의 안내는 스크린리더 전용이다 — 조작 가능한 컨트롤 옆에 글을 늘어놓지 않는다", () => {
    pathname = "/lol/";
    const { container } = render(<Header chrome={{ lol: lolChrome, tft: null, pubg: null }} />);
    expect((container.querySelector("#pair-select-hint") as HTMLElement).className).toBe("sr-only");
  });
});
