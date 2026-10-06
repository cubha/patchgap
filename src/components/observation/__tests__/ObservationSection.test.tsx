// src/components/observation/__tests__/ObservationSection.test.tsx
// 상세 공통 관측 섹션 렌더(2026-10-06 사용자 확정 — PLAN-detail-observation-section-2026-10-06.md D2·D6).
// 지표 탭 × 구간 선택 → 패널 **하나**. 탭 1개면 라벨 1개, 구간 축이 없으면 선택 상자 대신 사유 한 줄.
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ObservationSection from "../ObservationSection";

const panel = (text: string) => <p>{text}</p>;

const lolLike = [
  {
    key: "winRate",
    label: "승률",
    segments: [
      { key: "all", label: "전체", panel: panel("승률·전체 패널") },
      { key: "TOP", label: "탑", panel: panel("승률·탑 패널") },
    ],
  },
  {
    key: "pickRate",
    label: "픽률",
    segments: [{ key: "all", label: "전체", panel: panel("픽률·전체 패널") }],
  },
];

describe("ObservationSection", () => {
  it("지표 탭과 선택된 패널 하나만 그린다 — 숨긴 형제 패널을 DOM에 두지 않는다", () => {
    render(
      <ObservationSection metrics={lolLike} initial={{ metric: "winRate", segment: "TOP" }} segmentLabel="라인" emptyText="없음" />
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["승률2", "픽률1"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("승률·탑 패널")).toBeTruthy();
    expect(screen.queryByText("승률·전체 패널")).toBeNull();
    expect(screen.queryByText("픽률·전체 패널")).toBeNull();
    expect(screen.getByText("보고할 관측 3건")).toBeTruthy();
  });

  it("구간이 둘 이상인 지표만 선택 상자를 갖고, 선택하면 패널이 바뀐다", () => {
    render(
      <ObservationSection metrics={lolLike} initial={{ metric: "winRate", segment: "all" }} segmentLabel="라인" emptyText="없음" />
    );
    const select = screen.getByRole("combobox");
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["전체", "탑"]);
    fireEvent.change(select, { target: { value: "TOP" } });
    expect(screen.getByText("승률·탑 패널")).toBeTruthy();

    // 픽률은 자격 조합이 전체 하나뿐 — 고를 것이 없는 선택 상자를 두지 않는다.
    fireEvent.click(screen.getByRole("tab", { name: /픽률/ }));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("픽률·전체 패널")).toBeTruthy();
  });

  it("지표를 바꿔도 같은 구간이 있으면 유지한다", () => {
    const metrics = [
      lolLike[0],
      {
        key: "pickRate",
        label: "픽률",
        segments: [
          { key: "all", label: "전체", panel: panel("픽률·전체 패널") },
          { key: "TOP", label: "탑", panel: panel("픽률·탑 패널") },
        ],
      },
    ];
    render(
      <ObservationSection metrics={metrics} initial={{ metric: "winRate", segment: "TOP" }} segmentLabel="라인" emptyText="없음" />
    );
    fireEvent.click(screen.getByRole("tab", { name: /픽률/ }));
    expect(screen.getByText("픽률·탑 패널")).toBeTruthy();
  });

  it("좌우 화살표로 탭을 옮긴다", () => {
    render(
      <ObservationSection metrics={lolLike} initial={{ metric: "winRate", segment: "all" }} segmentLabel="라인" emptyText="없음" />
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: /승률/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /픽률/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("픽률·전체 패널")).toBeTruthy();
  });

  it("구간 축이 없는 대상은 선택 상자 대신 사유 한 줄을 말한다", () => {
    render(
      <ObservationSection
        metrics={[lolLike[1]]}
        initial={{ metric: "pickRate", segment: "all" }}
        segmentLabel={null}
        noSegmentNote="구간 축 없음 — 보드는 위치를 갖지 않습니다"
        emptyText="없음"
      />
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("구간 축 없음 — 보드는 위치를 갖지 않습니다")).toBeTruthy();
  });

  it("자격 조합이 0이면 탭 없이 빈 상태 문장만 — 숨긴 상태의 이름을 꺼내지 않는다", () => {
    const { container } = render(
      <ObservationSection metrics={[]} initial={null} segmentLabel="라인" emptyText="보고할 관측이 없습니다." />
    );
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("보고할 관측이 없습니다.")).toBeTruthy();
    for (const hidden of ["표본 부족", "바닥 미달", "변화 없음"]) {
      expect(container.textContent).not.toContain(hidden);
    }
  });

  it("기술통계 모드는 보고 자격이 아니라 관측 지표 수를 센다", () => {
    render(
      <ObservationSection
        mode="descriptive"
        metrics={[lolLike[1]]}
        initial={{ metric: "pickRate", segment: "all" }}
        segmentLabel={null}
        emptyText="없음"
      />
    );
    expect(screen.getByText("관측 지표 1개")).toBeTruthy();
    expect(screen.queryByText(/보고할 관측/)).toBeNull();
  });
});
