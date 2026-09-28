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

// 2026-09-28 이월 R8: 과거 쌍 **아래** 경로(대조표·상세)와 TFT 과거 쌍. 쌍 맥락이 헤더에서 끊기지 않는다 —
// 내비 링크·select 이동·활성 탭이 지금 보는 쌍 안에 머문다.
const tftTwoPairs = { ...lolChrome, pairs: [pair("18.2", "18.3"), pair("18.1", "18.2")], currentPair: pair("18.2", "18.3") };

function renderAt(path: string, chrome: Parameters<typeof Header>[0]["chrome"]) {
  pathname = path;
  push.mockClear();
  const { container } = render(<Header chrome={chrome} />);
  const select = container.querySelector("select[aria-describedby=\"pair-select-hint\"]") as HTMLSelectElement;
  // `next/link`는 테스트 환경(trailingSlash 설정 없음)에서 후행 슬래시를 떼어 렌더한다 — 비교는 그것을 떼고 한다.
  const nav = (label: string) => {
    const a = Array.from(container.querySelectorAll("nav a")).find((el) => el.textContent === label);
    return { href: (a?.getAttribute("href") ?? "").replace(/\/$/, ""), current: a?.getAttribute("aria-current") ?? null };
  };
  return { container, select, nav };
}

describe("헤더 — 과거 쌍 하위 경로(이월 R8)", () => {
  const lolOnly = { lol: lolChrome, tft: null, pubg: null };

  it("LoL 과거 쌍 대조표: 그 쌍이 선택돼 있고, 대조표 탭이 활성이며, 다른 쌍을 고르면 그 쌍의 대조표로 간다", () => {
    const { select, nav } = renderAt("/lol/history/26.16-26.17/compare/", lolOnly);
    expect(select.value).toBe("2");
    expect(nav("대조표").current).toBe("page");
    fireEvent.change(select, { target: { value: "1" } });
    expect(push).toHaveBeenCalledWith("/lol/history/26.17-26.18/compare/");
    fireEvent.change(select, { target: { value: "0" } });
    expect(push).toHaveBeenLastCalledWith("/lol/compare/");
  });

  it("LoL 과거 쌍 화면의 내비는 그 쌍 안에 머문다 — 방법론만 평소 주소", () => {
    const { nav } = renderAt("/lol/history/26.16-26.17/item/champion~Ahri/", lolOnly);
    expect(nav("브리핑").href).toBe("/lol/history/26.16-26.17");
    expect(nav("대조표").href).toBe("/lol/history/26.16-26.17/compare");
    expect(nav("방법론").href).toBe("/lol/methodology");
  });

  it("LoL 과거 쌍 상세에서 쌍을 바꾸면 그 쌍의 브리핑으로 간다 — 그 쌍에 없을 수 있는 상세로 보내지 않는다", () => {
    const { select } = renderAt("/lol/history/26.16-26.17/item/champion~Ahri/", lolOnly);
    expect(select.value).toBe("2");
    fireEvent.change(select, { target: { value: "1" } });
    expect(push).toHaveBeenCalledWith("/lol/history/26.17-26.18/");
    fireEvent.change(select, { target: { value: "0" } });
    expect(push).toHaveBeenLastCalledWith("/lol/");
  });

  it("LoL 최신 대조표에서 과거 쌍을 고르면 그 쌍의 대조표로 간다(같은 섹션)", () => {
    const { select, container } = renderAt("/lol/compare/", lolOnly);
    fireEvent.change(select, { target: { value: "2" } });
    expect(push).toHaveBeenCalledWith("/lol/history/26.16-26.17/compare/");
    expect(container.querySelector("#pair-select-hint")?.textContent).toMatch(/대조표로 이동/);
  });

  it("평소 경로의 내비는 예전 그대로다", () => {
    const { nav } = renderAt("/lol/", lolOnly);
    expect(nav("브리핑").href).toBe("/lol");
    expect(nav("대조표").href).toBe("/lol/compare");
  });

  it("TFT: 쌍이 둘이면 열리고, 과거 쌍을 고르면 그 쌍의 브리핑으로 간다", () => {
    const { select, container } = renderAt("/tft/", { lol: lolChrome, tft: tftTwoPairs, pubg: null });
    expect(select.disabled).toBe(false);
    expect((container.querySelector("#pair-select-hint") as HTMLElement).className).toBe("sr-only");
    fireEvent.change(select, { target: { value: "1" } });
    expect(push).toHaveBeenCalledWith("/tft/history/18.1-18.2/");
  });

  it("TFT 과거 쌍 대조표·상세: 그 쌍이 선택되고, 내비·이동이 쌍 규칙을 따른다", () => {
    const chrome = { lol: lolChrome, tft: tftTwoPairs, pubg: null };
    const compare = renderAt("/tft/history/18.1-18.2/compare/", chrome);
    expect(compare.select.value).toBe("1");
    expect(compare.nav("브리핑").href).toBe("/tft/history/18.1-18.2");
    fireEvent.change(compare.select, { target: { value: "0" } });
    expect(push).toHaveBeenCalledWith("/tft/compare/");

    const unit = renderAt("/tft/history/18.1-18.2/unit/unit~DA_18_Rakan/", chrome);
    expect(unit.select.value).toBe("1");
    expect(unit.nav("대조표").href).toBe("/tft/history/18.1-18.2/compare");
    fireEvent.change(unit.select, { target: { value: "0" } });
    expect(push).toHaveBeenCalledWith("/tft/");
  });

  it("쌍이 여럿이어도 라우트가 없는 게임은 닫히고, 이유가 「LoL에서만」이라고 말하지 않는다", () => {
    const pubgTwo = { ...lolChrome, pairs: [pair("43.1", "43.2"), pair("43.0", "43.1")], currentPair: pair("43.1", "43.2") };
    const { select, container } = renderAt("/pubg/", { lol: lolChrome, tft: null, pubg: pubgTwo });
    expect(select.disabled).toBe(true);
    const hint = container.querySelector("#pair-select-hint")?.textContent ?? "";
    expect(hint).not.toMatch(/리그 오브 레전드/);
    expect(hint).toMatch(/제공하지 않습니다/);
  });
});
