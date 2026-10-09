// src/app/__tests__/home-observed-pair.test.tsx
// 홈 = 관측이 있는 최신 쌍(PLAN-home-observed-pair ST-7, 2026-10-09 사용자 정정: "최신 데이터 = 최신 상태의 **분석 내용**").
// 커밋된 데이터 실측: 18.4가 관측 stub(선언만)인 동안 `/tft/`는 18.2→18.3 분석을 그리고, 18.4 패치노트는 배너로 닿는다.
// 전에는 목록 첫 칸(stub)이 홈이라 타일 「—」·노트 73줄 평문의 선언 뷰가 사용자에게 노출됐다.
//
// 선언만 쌍이 커밋 데이터에 없으면(18.4 관측이 들어온 뒤) 배너 검사는 성립하지 않는다 — 규칙 자체는 `tftLatestPair.test`가 본다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import { AmbientProvider } from "@/components/AmbientContext";
import { newerTftDeclarations, tftHomePair } from "@/lib/tftData";
import { pairSlug } from "@/lib/pairRoutes";
import TftPage from "../tft/page";
import TftHistoryPage from "../tft/history/[pair]/page";

describe("TFT 홈 — 관측이 있는 최신 쌍이 홈이고, 더 새 패치노트는 배너로 닿는다", () => {
  const home = tftHomePair();
  const newer = newerTftDeclarations();

  it("홈은 관측 브리핑이다(선언 뷰가 아니다) — 통계가 변화를 말하고 관측 사유 문단이 없다", () => {
    if (!home) return; // 관측 쌍이 없는 빌드에선 선언 뷰가 홈이다(declaration-only.test)
    const { container } = render(<AmbientProvider><TftPage /></AmbientProvider>);
    const h1 = container.querySelector("h1")?.textContent ?? "";
    expect(h1).toMatch(/통계는 .*개 변화/);
    expect(h1).not.toContain("관측 전");
    expect(container.querySelector("[data-observation]")).toBeNull();
  });

  it("홈보다 새 선언만 쌍이 있으면 배너가 그 패치·대상 수·첫 관측 예정을 말하고 선언 뷰로 보낸다", () => {
    if (!home || newer.length === 0) return;
    const { container } = render(<AmbientProvider><TftPage /></AmbientProvider>);
    for (const d of newer) {
      const banner = container.querySelector(`[data-newer-patch="${d.to}"]`);
      expect(banner, d.to).not.toBeNull();
      expect(banner?.textContent).toContain(`${d.to} 패치노트`);
      expect(banner?.textContent).toMatch(/\d+개 항목/);
      // 대기 사유면 날짜가 있어야 한다 — "관측 대기"만으로는 고장과 구별되지 않는다.
      if (d.failure.reason === "awaiting-observation") expect(banner?.textContent).toMatch(/\d+\/\d+\([월화수목금토일]\) \d{2}:\d{2} KST/);
      const link = banner?.querySelector("a[data-newer-patch-link]");
      expect(link?.getAttribute("href")?.replace(/\/$/, "")).toBe(`/tft/history/${pairSlug({ from: d.from, to: d.to })}`);
    }
  });

  it("배너가 보내는 선언 뷰는 같은 날짜를 말하고 노트를 그린다", async () => {
    const d = newer[0];
    if (!d) return;
    const page = TftHistoryPage({ params: Promise.resolve({ pair: pairSlug({ from: d.from, to: d.to }) }) });
    const { container } = render(<AmbientProvider>{await page}</AmbientProvider>);
    const status = container.querySelector("[data-observation]");
    expect(status).not.toBeNull();
    if (d.failure.reason === "awaiting-observation") expect(status?.textContent).toMatch(/첫 관측은 .* KST 예정/);
    expect(container.textContent).toContain(`${d.to} 패치노트`);
    // 캡션에 조항 수를 두지 않는다(결정 7) — 머리 「N개 항목」 바로 아래 「공지 N건」이 또 서지 않는다.
    expect(container.textContent).not.toMatch(/공지 \d+건/);
  });

  it("관측 브리핑(홈)은 과거 쌍 라우트가 그리지 않는다", async () => {
    if (!home) return;
    const page = TftHistoryPage({ params: Promise.resolve({ pair: pairSlug(home) }) });
    const { container } = render(<AmbientProvider>{await page}</AmbientProvider>);
    expect(container.textContent).toContain("이 패치쌍의 기록이 없습니다.");
  });
});
