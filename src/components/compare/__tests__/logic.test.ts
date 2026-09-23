// src/components/compare/__tests__/logic.test.ts
// 대조표 **LoL 전용** 순수 로직(logic.ts) 단위 테스트 — 라인 축·대표 상태 산출·셀 포맷·커버리지.
//
// 2026-09-23 §8-3: 상태 칩·정렬·검색·내비 묶기는 세 게임 공통 규칙이 되어 `toolbarRules.ts`·
// `noteNav.ts`로 옮겼고, 그 테스트도 각 모듈 옆(`toolbarRules.test.ts`·`noteNav.test.ts`)으로
// 따라갔다. 여기서 사라진 describe는 **약화가 아니라 이사**다.

import { describe, expect, it } from "vitest";
import { modeScopeFromAnchorUrl } from "@/pipeline/shared/mode-scope";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import {
  computeCoverage,
  directionSymbol,
  filterByLane,
  formatCiCell,
  formatDeltaCell,
  formatNCell,
  lolNoteNavItems,
  navBadgeStatus,
  representativeStatus,
  shortNoteId,
} from "../logic";

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

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:1",
    patch: "26.17",
    section: "champion",
    entity: "테스트챔프",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "테스트 요약",
    anchorUrl: "https://example.com/#x",
    anchorKind: "entity",
    ...overrides,
    // modeScope는 앵커에서 파생시킨다 — 실제 데이터의 불변식(파서·마이그레이션이 같은 규칙을
    // 쓴다)과 픽스처를 어긋나게 두면, 모드 앵커를 쓰는 케이스가 조용히 core로 테스트된다.
    modeScope: overrides.modeScope ?? modeScopeFromAnchorUrl(overrides.anchorUrl ?? "https://example.com/#x"),
  };
}

function notesFile(items: PatchNoteItem[]): NotesFile {
  return {
    meta: { patch: "26.17", sourceUrl: "https://example.com", fetchedAt: "2026-09-05T00:00:00.000Z", itemCount: items.length },
    summary: "요약",
    sections: [],
    items,
  };
}

describe("representativeStatus", () => {
  it("짝지어진 델타가 없으면 null", () => {
    expect(representativeStatus("note:1", [delta({ matchedNoteIds: [] })])).toBeNull();
  });

  it("여러 델타 중 우선순위가 가장 높은 상태를 고른다(unannounced > inconsistent)", () => {
    const rows = [
      delta({ id: "1", matchedNoteIds: ["note:1"], status: "announced-inconsistent" }),
      delta({ id: "2", matchedNoteIds: ["note:1"], status: "unannounced" }),
    ];
    expect(representativeStatus("note:1", rows)).toBe("unannounced");
  });

  it("below-threshold는 no-change보다 우선하지만 unannounced보다는 아니다(2026-09-13, Record 전환 회귀가드 — 예전 indexOf 구현은 미등록 상태를 -1로 최우선 오판정했다)", () => {
    const rows = [
      delta({ id: "1", matchedNoteIds: ["note:1"], status: "no-change" }),
      delta({ id: "2", matchedNoteIds: ["note:1"], status: "below-threshold" }),
    ];
    expect(representativeStatus("note:1", rows)).toBe("below-threshold");

    const rows2 = [
      delta({ id: "3", matchedNoteIds: ["note:1"], status: "below-threshold" }),
      delta({ id: "4", matchedNoteIds: ["note:1"], status: "unannounced" }),
    ];
    expect(representativeStatus("note:1", rows2)).toBe("unannounced");
  });
});

describe("navBadgeStatus — 엔티티 묶음의 배지(보고 가능 관측만)", () => {
  const rows = [
    delta({ id: "1", matchedNoteIds: ["n1"], status: "announced-consistent" }),
    delta({ id: "2", matchedNoteIds: ["n2"], status: "announced-inconsistent", delta: -0.05, after: 0.05, ci: [-0.07, -0.03] }),
    delta({ id: "3", matchedNoteIds: ["n3"], status: "announced-inconsistent", q: 0.7 }),
  ];

  it("보고 가능한 셀이 있으면 최우선 표시 키 — 이상 관측이 공지보다 앞", () => {
    expect(navBadgeStatus(["n1", "n2"], rows, 0.1)).toBe("announced-anomaly");
    expect(navBadgeStatus(["n1"], rows, 0.1)).toBe("announced");
  });

  it("짝은 있으나 전부 비유의면 null — 배지를 달지 않는다(사용자 C1)", () => {
    expect(navBadgeStatus(["n3"], rows, 0.1)).toBeNull();
  });

  it("짝 자체가 없으면 null", () => {
    expect(navBadgeStatus(["none"], rows, 0.1)).toBeNull();
  });
});

describe("directionSymbol", () => {
  it("insufficient-sample은 항상 점(•)+muted", () => {
    expect(directionSymbol(delta({ status: "insufficient-sample", delta: 0.5 }))).toEqual({
      symbol: "•",
      colorClass: "text-muted",
    });
  });
  it("양수는 ▲/success", () => {
    expect(directionSymbol(delta({ status: "unannounced", delta: 0.02 }))).toEqual({
      symbol: "▲",
      colorClass: "text-success",
    });
  });
  it("음수는 ▼/danger", () => {
    expect(directionSymbol(delta({ status: "unannounced", delta: -0.02 }))).toEqual({
      symbol: "▼",
      colorClass: "text-danger",
    });
  });
});

describe("formatDeltaCell / formatCiCell / formatNCell", () => {
  it("insufficient-sample은 Δ·CI 모두 대시, n은 'n<200'", () => {
    const row = delta({ status: "insufficient-sample", delta: 0.5, ci: [0.1, 0.9], n: { before: 8, after: 8 } });
    expect(formatDeltaCell(row)).toBe("—");
    expect(formatCiCell(row)).toBe("—");
    expect(formatNCell(row)).toBe("n<200");
  });

  it("일반 pp 지표는 %p·CI·n/n을 정상 포맷한다", () => {
    const row = delta({ status: "unannounced", delta: 0.025, ci: [0.021, 0.029], n: { before: 10240, after: 10118 } });
    expect(formatDeltaCell(row)).toBe("+2.5%p");
    expect(formatCiCell(row)).toBe("±0.4");
    expect(formatNCell(row)).toBe("10,240/10,118");
  });
});

describe("shortNoteId", () => {
  it("null은 대시", () => {
    expect(shortNoteId(null)).toBe("—");
  });
  it("콜론 마지막 세그먼트만 남긴다", () => {
    expect(shortNoteId("note:26.17:champion:qiyana:5a6d587d")).toBe("5a6d587d");
  });
});

// 2026-09-23 §8-3: 묶기 규칙 자체는 게임 중립이 되어 `noteNav.ts`로 갔고(거기서 테스트한다),
// **제외 술어는 LoL 변환에 남았다** — 이 게이트를 잃으면 의회 투표 줄이 내비에 되살아난다.
describe("lolNoteNavItems — 제외 노트(라운드6 재판정 보완 1·5)", () => {
  it("의회 투표 결과·게임 모드 섹션 줄은 내비 항목이 되지 않는다", () => {
    const items = [
      note({ id: "a", entity: "에코", anchorUrl: "https://x/#patch-ekko" }),
      note({ id: "b", entity: "의회 - 투표 1 결과", anchorUrl: "https://x/#patch-classic" }),
      note({ id: "c", entity: "피오라", anchorUrl: "https://x/#patch-classic" }),
    ];
    expect(lolNoteNavItems(items).map((g) => g.entity)).toEqual(["에코"]);
  });

  it("섹션 라벨과 보조 문구(스킬 → 없으면 스탯)를 채운다", () => {
    const [item] = lolNoteNavItems([note({ id: "a", entity: "에코", skill: "Q", anchorUrl: "https://x/#patch-ekko" })]);
    expect(item.sectionLabel).toBe("챔피언");
    expect(item.detail).toBe("Q");
  });
});

describe("computeCoverage", () => {
  it("빈 입력(rows=[], notes=null)에서도 0으로 안전하게 계산된다", () => {
    expect(computeCoverage([], null)).toEqual({
      noteEntityCount: 0,
      noteItemCount: 0,
      matchedCount: 0,
      unannouncedCount: 0,
      lowSampleCount: 0,
      belowThresholdCount: 0,
      indirectEffectCount: 0,
      gapEntityCount: 0,
    });
  });

  it("상태별 집계 + 노트 엔티티 수(+원문 항목 수) + 미공지 엔티티 수(라운드6 보완 4)", () => {
    const notes = notesFile([note({ id: "a", entity: "A" }), note({ id: "b", entity: "A" })]);
    const rows = [
      delta({ id: "1", status: "announced-consistent" }),
      delta({ id: "2", status: "unannounced" }),
      delta({ id: "3", status: "insufficient-sample" }),
      delta({ id: "4", status: "no-change" }),
      delta({ id: "5", status: "below-threshold" }),
      delta({ id: "6", status: "indirect-effect" }),
    ];
    expect(computeCoverage(rows, notes)).toEqual({
      noteEntityCount: 1,
      noteItemCount: 2,
      matchedCount: 1,
      unannouncedCount: 1,
      lowSampleCount: 1,
      belowThresholdCount: 1,
      indirectEffectCount: 1,
      // 미공지 2행(unannounced·indirect-effect)이 같은 엔티티라 엔티티 수는 1.
      gapEntityCount: 1,
    });
  });
});

describe("filterByLane — 대조표 라인 필터(시안 .m-filter, 2026-09-10)", () => {
  const allScopeBan = delta({ id: "champion:Camille:banRate", metric: "banRate" });
  const topWin = delta({ id: "champion:Anivia:TOP:winRate", metric: "winRate" });
  const jungleWin = delta({ id: "champion:Ambessa:JUNGLE:winRate", metric: "winRate" });
  const laneGold = delta({
    id: "lane:BOTTOM:goldAt14",
    entityType: "lane",
    entityKey: "BOTTOM",
    entityName: "바텀",
    metric: "goldAt14",
  });
  const objective = delta({
    id: "objective:dragon:firstSec",
    entityType: "objective",
    entityKey: "dragon",
    entityName: "첫 용",
    metric: "firstSec",
  });
  const rows = [allScopeBan, topWin, jungleWin, laneGold, objective];

  it('"all"이면 전부 통과한다', () => {
    expect(filterByLane(rows, "all")).toEqual(rows);
  });

  it("특정 라인은 그 라인의 position-scope 챔피언 행만 남긴다", () => {
    expect(filterByLane(rows, "TOP").map((r) => r.id)).toEqual(["champion:Anivia:TOP:winRate"]);
  });

  it("라인 엔티티 행(lane:{pos}:{metric})도 같은 라인으로 묶인다", () => {
    expect(filterByLane(rows, "BOTTOM").map((r) => r.id)).toEqual(["lane:BOTTOM:goldAt14"]);
  });

  it("밴률은 라인 선택 시 사라진다 — 밴은 라인 무관(HANDOFF §6)", () => {
    for (const lane of ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const) {
      expect(filterByLane(rows, lane).some((r) => r.metric === "banRate")).toBe(false);
    }
  });

  it("라인 축이 없는 엔티티(오브젝트·매치 평균)는 라인 선택에서 제외된다", () => {
    expect(filterByLane(rows, "MIDDLE")).toEqual([]);
  });
});


