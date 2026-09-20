import { describe, it, expect } from "vitest";

import { TFT_MIN_BOARDS, aggregateTftBoards } from "../tft-boards";
import type { TftMatchSlim, TftParticipantSlim } from "../../types";

function board(placement: number, unitIds: string[], traits: string[] = [], itemIds: string[] = []): TftParticipantSlim {
  return {
    puuid: `p${placement}-${unitIds.join("")}`,
    placement,
    level: 9,
    lastRound: 30,
    timeEliminatedSec: 1800,
    goldLeft: 0,
    unitIds,
    itemIds,
    traits: traits.map((name) => ({ name, tier: 1, numUnits: 2 })),
  };
}

function match(participants: TftParticipantSlim[], id = "KR_1"): TftMatchSlim {
  return {
    matchId: id,
    patch: "18.2",
    gameDatetimeMs: 1789748962701,
    gameLengthSec: 2000,
    queueId: 1100,
    setNumber: 18,
    participants,
  };
}

describe("aggregateTftBoards — 분모", () => {
  it("등장률의 분모는 매치가 아니라 보드(참가자)다", () => {
    const agg = aggregateTftBoards([match([board(1, ["A"]), board(2, ["A"]), board(3, ["B"]), board(4, [])])], "18.2");
    expect(agg.matches).toBe(1);
    expect(agg.boards).toBe(4);
    expect(agg.units.find((u) => u.key === "A")?.playRate).toBe(0.5);
    expect(agg.units.find((u) => u.key === "B")?.playRate).toBe(0.25);
  });

  it("**같은 보드에 같은 유닛이 둘이어도 한 번만 센다** — 안 그러면 등장률이 1을 넘는다", () => {
    const agg = aggregateTftBoards([match([board(1, ["A", "A", "A"])])], "18.2");
    expect(agg.units.find((u) => u.key === "A")?.boards).toBe(1);
    expect(agg.units.find((u) => u.key === "A")?.playRate).toBe(1);
  });

  it("특성·아이템도 같은 규칙으로 센다", () => {
    const agg = aggregateTftBoards(
      [match([board(1, ["A"], ["T", "T"], ["I", "I"]), board(5, ["A"], [], [])])],
      "18.2"
    );
    expect(agg.traits.find((t) => t.key === "T")?.boards).toBe(1);
    expect(agg.items.find((i) => i.key === "I")?.boards).toBe(1);
  });
});

describe("aggregateTftBoards — 성적", () => {
  it("순방률은 등장한 보드 중 4등 이내 비율이다 (전체 보드가 아니라)", () => {
    const agg = aggregateTftBoards(
      [match([board(1, ["A"]), board(5, ["A"]), board(2, ["B"]), board(3, ["B"])])],
      "18.2"
    );
    expect(agg.units.find((u) => u.key === "A")?.top4Rate).toBe(0.5);
    expect(agg.units.find((u) => u.key === "B")?.top4Rate).toBe(1);
  });

  it("4등은 순방이고 5등은 아니다 — 8인 전투의 경계", () => {
    const agg = aggregateTftBoards([match([board(4, ["A"]), board(5, ["B"])])], "18.2");
    expect(agg.units.find((u) => u.key === "A")?.top4Rate).toBe(1);
    expect(agg.units.find((u) => u.key === "B")?.top4Rate).toBe(0);
  });

  it("평균 등수에 표준편차를 함께 낸다 — 없으면 연속 지표 p값을 못 낸다", () => {
    const agg = aggregateTftBoards([match([board(1, ["A"]), board(3, ["A"]), board(5, ["A"])])], "18.2");
    const a = agg.units.find((u) => u.key === "A");
    expect(a?.avgPlacement).toBe(3);
    // 표본표준편차(n-1): [1,3,5] → 2
    expect(a?.placementSd).toBeCloseTo(2, 6);
  });

  it("보드가 1개뿐이면 표준편차는 null — 0으로 두면 하류가 무한 확신을 갖는다", () => {
    const agg = aggregateTftBoards([match([board(4, ["A"])])], "18.2");
    expect(agg.units[0].placementSd).toBeNull();
  });

  it("평균 등수는 등장한 보드만으로 낸다", () => {
    const agg = aggregateTftBoards([match([board(1, ["A"]), board(7, ["A"]), board(4, ["B"])])], "18.2");
    expect(agg.units.find((u) => u.key === "A")?.avgPlacement).toBe(4);
    expect(agg.units.find((u) => u.key === "B")?.avgPlacement).toBe(4);
  });
});

describe("aggregateTftBoards — 표본 게이트", () => {
  it("표본이 모자라면 신뢰구간을 **주지 않는다** — 좁은 구간을 지어내면 하류가 유의하다고 읽는다", () => {
    const agg = aggregateTftBoards([match([board(1, ["A"])])], "18.2");
    expect(agg.units[0].top4Ci).toBeNull();
  });

  it("표본이 차면 Wilson 구간을 붙인다", () => {
    const boards = Array.from({ length: TFT_MIN_BOARDS }, (_, i) => board((i % 8) + 1, ["A"]));
    const agg = aggregateTftBoards([match(boards)], "18.2");
    const a = agg.units.find((u) => u.key === "A");
    expect(a?.boards).toBe(TFT_MIN_BOARDS);
    expect(a?.top4Ci).not.toBeNull();
    // Interval은 [low, high] 튜플이다(types.ts:11).
    expect(a?.top4Ci?.[0]).toBeLessThan(a!.top4Rate);
    expect(a?.top4Ci?.[1]).toBeGreaterThan(a!.top4Rate);
  });
});

describe("aggregateTftBoards — 요약·정렬", () => {
  it("등장률 내림차순으로 정렬한다", () => {
    const agg = aggregateTftBoards([match([board(1, ["A", "B"]), board(2, ["B"]), board(3, ["B"])])], "18.2");
    expect(agg.units.map((u) => u.key)).toEqual(["B", "A"]);
  });

  it("빈 입력에서 나눗셈이 터지지 않는다", () => {
    const agg = aggregateTftBoards([], "18.2");
    expect(agg).toMatchObject({ matches: 0, boards: 0, units: [], traits: [], items: [] });
    expect(agg.summary.avgGameLengthSec).toBe(0);
  });

  it("매치 평균은 매치 단위, 라운드 평균은 보드 단위다", () => {
    const agg = aggregateTftBoards([match([board(1, []), board(2, [])])], "18.2");
    expect(agg.summary.avgGameLengthSec).toBe(2000);
    expect(agg.summary.avgLastRound).toBe(30);
  });
});
