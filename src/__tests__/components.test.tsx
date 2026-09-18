// src/__tests__/components.test.tsx
// StatusBadge·DeltaValue 렌더 스냅샷 최소 검증(ST-10 완료 조건). vitest.config.ts에
// setupFiles/globals가 없어(다른 SubTask 소유 파일이라 건드리지 않는다) jest-dom 매처
// (toBeInTheDocument 등)를 쓰지 않고 render()의 container를 직접 querying한다 — RTL 자동
// cleanup도 등록되어 있지 않으므로 매 테스트 render() 반환값의 container만 사용해 회피한다.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import StatusBadge from "../components/StatusBadge";
import DeltaValue from "../components/DeltaValue";
import LaneGlyph from "../components/LaneGlyph";
import SpellIcon from "../components/SpellIcon";

describe("StatusBadge", () => {
  // 2026-09-18 라운드6(사용자 C5) 명세 변경 — "공지-일치" 어휘 폐지. 공지 계열은 "공지" 하나이고
  // 방향 반대·유의·바닥 통과만 "공지 · 이상 관측"(danger)이다.
  it("공지 상태를 중립 톤으로 렌더한다", () => {
    const { container } = render(<StatusBadge status="announced" />);
    const badge = container.querySelector("span");
    expect(container.textContent).toContain("공지");
    expect(badge?.className).not.toContain("text-danger");
  });

  it("공지 · 이상 관측은 danger 색 유틸을 포함한다", () => {
    const { container } = render(<StatusBadge status="announced-anomaly" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-danger");
    expect(container.textContent).toContain("공지 · 이상 관측");
  });

  it("미공지 상태는 accent 색 유틸을 포함한다", () => {
    const { container } = render(<StatusBadge status="unannounced" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-accent");
    expect(container.textContent).toContain("미공지");
  });

  it("변화 없음(no-change)을 muted로 렌더한다", () => {
    const { container } = render(<StatusBadge status="no-change" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-muted");
    expect(container.textContent).toContain("변화 없음");
  });

  it("알려지지 않은 상태값도 크래시 없이 원본 문자열로 렌더한다", () => {
    const { container } = render(<StatusBadge status="future-status" />);
    expect(container.textContent).toContain("future-status");
  });
});

describe("DeltaValue", () => {
  it("상승 델타는 success 색 + ▲ + CI 캡션을 렌더한다(pp)", () => {
    const { container } = render(<DeltaValue delta={0.025} ci={[0.021, 0.029]} kind="pp" />);
    expect(container.textContent).toContain("▲");
    expect(container.textContent).toContain("+2.5%p");
    expect(container.textContent).toContain("CI ±0.4");
    expect(container.querySelector("span")?.className).toContain("text-success");
  });

  it("하락 델타는 danger 색 + ▼(sec)", () => {
    const { container } = render(<DeltaValue delta={-22} ci={[-28, -16]} kind="sec" />);
    expect(container.textContent).toContain("▼");
    expect(container.textContent).toContain("−22s");
    expect(container.textContent).toContain("CI ±6s");
    expect(container.querySelector("span")?.className).toContain("text-danger");
  });

  it("delta가 null이면 대시(—)만 렌더한다", () => {
    const { container } = render(<DeltaValue delta={null} kind="gold" />);
    expect(container.textContent).toBe("—");
  });

  it("gold kind는 정수 델타를 부호+콤마로 렌더한다", () => {
    const { container } = render(<DeltaValue delta={320} ci={[235, 405]} kind="gold" />);
    expect(container.textContent).toContain("+320");
    expect(container.textContent).toContain("CI ±85");
  });
});

describe("LaneGlyph", () => {
  it("5개 라인 + all 각각 다른 라벨의 <title>을 렌더한다(색·모양만으로 라인을 구분하지 않음)", () => {
    const lanes = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "all"] as const;
    const labels = new Set<string>();
    for (const lane of lanes) {
      const { container } = render(<LaneGlyph lane={lane} />);
      const title = container.querySelector("title")?.textContent;
      expect(title).toBeTruthy();
      labels.add(title ?? "");
    }
    expect(labels.size).toBe(lanes.length);
  });

  it("size prop이 svg width/height에 반영된다", () => {
    const { container } = render(<LaneGlyph lane="TOP" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });
});

describe("SpellIcon", () => {
  it("filename이 있으면 /dd/spell/ 경로의 img를 렌더한다", () => {
    const { container } = render(<SpellIcon filename="VorpalSpikes.png" name="초가스 E" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/dd/spell/VorpalSpikes.png");
    expect(img?.getAttribute("alt")).toBe("초가스 E");
  });

  it("filename이 null이면 이미지 없이 폴백 라벨만 렌더한다(무근거 아이콘을 지어내지 않음)", () => {
    const { container } = render(<SpellIcon filename={null} name="이렐리아 Q" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("이");
  });

  it("fallbackLabel을 지정하면 첫 글자 대신 그 값을 쓴다", () => {
    const { container } = render(
      <SpellIcon filename={null} name="이렐리아 Q" fallbackLabel="Q" />
    );
    expect(container.textContent).toBe("Q");
  });
});
