// src/pipeline/shared/__tests__/headline.test.ts
// 헤드라인 수치 단일 소유(headline.ts) 계약.
//
// 이 파일이 고정하는 위험은 **표면마다 다른 수치**다. 2026-09-19에 웹 히어로만
// `isReportableRecord`로 옮기고 디스코드 웹훅을 두는 바람에, 같은 패치를 두고 사이트는
// 62개·29건 / 디스코드는 403개·31건을 말했다. 두 표면이 같은 함수를 부르는지는 타입이
// 지켜주지 않으므로(각자 다시 세도 컴파일은 통과한다) 여기서 술어 자체를 못박는다.
import { describe, expect, it } from "vitest";
import { countGapEntities, countReportable } from "../headline";
import type { DeltaRecord, MatchStatus } from "../../types";

function row(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Aatrox:pickRate",
    entityType: "champion",
    entityKey: "Aatrox",
    entityName: "아트록스",
    metric: "pickRate",
    before: 0.1,
    after: 0.15,
    delta: 0.05,
    ci: [0.03, 0.07],
    n: { before: 6000, after: 6000 },
    q: 0.01,
    status: "unannounced" as MatchStatus,
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...overrides,
  };
}

describe("countReportable — '통계는 M개 변화를 말합니다'", () => {
  it("유의하고 효과크기 바닥을 넘은 행만 센다", () => {
    expect(countReportable([row({})], 0.1)).toBe(1);
  });

  it("효과크기 바닥 미달은 제외한다 — 유의해도 어느 목록에도 렌더되지 않는다", () => {
    // pickRate 바닥은 0.02(절대). 이것이 403 중 321건을 만들던 부류다.
    const belowFloor = row({ delta: 0.005, after: 0.105, ci: [0.001, 0.009] });
    expect(countReportable([belowFloor], 0.1)).toBe(0);
  });

  it("q가 alpha 이상이면 제외한다", () => {
    expect(countReportable([row({ q: 0.5 })], 0.1)).toBe(0);
  });

  it("CI가 0을 포함하면 제외한다", () => {
    expect(countReportable([row({ ci: [-0.01, 0.09] })], 0.1)).toBe(0);
  });

  it("표본 부족은 제외한다", () => {
    expect(countReportable([row({ status: "insufficient-sample" })], 0.1)).toBe(0);
  });
});

describe("countGapEntities — '미공지 N건'", () => {
  it("같은 엔티티의 여러 지표 행은 1건으로 센다", () => {
    const rows = [
      row({ id: "champion:Aatrox:pickRate", metric: "pickRate" }),
      row({ id: "champion:Aatrox:winRate", metric: "winRate" }),
    ];
    expect(countGapEntities(rows)).toBe(1);
  });

  it("서로 다른 엔티티는 각각 센다", () => {
    const rows = [row({ entityKey: "Aatrox" }), row({ entityKey: "Ahri" })];
    expect(countGapEntities(rows)).toBe(2);
  });

  it("indirect-effect도 Gap에 포함한다 — 화면 Gap 탭과 같은 묶음이다", () => {
    const rows = [
      row({ entityKey: "Aatrox", status: "indirect-effect" }),
      row({ entityKey: "Ahri", status: "unannounced" }),
    ];
    expect(countGapEntities(rows)).toBe(2);
  });

  it("Gap이 아닌 상태는 세지 않는다", () => {
    const rows = [row({ status: "announced-consistent" }), row({ status: "no-change" })];
    expect(countGapEntities(rows)).toBe(0);
  });

  it("엔티티 타입이 다르면 키가 같아도 별개다", () => {
    const rows = [
      row({ entityType: "champion", entityKey: "X" }),
      row({ entityType: "item", entityKey: "X" }),
    ];
    expect(countGapEntities(rows)).toBe(2);
  });
});
