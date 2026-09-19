// src/components/home/__tests__/DiscordPanel.test.tsx
// 디스코드 패널의 두 갈래(2026-09-20).
//
// 고정하는 위험은 **죽은 링크**다. 초대 상수가 비어 있는데 "방 들어가기" 버튼을 그리면
// 방문자(그리고 심사자)를 존재하지 않는 방으로 보낸다. 반대로 초대가 있는데 방법론 링크만
// 남으면 방을 열어 둔 의미가 없다. 둘 다 타입으로는 잡히지 않으므로 렌더로 못박는다.
//
// 매처는 쓰지 않고 container를 직접 querying한다 — 프로젝트 관례(render.test.tsx 주석 참고,
// vitest.setup.ts는 RTL cleanup만 등록하고 jest-dom을 붙이지 않는다).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const invite = vi.hoisted(() => ({ url: null as string | null }));
vi.mock("@/lib/links", () => ({
  get DISCORD_INVITE_URL() {
    return invite.url;
  },
}));

async function renderPanel(): Promise<HTMLElement> {
  const { default: DiscordPanel } = await import("../DiscordPanel");
  return render(<DiscordPanel generatedAt={null} />).container;
}

function linkByText(container: HTMLElement, text: string): HTMLAnchorElement | null {
  const anchors = Array.from(container.querySelectorAll("a"));
  return anchors.find((a) => a.textContent?.includes(text)) ?? null;
}

beforeEach(() => {
  vi.resetModules();
});

describe("DiscordPanel", () => {
  it("초대가 있으면 그 방으로 가는 버튼을 새 탭으로 연다", async () => {
    invite.url = "https://discord.gg/example";
    const container = await renderPanel();

    const enter = linkByText(container, "디스코드 방 들어가기");
    expect(enter).not.toBeNull();
    expect(enter?.getAttribute("href")).toBe("https://discord.gg/example");
    expect(enter?.getAttribute("target")).toBe("_blank");
    // 새 탭 링크는 반드시 noopener — 열린 방이 opener를 만질 수 없게 한다.
    expect(enter?.getAttribute("rel")).toContain("noopener");

    // 방송 규칙은 사라지지 않는다 — "무엇이 언제 나가나"는 여전히 답해야 한다.
    // href는 `toContain`으로 본다: next/link가 렌더 환경에 따라 후행 슬래시를 정규화해
    // (`/lol/methodology#discord`) 완전일치로 박으면 환경 산물을 명세로 굳히게 된다.
    const rules = linkByText(container, "무엇이 언제 나가나")?.getAttribute("href");
    expect(rules).toContain("/lol/methodology");
    expect(rules).toContain("#discord");
  });

  it("초대가 없으면 방 링크를 그리지 않는다 — 없는 방으로 보내지 않는다", async () => {
    invite.url = null;
    const container = await renderPanel();

    expect(linkByText(container, "디스코드 방 들어가기")).toBeNull();
    const rules = linkByText(container, "방송 규칙 보기")?.getAttribute("href");
    expect(rules).toContain("/lol/methodology");
    expect(rules).toContain("#discord");
  });

  it("초대가 없으면 '읽기 전용으로 열려 있습니다' 문장도 쓰지 않는다", async () => {
    invite.url = null;
    const container = await renderPanel();
    expect(container.textContent).not.toContain("읽기 전용으로 열려 있습니다");
  });
});
