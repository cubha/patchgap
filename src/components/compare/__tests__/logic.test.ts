// src/components/compare/__tests__/logic.test.ts
// 대조표 순수 로직(logic.ts) 단위 테스트 — 상태 필터·헤더 정렬·좌 내비 검색/섹션 필터·대표
// 상태 산출·테이블 셀 포맷·커버리지 집계. ST-11 완료 조건("상태 필터·정렬 로직(순수 함수)").

import { describe, expect, it } from "vitest";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import {
  computeCoverage,
  directionSymbol,
  filterByLane,
  filterByStatus,
  filterNotesBySearch,
  filterNotesBySection,
  formatCiCell,
  formatDeltaCell,
  formatNCell,
  groupNotesForNav,
  navBadgeStatus,
  representativeStatus,
  shortNoteId,
  sortRows,
  STATUS_FILTERS,
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

describe("filterByStatus", () => {
  const rows = [
    delta({ id: "1", status: "unannounced" }),
    delta({ id: "2", status: "announced-consistent" }),
    delta({ id: "3", status: "no-change" }),
  ];

  it("all은 전체(그대로 반환)", () => {
    expect(filterByStatus(rows, "all")).toHaveLength(3);
  });

  it("특정 표시 키만 남긴다", () => {
    expect(filterByStatus(rows, "unannounced").map((r) => r.id)).toEqual(["1"]);
    expect(filterByStatus(rows, "announced").map((r) => r.id)).toEqual(["2"]);
  });

  // 2026-09-18 라운드6(사용자 C5) 명세 변경: "미공지, 노트에없는변화, 간접영향은 결국 미공지내용" —
  // 통합 필터 `gap`과 개별 칩(간접 영향)을 없애고 `unannounced` 하나가 둘을 함께 남긴다.
  it("unannounced 칩은 미공지와 간접 영향을 함께 남긴다 — 홈 타일이 세는 집합과 같다", () => {
    const gapRows = [
      delta({ id: "u", status: "unannounced" }),
      delta({ id: "i", status: "indirect-effect" }),
      delta({ id: "a", status: "announced-consistent" }),
      delta({ id: "b", status: "below-threshold" }),
    ];
    expect(filterByStatus(gapRows, "unannounced").map((r) => r.id)).toEqual(["u", "i"]);
  });

  it("announced-anomaly 칩은 방향 반대·유의·바닥 통과 행만 남긴다", () => {
    const mixed = [
      delta({ id: "anom", status: "announced-inconsistent", delta: 0.05, after: 0.15, ci: [0.03, 0.07], q: 0.01 }),
      delta({ id: "quiet", status: "announced-inconsistent", q: 0.6 }),
      delta({ id: "ok", status: "announced-consistent" }),
    ];
    expect(filterByStatus(mixed, "announced-anomaly", 0.1).map((r) => r.id)).toEqual(["anom"]);
    expect(filterByStatus(mixed, "announced", 0.1).map((r) => r.id)).toEqual(["quiet", "ok"]);
  });
});

describe("sortRows", () => {
  it("absDelta desc가 기본", () => {
    const rows = [delta({ id: "small", delta: 0.01 }), delta({ id: "big", delta: -0.09 })];
    expect(sortRows(rows, "absDelta", "desc").map((r) => r.id)).toEqual(["big", "small"]);
  });

  it("asc 방향 전환", () => {
    const rows = [delta({ id: "small", delta: 0.01 }), delta({ id: "big", delta: -0.09 })];
    expect(sortRows(rows, "absDelta", "asc").map((r) => r.id)).toEqual(["small", "big"]);
  });

  it("q는 낮을수록(더 유의) desc 기본에서 앞에 온다", () => {
    const rows = [delta({ id: "high-q", q: 0.5 }), delta({ id: "low-q", q: 0.01 })];
    expect(sortRows(rows, "q", "desc").map((r) => r.id)).toEqual(["low-q", "high-q"]);
  });

  it("n은 before+after 합", () => {
    const rows = [
      delta({ id: "small-n", n: { before: 10, after: 10 } }),
      delta({ id: "big-n", n: { before: 5000, after: 5000 } }),
    ];
    expect(sortRows(rows, "n", "desc").map((r) => r.id)).toEqual(["big-n", "small-n"]);
  });

  it("원본 배열을 변형하지 않는다", () => {
    const rows = [delta({ id: "a", delta: 0.01 }), delta({ id: "b", delta: 0.02 })];
    const original = [...rows];
    sortRows(rows, "absDelta", "desc");
    expect(rows).toEqual(original);
  });
});

describe("filterNotesBySection", () => {
  it("섹션이 일치하는 항목만", () => {
    const items = [note({ id: "a", section: "champion" }), note({ id: "b", section: "item" })];
    expect(filterNotesBySection(items, "item").map((i) => i.id)).toEqual(["b"]);
  });
});

describe("filterNotesBySearch", () => {
  const items = [
    note({ id: "a", entity: "아우렐리온 솔", skill: "Q - 빛의 숨결" }),
    note({ id: "b", entity: "트런들", skill: null }),
  ];

  it("빈 검색어는 전체 반환", () => {
    expect(filterNotesBySearch(items, "  ")).toHaveLength(2);
  });

  it("entity로 검색", () => {
    expect(filterNotesBySearch(items, "트런들").map((i) => i.id)).toEqual(["b"]);
  });

  it("skill로 검색(대소문자 무시)", () => {
    expect(filterNotesBySearch(items, "빛의").map((i) => i.id)).toEqual(["a"]);
  });
});

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

describe("STATUS_FILTERS — 2026-09-18 라운드6 어휘 통일(사용자 C5·C1)", () => {
  it("칩은 전체 / 공지 / 공지 · 이상 관측 / 미공지 4종뿐이다 — 노이즈·세분 칩은 없다", () => {
    expect(STATUS_FILTERS.map((f) => [f.key, f.label])).toEqual([
      ["all", "전체"],
      ["announced", "공지"],
      ["announced-anomaly", "공지 · 이상 관측"],
      ["unannounced", "미공지"],
    ]);
  });
});

describe("groupNotesForNav — 좌 내비 엔티티 묶음(사용자 L4)", () => {
  it("같은 엔티티의 줄을 하나로 묶고 스킬 목록·줄 수를 낸다(문서 순서 유지)", () => {
    const items = [
      note({ id: "a", entity: "카시오페아", skill: "E - 쌍독니", stat: "피해량" }),
      note({ id: "b", entity: "바드", skill: "W - 수호자의 성소" }),
      note({ id: "c", entity: "카시오페아", skill: "E - 쌍독니", stat: "마나" }),
      note({ id: "d", entity: "카시오페아", skill: "Q - 유독성 폭발" }),
    ];
    const groups = groupNotesForNav(items);
    expect(groups.map((g) => g.entity)).toEqual(["카시오페아", "바드"]);
    expect(groups[0].notes.map((n) => n.id)).toEqual(["a", "c", "d"]);
    expect(groups[0].skills).toEqual(["E - 쌍독니", "Q - 유독성 폭발"]);
    expect(groups[0].id).toBe("a"); // 대표 id = 첫 줄
  });

  it("빈 입력은 빈 배열", () => {
    expect(groupNotesForNav([])).toEqual([]);
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
    });
  });

  it("상태별 집계 + 노트 엔티티 수(+원문 항목 수)", () => {
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

// ── sortRows "priority" (2026-09-18, 채점 라운드1 ST-9) ───────────────────────────
// 기본 정렬이 |Δ| 단독이면 첫 화면이 라인골드 "임계 미달"로 채워진다(실측 6행). 상태 우선순위
// (STATUS_SORT_PRIORITY: 미공지 → 간접 → 불일치 → …)를 먼저 보고 그 안에서 |Δ|로 정렬한다.
describe("sortRows — priority", () => {
  it("상태 우선순위가 |Δ|보다 먼저다", () => {
    const rows = [
      delta({ id: "gold-below", status: "below-threshold", delta: -0.9 }),
      delta({ id: "gap-small", status: "unannounced", delta: 0.01 }),
      delta({ id: "incons", status: "announced-inconsistent", delta: 0.5 }),
    ];
    expect(sortRows(rows, "priority", "desc").map((r) => r.id)).toEqual(["gap-small", "incons", "gold-below"]);
  });

  it("같은 상태 안에서는 |Δ| 내림차순", () => {
    const rows = [
      delta({ id: "gap-small", status: "unannounced", delta: 0.01 }),
      delta({ id: "gap-big", status: "unannounced", delta: -0.08 }),
    ];
    expect(sortRows(rows, "priority", "desc").map((r) => r.id)).toEqual(["gap-big", "gap-small"]);
  });

  it("asc는 전체를 뒤집는다(헤더 토글 대칭)", () => {
    const rows = [
      delta({ id: "gap", status: "unannounced", delta: 0.01 }),
      delta({ id: "none", status: "no-change", delta: 0.5 }),
    ];
    expect(sortRows(rows, "priority", "asc").map((r) => r.id)).toEqual(["none", "gap"]);
  });
});
