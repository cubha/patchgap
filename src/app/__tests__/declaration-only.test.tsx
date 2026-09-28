// src/app/__tests__/declaration-only.test.tsx
// C13·C14(2026-09-28, 사용자 결정 D5·D6) — 최신 쌍이 **관측 stub**이어도(패치 직후·키 만료·관측 크래시)
// 새 패치노트가 화면에 보이고, 관측 영역은 0이 아니라 회색 사유로 그려진다. 전에는 판정 파일이 안 생겨
// 화면이 새 쌍을 못 골랐다 — 노트가 커밋돼 있어도 안 보였다(결정 8 위반).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ObservationFailure } from "@/pipeline/types";

vi.mock("server-only", () => ({}));
const failure: ObservationFailure = { reason: "awaiting-observation", detail: "", at: "2026-10-07T21:00:00Z" };

vi.mock("@/lib/tftData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tftData")>();
  return {
    ...actual,
    loadTft: () => null,
    loadTftDeclaration: () => ({
      from: "18.3",
      to: "18.4",
      generatedAt: "2026-10-07T21:05:00Z",
      failure,
      notes: {
        patch: "18.4",
        sourceUrl: "https://example.com/tft-18-4",
        stats: { sections: 1, lines: 2, unresolved: 0 },
        items: [
          { id: "n1", patch: "18.4", section: "champion", entity: "헤카림", skill: null, stat: "체력", before: "900", after: "950", direction: "buff", summary: "체력: 900 ⇒ 950", anchorUrl: "https://example.com/tft-18-4#hecarim", anchorKind: "entity", modeScope: "core" },
          { id: "n2", patch: "18.4", section: "champion", entity: "레오나", skill: null, stat: "마나", before: "40/100", after: "30/90", direction: "adjust", summary: "마나: 40/100 ⇒ 30/90", anchorUrl: "https://example.com/tft-18-4#leona", anchorKind: "entity", modeScope: "core" },
        ],
      },
    }),
  };
});
vi.mock("@/lib/pubgData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pubgData")>();
  return {
    ...actual,
    loadPubg: () => null,
    loadPubgDeclaration: () => ({
      from: "43.1",
      to: "43.2",
      generatedAt: "2026-10-08T20:05:00Z",
      failure: { ...failure, reason: "key-missing" as const },
      notes: [
        { id: "p1", patch: "43.2", weaponKeys: ["Item_Weapon_AK47_C"], stat: "피해량", before: "47", after: "49", direction: "buff", expectedRelChange: null, summary: "AKM 피해량 47 → 49", anchorUrl: "https://example.com/pubg-43-2#akm" },
      ],
    }),
  };
});

import { AmbientProvider } from "@/components/AmbientContext";
import TftPage from "../tft/page";
import TftComparePage from "../tft/compare/page";
import PubgPage from "../pubg/page";
import PubgComparePage from "../pubg/compare/page";

describe("선언 축만 있는 최신 쌍", () => {
  it("TFT 홈이 새 패치노트를 원문 링크와 함께 그린다", () => {
    const { container } = render(<AmbientProvider><TftPage /></AmbientProvider>);
    const text = container.textContent ?? "";
    expect(text).toContain("18.4 패치노트는");
    expect(text).toContain("헤카림");
    expect(text).toContain("체력: 900 ⇒ 950");
    expect(container.querySelector('a[href="https://example.com/tft-18-4#leona"]')).not.toBeNull();
  });
  it("관측 영역은 0이 아니라 회색 사유다", () => {
    const { container } = render(<AmbientProvider><TftPage /></AmbientProvider>);
    const status = container.querySelector('[data-observation="awaiting-observation"]');
    expect(status?.textContent).toMatch(/관측 대기/);
    expect(container.textContent).not.toMatch(/통계는\s*0개 변화/);
  });
  it("관측이 필요한 화면(대조표)은 미연결이 아니라 관측 전 사유를 말한다", () => {
    const { container } = render(<AmbientProvider><TftComparePage /></AmbientProvider>);
    expect(container.textContent).toContain("관측 전");
    expect(container.textContent).not.toContain("아직 연결되지 않았습니다");
  });
  it("PUBG 홈도 수기 노트를 그리고, 키 사유를 회색으로 말한다", () => {
    const { container } = render(<AmbientProvider><PubgPage /></AmbientProvider>);
    expect(container.textContent).toContain("AKM 피해량 47 → 49");
    expect(container.querySelector('[data-observation="key-missing"]')?.textContent).toMatch(/키/);
  });
  it("PUBG 대조표도 관측 전 사유", () => {
    const { container } = render(<AmbientProvider><PubgComparePage /></AmbientProvider>);
    expect(container.textContent).toContain("관측 전");
  });
});
