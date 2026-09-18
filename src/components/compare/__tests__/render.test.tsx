// src/components/compare/__tests__/render.test.tsx
// 대조표 컴포넌트 렌더 검증(ST-11 빈 상태 + 2026-09-18 라운드6 엔티티 1행·묶음·포커스). 프로젝트
// 관례대로 jest-dom 매처 없이 render()의 container를 직접 querying한다.
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import DeltaTable from "../DeltaTable";
import NoteNavigator from "../NoteNavigator";
import CoverageBar from "../CoverageBar";
import CompareExplorer from "../CompareExplorer";
import { buildEntityRows } from "../entityRows";

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:X:pickRate",
    entityType: "champion",
    entityKey: "X",
    entityName: "테스트챔프",
    metric: "pickRate",
    before: 0.1,
    after: 0.15,
    delta: 0.05,
    ci: [0.03, 0.07],
    n: { before: 1000, after: 1200 },
    q: 0.02,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:1",
    patch: "26.17",
    section: "champion",
    entity: "초가스",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "요약",
    anchorUrl: "https://example.com/#x",
    anchorKind: "entity",
    ...overrides,
  };
}

describe("DeltaTable — 빈 상태(rows=[])", () => {
  it("델타가 없다는 문구를 렌더하고 헤더는 엔티티·지표 4·상태 = 6열이다(2026-09-18 라운드6: 지표·버전 열 제거)", () => {
    const { container } = render(<DeltaTable pair={null} rows={[]} focusKey={null} />);
    expect(container.textContent).toContain("표시할 델타가 없습니다");
    expect(container.querySelectorAll("th")).toHaveLength(6);
  });
});

describe("DeltaTable — 엔티티 1행·인라인 지표(사용자 L3)", () => {
  const rows = buildEntityRows(
    [
      delta({ id: "champion:Ekko:pickRate", entityKey: "Ekko", entityName: "에코", metric: "pickRate", status: "announced-consistent", matchedNoteIds: ["n-ekko"] }),
      delta({ id: "champion:Ekko:banRate", entityKey: "Ekko", entityName: "에코", metric: "banRate", delta: -0.06, after: 0.04, ci: [-0.08, -0.04], status: "announced-consistent", matchedNoteIds: ["n-ekko"] }),
      delta({ id: "champion:Ekko:winRate", entityKey: "Ekko", entityName: "에코", metric: "winRate", q: 0.8, status: "announced-consistent", matchedNoteIds: ["n-ekko"] }),
      delta({ id: "champion:Bard:pickRate", entityKey: "Bard", entityName: "바드", metric: "pickRate" }),
    ],
    "all",
    0.1
  );

  it("같은 챔피언은 1행이고 버전 이동은 헤더에 한 번만 나온다", () => {
    const { container } = render(<DeltaTable pair={{ from: "26.17", to: "26.18" }} rows={rows} focusKey={null} />);
    const trs = Array.from(container.querySelectorAll("tbody tr"));
    expect(trs).toHaveLength(2);
    expect(container.querySelector("thead")?.textContent).toContain("26.17 → 26.18");
    // 열마다 버전을 두지 않는다 — "26.17"이 헤더에 정확히 한 번.
    expect((container.querySelector("thead")?.textContent?.match(/26\.17/g) ?? []).length).toBe(1);
  });

  it("셀은 전→후와 ▲/▼ Δ를 함께 보여주고, 보고 가능하지 않은 지표(승률 비유의)는 빈 셀이다", () => {
    const { container } = render(<DeltaTable pair={null} rows={rows} focusKey={null} />);
    const ekko = container.querySelector('tr[data-entity-key="champion:Ekko"]');
    expect(ekko).not.toBeNull();
    const cells = Array.from(ekko!.querySelectorAll("td")).map((td) => td.textContent ?? "");
    // [엔티티, 밴률, 승률, 픽률, 채택률, 상태]
    expect(cells[1]).toContain("10.0% → 4.0%");
    expect(cells[1]).toContain("▼ −6.0%p");
    expect(cells[2]).toBe("—");
    expect(cells[3]).toContain("▲ +5.0%p");
    expect(cells[4]).toBe("—");
    expect(cells[5]).toContain("공지");
  });

  it("focusKey 행은 row-highlight로 강조된다", () => {
    const { container } = render(<DeltaTable pair={null} rows={rows} focusKey="champion:Bard" />);
    expect(container.querySelector('tr[data-entity-key="champion:Bard"]')?.className).toContain("row-highlight");
    expect(container.querySelector('tr[data-entity-key="champion:Ekko"]')?.className).not.toContain("row-highlight");
  });
});

describe("NoteNavigator — 빈 상태(notes=[])", () => {
  it("검색 결과 없음 문구를 렌더한다", () => {
    const { container } = render(
      <NoteNavigator
        notes={[]}
        rows={[]}
        activeSection="champion"
        onSectionChange={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        selectedGroupId={null}
        onSelect={() => {}}
        icons={{}}
      />
    );
    expect(container.textContent).toContain("검색 결과가 없습니다");
    expect(container.textContent).toContain("챔피언 0");
  });
});

describe("NoteNavigator — 엔티티 묶음·아이콘·배지(사용자 L4·C1)", () => {
  const items = [
    note({ id: "note:1", entity: "초가스", skill: "Q - 파열" }),
    note({ id: "note:2", entity: "초가스", skill: "E - 흡혈 가시" }),
    note({ id: "note:3", entity: "바드" }),
  ];

  it("같은 챔피언 줄 2개가 항목 1개로 묶이고 줄 수·스킬을 보여준다 · 탭 숫자는 엔티티 수", () => {
    const { container } = render(
      <NoteNavigator
        notes={items}
        rows={[]}
        activeSection="champion"
        onSectionChange={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        selectedGroupId={null}
        onSelect={() => {}}
        icons={{ "note:1": { entityType: "champion", entityKey: "Chogath" } }}
      />
    );
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.textContent).toContain("2줄");
    expect(container.textContent).toContain("Q - 파열 · E - 흡혈 가시");
    expect(container.textContent).toContain("챔피언 2");
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/dd/champion/Chogath.png");
    expect(img?.closest("span")?.getAttribute("style")).toContain("width: 40px");
  });

  it("보고 가능한 관측이 없으면 배지 대신 '유의한 관측 없음'을 쓴다 · 클릭은 묶음을 넘긴다", () => {
    const rows = [delta({ id: "champion:Chogath:pickRate", entityKey: "Chogath", entityName: "초가스", q: 0.9, status: "announced-consistent", matchedNoteIds: ["note:1"] })];
    let picked: string | null = null;
    const { container } = render(
      <NoteNavigator
        notes={items}
        rows={rows}
        activeSection="champion"
        onSectionChange={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        selectedGroupId={null}
        onSelect={(g) => {
          picked = g.entity;
        }}
        icons={{}}
      />
    );
    expect(container.textContent).toContain("유의한 관측 없음");
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(container.querySelector("ul > li button")!);
    expect(picked).toBe("초가스");
  });
});

describe("CoverageBar — 전부 0", () => {
  it("0을 그대로 렌더하고 표본 부족·바닥 미달은 세지 않는다(2026-09-18 라운드6 C1)", () => {
    const { container } = render(
      <CoverageBar
        stats={{ noteEntityCount: 0, noteItemCount: 0, matchedCount: 0, unannouncedCount: 0, lowSampleCount: 0, belowThresholdCount: 0, indirectEffectCount: 0 }}
      />
    );
    expect(container.textContent).toContain("노트 0엔티티(0항목) 중 관측 짝 0");
    expect(container.textContent).not.toContain("표본 부족");
    expect(container.textContent).not.toContain("바닥 미달");
  });
});

describe("CompareExplorer — 통합", () => {
  const coverage = { noteEntityCount: 0, noteItemCount: 0, matchedCount: 0, unannouncedCount: 0, lowSampleCount: 0, belowThresholdCount: 0, indirectEffectCount: 0 };

  it("데이터 없음: 크래시 없이 상태 칩 4 + 라인 필터 6·내비게이터·테이블·커버리지 바를 렌더한다", () => {
    const { container } = render(<CompareExplorer pair={null} notes={[]} rows={[]} coverage={coverage} />);
    // 2026-09-18 라운드6(사용자 C5·C1): 칩 10종 → 4종(전체/공지/공지 · 이상 관측/미공지). 노이즈·세분 칩은
    // 표에 올리지 않는 상태의 칩이라 함께 없앴다(배지 1종 = 칩 1종 불변식 유지).
    expect(container.querySelectorAll("[aria-pressed]")).toHaveLength(10);
    expect(container.querySelector('[aria-label="라인 필터"]')).not.toBeNull();
    expect(container.textContent).toContain("표시할 델타가 없습니다");
    expect(container.textContent).toContain("노트 0엔티티(0항목)");
  });

  it("내비 묶음을 클릭하면 표의 그 엔티티 행이 포커스되고, 표에 없는 엔티티면 머리 1줄로 말한다", () => {
    const notes = [note({ id: "n-ekko", entity: "에코", skill: "Q" }), note({ id: "n-bard", entity: "바드" })];
    const rows = [
      delta({ id: "champion:Ekko:pickRate", entityKey: "Ekko", entityName: "에코", status: "announced-consistent", matchedNoteIds: ["n-ekko"] }),
      delta({ id: "champion:Bard:pickRate", entityKey: "Bard", entityName: "바드", q: 0.9, status: "announced-consistent", matchedNoteIds: ["n-bard"] }),
    ];
    const { container } = render(<CompareExplorer pair={null} notes={notes} rows={rows} coverage={coverage} qAlpha={0.1} />);
    const buttons = Array.from(container.querySelectorAll('[aria-label="패치노트 항목 검색"] ~ * button, ul > li > button'));
    const ekkoBtn = buttons.find((b) => b.textContent?.includes("에코"))!;
    fireEvent.click(ekkoBtn);
    expect(container.querySelector('tr[data-entity-key="champion:Ekko"]')?.className).toContain("row-highlight");
    const bardBtn = buttons.find((b) => b.textContent?.includes("바드"))!;
    fireEvent.click(bardBtn);
    expect(container.textContent).toContain("유의한 관측이 없어 이 표에 행이 없습니다");
  });
});
