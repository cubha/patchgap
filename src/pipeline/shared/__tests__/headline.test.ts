// src/pipeline/shared/__tests__/headline.test.ts
// 헤드라인 수치 단일 소유(headline.ts) 계약.
//
// 이 파일이 고정하는 위험은 **표면마다 다른 수치**다. 2026-09-19에 웹 히어로만
// `isReportableRecord`로 옮기고 디스코드 웹훅을 두는 바람에, 같은 패치를 두고 사이트는
// 62개·29건 / 디스코드는 403개·31건을 말했다. 두 표면이 같은 함수를 부르는지는 타입이
// 지켜주지 않으므로(각자 다시 세도 컴파일은 통과한다) 여기서 술어 자체를 못박는다.
import { describe, expect, it } from "vitest";
import { countAnnouncedObservedEntities, countGapEntities, countReportable, verdictCount } from "../headline";
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

// ST-06(2026-10-08 site-review lol-S2·parity-S4): LoL 브리핑 결론 문장 「공지된 대상 19개 중 유의한 관측이 선 것은 76개」는
// 분자에 **전체** 보고 자격 행 수(히어로 M)를 넣고 있었다 — 부분이 전체보다 크다. 분자는 공지 대상 중 보고 자격 행이
// 있는 **대상** 수여야 하고, 세 게임이 같은 함수로 세야 한다.
describe("countAnnouncedObservedEntities — '공지된 대상 X개 중 유의한 관측이 선 것은 Y개'의 Y", () => {
  const announced = (key: string, metric: string, extra: Partial<DeltaRecord> = {}) =>
    row({ id: `champion:${key}:${metric}`, entityKey: key, metric, status: "announced-consistent", matchedNoteIds: [`note:${key}`], ...extra });

  it("공지 짝이 있고 보고 자격을 얻은 행의 **대상** 수 — 같은 대상의 여러 지표는 1", () => {
    const rows = [announced("Aatrox", "pickRate"), announced("Aatrox", "winRate"), announced("Elise", "pickRate")];
    expect(countAnnouncedObservedEntities(rows, 0.1)).toBe(2);
  });

  it("미공지 행은 세지 않는다 — 분자가 전체 유의 관측이 되면 분모를 넘는다", () => {
    const rows = [announced("Aatrox", "pickRate"), row({ entityKey: "Khazix", status: "unannounced", matchedNoteIds: [] })];
    expect(countAnnouncedObservedEntities(rows, 0.1)).toBe(1);
  });

  it("공지 짝이 있어도 보고 자격이 없으면(바닥 미달·비유의) 세지 않는다", () => {
    const rows = [announced("Aatrox", "pickRate", { q: 0.5 }), announced("Elise", "pickRate", { delta: 0.005, after: 0.105, ci: [0.001, 0.009] })];
    expect(countAnnouncedObservedEntities(rows, 0.1)).toBe(0);
  });

  it("빈 입력은 0", () => {
    expect(countAnnouncedObservedEntities([], 0.1)).toBe(0);
  });
});

// ST-11(site-review tft-S12·S17·parity-S34·pubg-S5): 푸터 「판정 N건」이 TFT는 노이즈까지 전 행(696 — 두 쌍이 같은 수),
// PUBG는 무기 수(47)였다. 세 게임이 같은 수를 말해야 하고, 그 수는 타일 「유의한 관측」과 같은 술어다.
describe("verdictCount — 푸터 '판정 N건'", () => {
  it("보고 자격 행 수와 같다 — countReportable과 한 술어", () => {
    const rows = [row({}), row({ entityKey: "Elise", q: 0.5 }), row({ entityKey: "Lulu", status: "insufficient-sample" })];
    expect(verdictCount(rows, 0.1)).toBe(countReportable(rows, 0.1));
    expect(verdictCount(rows, 0.1)).toBe(1);
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
