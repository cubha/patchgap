// src/components/compare/__tests__/render.test.tsx
// 대조표 컴포넌트 빈 상태 렌더 검증(ST-11 완료 조건 "빈 상태 렌더"). 프로젝트 관례대로
// jest-dom 매처 없이 render()의 container를 직접 querying한다.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import DeltaTable from "../DeltaTable";
import NoteNavigator from "../NoteNavigator";
import CoverageBar from "../CoverageBar";
import CompareExplorer from "../CompareExplorer";

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:X:pickRate",
    entityType: "champion",
    entityKey: "X",
    entityName: "테스트챔프",
    metric: "pickRate",
    before: 0.1,
    after: 0.12,
    delta: 0.02,
    ci: [0.01, 0.03],
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

describe("DeltaTable — 빈 상태(rows=[])", () => {
  it("델타가 없다는 문구를 렌더하고 헤더는 그대로 보인다", () => {
    const { container } = render(
      <DeltaTable pair={null} rows={[]} highlightNoteId={null} sortKey="absDelta" sortDir="desc" onSort={() => {}} />
    );
    expect(container.textContent).toContain("표시할 델타가 없습니다");
    expect(container.querySelectorAll("th")).toHaveLength(10);
  });
});

describe("DeltaTable — 아이콘·라인 태그 (ST-J)", () => {
  it("entityType='lane' 행은 라인 글리프 박스를 렌더한다('골' 텍스트 폴백 대신)", () => {
    const row = delta({
      id: "lane:BOTTOM:goldAt10",
      entityType: "lane",
      entityKey: "BOTTOM",
      entityName: "바텀",
      metric: "goldAt10",
    });
    const { container } = render(
      <DeltaTable pair={null} rows={[row]} highlightNoteId={null} sortKey="absDelta" sortDir="desc" onSort={() => {}} />
    );
    // 라인 글리프(svg)가 아이콘 자리에 렌더돼야 한다 — 옛 "골" 텍스트 폴백 박스 대신.
    // 2026-09-10: 엔티티명("바텀")이 바로 옆에 있어 글리프는 labelled(장식) 처리라 <title>이
    // 없다 — 접근명 "원딜바텀" 중복 방지. 존재 검사는 svg + aria-hidden으로 한다.
    const glyph = container.querySelector("tbody svg");
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("tbody svg title")).toBeNull();
  });

  it("챔피언 position-scope 행(4세그먼트 id)은 라인 태그(글리프+라벨·지표)를 렌더한다", () => {
    const row = delta({ id: "champion:X:TOP:pickRate", metric: "pickRate" });
    const { container } = render(
      <DeltaTable pair={null} rows={[row]} highlightNoteId={null} sortKey="absDelta" sortDir="desc" onSort={() => {}} />
    );
    expect(container.textContent).toContain("탑 · 픽률");
  });

  it("scope=all 챔피언 행(3세그먼트 id)은 라인 태그를 렌더하지 않는다", () => {
    const row = delta({ id: "champion:X:pickRate", metric: "pickRate" });
    const { container } = render(
      <DeltaTable pair={null} rows={[row]} highlightNoteId={null} sortKey="absDelta" sortDir="desc" onSort={() => {}} />
    );
    expect(container.textContent).not.toContain(" · 픽률");
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
        selectedNoteId={null}
        onSelect={() => {}}
        icons={{}}
      />
    );
    expect(container.textContent).toContain("검색 결과가 없습니다");
    expect(container.textContent).toContain("챔피언 0");
  });
});

describe("NoteNavigator — 아이콘 (ST-J)", () => {
  const item: PatchNoteItem = {
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
  };

  it("icons 맵에 항목이 있으면 EntityIcon(40px)을 렌더한다", () => {
    const { container } = render(
      <NoteNavigator
        notes={[item]}
        rows={[]}
        activeSection="champion"
        onSectionChange={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        selectedNoteId={null}
        onSelect={() => {}}
        icons={{ "note:1": { entityType: "champion", entityKey: "Chogath" } }}
      />
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/dd/champion/Chogath.png");
    expect(img?.closest("span")?.getAttribute("style")).toContain("width: 40px");
  });

  it("icons 맵에 항목이 없으면 아이콘 없이 폴백 글자만 렌더한다(무근거 아이콘 금지)", () => {
    const { container } = render(
      <NoteNavigator
        notes={[item]}
        rows={[]}
        activeSection="champion"
        onSectionChange={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        selectedNoteId={null}
        onSelect={() => {}}
        icons={{}}
      />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("초");
  });
});

describe("CoverageBar — 전부 0", () => {
  it("0을 그대로 렌더한다", () => {
    const { container } = render(
      <CoverageBar
        stats={{
          noteEntityCount: 0,
          noteItemCount: 0,
          matchedCount: 0,
          unannouncedCount: 0,
          lowSampleCount: 0,
          belowThresholdCount: 0,
          indirectEffectCount: 0,
        }}
      />
    );
    expect(container.textContent).toContain("노트 0엔티티(0항목) 중 관측 짝 0");
  });
});

describe("CompareExplorer — 데이터 없음(쌍 0개) 전체 통합 빈 상태", () => {
  it("크래시 없이 상태 필터·내비게이터·테이블·커버리지 바를 모두 렌더한다", () => {
    const { container } = render(
      <CompareExplorer
        pair={null}
        notes={[]}
        rows={[]}
        coverage={{
          noteEntityCount: 0,
          noteItemCount: 0,
          matchedCount: 0,
          unannouncedCount: 0,
          lowSampleCount: 0,
          belowThresholdCount: 0,
          indirectEffectCount: 0,
        }}
      />
    );
    // 상태 칩 8종(2026-09-13 below-threshold·indirect-effect 추가 · 2026-09-17 통합
    // 필터 "노트에 없는 변화" 추가 — 홈 타일이 세는 집합 49를 대조표에서도 표현할 수
    // 있어야 타일 링크가 거짓말을 하지 않는다) + 라인 필터 6종(시안 .m-filter,
    // 2026-09-10 신설) = 14 → 2026-09-18 ST-4 "공지 · 관측 미확인" 칩 추가로 15(명세 변경:
    // 비유의 "불일치" 59건을 빨간 배지에서 분리 — 사용자 확정 M2).
    // → 2026-09-18 S9/S10(사용자 확정 CF-1·CF-2) "공지 · 바닥 미달" 칩 추가로 16.
    // **어휘를 갈랐다고 칩을 늘리는 것이 아니다** — `filterByStatus`가 표시 키 동등비교라,
    // 칩 없이 표시 키만 추가하면 그 행들이 "전체" 외 어떤 칩으로도 닿지 않게 된다. 그러면
    // "공지-일치" 칩이 32건을 말하면서 12건만 보여주는 상태가 되는데, 그건 위 GAP_FILTER_KEY
    // 주석이 기록한 2026-09-17 결함("타일은 49, 화면은 47")과 같은 형태다. 배지 1종 = 칩 1종
    // 불변식을 지키는 쪽이 옳다.
    expect(container.querySelectorAll('[aria-pressed]')).toHaveLength(16);
    expect(container.querySelector('[aria-label="라인 필터"]')).not.toBeNull();
    expect(container.textContent).toContain("표시할 델타가 없습니다");
    expect(container.textContent).toContain("노트 0엔티티(0항목)");
  });
});
