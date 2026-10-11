// src/components/home/__tests__/laneDistribution.test.ts
// computeLaneDistribution(laneDistribution.ts) 단위 테스트 — 라인별 미공지 엔티티 분포 집계.
// team-dev ST-C 프롬프트: 픽스처 데이터로 계산 로직만 검증한다(HANDOFF §4-1 실측 수치를
// 기댓값으로 박지 않음). banRate 계열은 라인 축 집계에서 항상 제외되어야 한다(HANDOFF §6).

import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { computeLaneDistribution, laneDistributionScope } from "../laneDistribution";

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
    n: { before: 1000, after: 1000 },
    q: 0.02,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

describe("computeLaneDistribution", () => {
  it("라인별로 서로 다른 엔티티를 분포시킨다(5라인 + all)", () => {
    const records = [
      delta({ id: "champion:A:TOP:pickRate", entityKey: "A" }),
      delta({ id: "champion:B:JUNGLE:pickRate", entityKey: "B" }),
      delta({ id: "champion:C:MIDDLE:pickRate", entityKey: "C" }),
      delta({ id: "champion:D:BOTTOM:pickRate", entityKey: "D" }),
      delta({ id: "champion:E:UTILITY:pickRate", entityKey: "E" }),
      delta({ id: "champion:F:pickRate", entityKey: "F" }),
    ];

    const rows = computeLaneDistribution(records);
    const byLane = Object.fromEntries(rows.map((r) => [r.lane, r.count]));

    expect(byLane.TOP).toBe(1);
    expect(byLane.JUNGLE).toBe(1);
    expect(byLane.MIDDLE).toBe(1);
    expect(byLane.BOTTOM).toBe(1);
    expect(byLane.UTILITY).toBe(1);
    expect(byLane.all).toBe(1);
  });

  it("같은 엔티티·같은 라인의 복수 metric 행은 1건으로 중복 제거한다", () => {
    const records = [
      delta({ id: "champion:A:TOP:pickRate", entityKey: "A", metric: "pickRate" }),
      delta({ id: "champion:A:TOP:winRate", entityKey: "A", metric: "winRate" }),
    ];

    const rows = computeLaneDistribution(records);
    const top = rows.find((r) => r.lane === "TOP");
    expect(top?.count).toBe(1);
  });

  it("banRate 계열은 라인 축 집계에서 제외한다", () => {
    const records = [delta({ id: "champion:A:banRate", entityKey: "A", metric: "banRate" })];
    const rows = computeLaneDistribution(records);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(0);
  });

  it("champion이 아닌 entityType이나 잘못된 형식 id는 제외한다", () => {
    const records = [
      delta({ id: "item:1001:adoptionRate", entityType: "item", entityKey: "1001", metric: "adoptionRate" }),
      delta({ id: "champion:B:FOO:pickRate", entityKey: "B" }),
    ];
    const rows = computeLaneDistribution(records);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(0);
  });

  it("분포 집계 합계가 입력 집합(중복 제거 후 유효 엔티티 수)과 일치한다", () => {
    const records = [
      delta({ id: "champion:A:TOP:pickRate", entityKey: "A" }),
      delta({ id: "champion:A:TOP:winRate", entityKey: "A", metric: "winRate" }),
      delta({ id: "champion:B:JUNGLE:pickRate", entityKey: "B" }),
      delta({ id: "champion:C:pickRate", entityKey: "C" }),
    ];
    const rows = computeLaneDistribution(records);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    // A(TOP, 중복제거로 1) + B(JUNGLE) + C(all) = 3
    expect(total).toBe(3);
  });
});

describe("분포 범위 표기(트랙 B ST-6, lol-S4)", () => {
  // 리뷰 실측: 사이드 「미공지 분포 … 전체 15」 vs 같은 화면 「미공지 Gap 36」 — 「전체」가 총계처럼 읽혔는데 실제로는 라인 축이
  // 없는(챔피언 전체 단위) 행의 대상 수였고, 라인 값이 없는 밴률 미공지·아이템·수치 축은 분포 어디에도 없었다.
  it("라인 축 없는 행의 라벨은 「라인 무관」이다(「전체」가 아니다)", () => {
    const rows = computeLaneDistribution([delta({ id: "champion:F:pickRate", entityKey: "F" })]);
    expect(rows.find((r) => r.lane === "all")?.label).toBe("라인 무관");
  });

  it("분포가 다룬 대상과 그 밖을 Gap 총계로 나눈다 — 대상 기준(라인이 여럿인 대상은 한 번)", () => {
    const records = [
      delta({ id: "champion:A:TOP:pickRate", entityKey: "A" }),
      delta({ id: "champion:A:MIDDLE:winRate", entityKey: "A" }),
      delta({ id: "champion:B:pickRate", entityKey: "B" }),
      delta({ id: "champion:C:banRate", entityKey: "C", metric: "banRate" }),
    ];
    expect(laneDistributionScope(records, 6)).toEqual({ gapTotal: 6, covered: 2, other: 4 });
  });

  it("Gap 총계보다 많이 셀 수 없다(음수 「그 밖」 금지)", () => {
    expect(laneDistributionScope([delta({ id: "champion:A:TOP:pickRate", entityKey: "A" })], 0)).toEqual({ gapTotal: 0, covered: 1, other: 0 });
  });
});
