// src/components/home/__tests__/MobileActionBar.test.tsx
// 모바일 고정 하단 CTA(PLAN-mobile-cta-2026-10-08 ST-1). 고정하는 위험은 사이드 패널과 같다 — **죽은 링크**와
// **다른 버튼**. 초대가 있으면 그 방으로, 없으면 방송 규칙(방법론)으로; 어느 쪽이든 사이드 `DiscordPanel`과 글자·주소가
// 같아야 한다(UI 게이트 D-UX-01은 같은 라벨 반복을 1로 센다 — 라벨이 어긋나면 주 행동이 둘이 된다).
// 매처는 쓰지 않고 container를 직접 querying한다(프로젝트 관례, DiscordPanel.test 참고).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const invite = vi.hoisted(() => ({ url: null as string | null }));
vi.mock("@/lib/links", () => ({
  get DISCORD_INVITE_URL() {
    return invite.url;
  },
}));

async function renderBar(): Promise<HTMLElement> {
  const { default: MobileActionBar } = await import("../MobileActionBar");
  return render(<MobileActionBar game="tft" />).container;
}

async function renderPanel(): Promise<HTMLElement> {
  const { default: DiscordPanel } = await import("../DiscordPanel");
  return render(<DiscordPanel game="tft" generatedAt={null} />).container;
}

function onlyLink(container: HTMLElement): HTMLAnchorElement {
  const anchors = Array.from(container.querySelectorAll("a"));
  expect(anchors).toHaveLength(1);
  return anchors[0];
}

beforeEach(() => {
  vi.resetModules();
});

describe("MobileActionBar", () => {
  it("초대가 있으면 사이드 패널과 같은 글자·주소로 그 방에 들어간다", async () => {
    invite.url = "https://discord.gg/example";
    const bar = onlyLink(await renderBar());
    expect(bar.textContent).toContain("디스코드 방 들어가기 →");
    expect(bar.getAttribute("href")).toBe("https://discord.gg/example");
    const panel = Array.from((await renderPanel()).querySelectorAll("a")).find((a) =>
      a.textContent?.includes("디스코드 방 들어가기")
    );
    expect(panel?.getAttribute("href")).toBe(bar.getAttribute("href"));
  });

  it("초대가 없으면 그 게임의 방송 규칙으로 보낸다 — 죽은 링크를 만들지 않는다", async () => {
    invite.url = null;
    const bar = onlyLink(await renderBar());
    expect(bar.textContent).toContain("방송 규칙 보기 →");
    // 트레일링 슬래시는 Next 설정의 산물이라 완전일치로 박지 않는다(DiscordPanel.test과 같은 이유).
    const rules = bar.getAttribute("href") ?? "";
    expect(rules).toContain("/tft/methodology");
    expect(rules).toContain("#discord");
  });

  it("모바일 전용이다 — lg 이상에서 숨고, 푸터를 가리지 않게 같은 높이의 여백을 둔다", async () => {
    invite.url = "https://discord.gg/example";
    const container = await renderBar();
    const nav = container.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe("주 행동");
    expect(nav?.className).toContain("fixed");
    expect(nav?.className).toContain("lg:hidden");
    const spacer = container.querySelector("[data-mobile-action-spacer]");
    expect(spacer?.className).toContain("lg:hidden");
  });
});
