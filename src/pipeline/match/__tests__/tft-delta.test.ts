import { describe, it, expect } from "vitest";

import { buildTftDeltas, type NamedStat, type TftAggregateNamed } from "../tft-delta";
import { TFT_MIN_BOARDS } from "../../aggregate/tft-boards";
import { isReportableRecord } from "../../shared/reportable";
import { STATUS_SORT_PRIORITY } from "../../shared/status-order";
import { EFFECT_SIZE_FLOORS } from "../../aggregate/stats";

function stat(key: string, boards: number, top4Rate: number, avgPlacement: number, totalBoards: number): NamedStat {
  return {
    kind: "unit",
    key,
    name: `이름-${key}`,
    boards,
    playRate: boards / totalBoards,
    top4Rate,
    top4Ci: null,
    avgPlacement,
    placementSd: 2.2,
  };
}

function agg(patch: string, boards: number, units: NamedStat[]): TftAggregateNamed {
  return {
    patch,
    matches: boards / 8,
    boards,
    units,
    traits: [],
    items: [],
    summary: { avgGameLengthSec: 2200, avgLastRound: 31 },
  };
}

const TOTAL = 16000;

describe("buildTftDeltas — 지표 산출", () => {
  const before = agg("18.1", TOTAL, [stat("A", 4000, 0.5, 4.5, TOTAL)]);
  const after = agg("18.2", TOTAL, [stat("A", 6000, 0.58, 4.1, TOTAL)]);
  const rows = buildTftDeltas(before, after);

  it("지표 3종을 낸다", () => {
    expect(rows.map((r) => r.metric).sort()).toEqual(["avgPlacement", "playRate", "top4Rate"]);
  });

  it("등장률의 분모는 전체 보드, 순방률의 분모는 등장 보드다", () => {
    expect(rows.find((r) => r.metric === "playRate")?.n).toEqual({ before: TOTAL, after: TOTAL });
    expect(rows.find((r) => r.metric === "top4Rate")?.n).toEqual({ before: 4000, after: 6000 });
  });

  it("id는 엔티티 종류·키·지표로 구성된다", () => {
    expect(rows.find((r) => r.metric === "playRate")?.id).toBe("unit:A:playRate");
  });

  it("status는 자리표시자 — verdict.assignStatus가 덮어쓴다", () => {
    expect(rows.every((r) => r.status === "no-change")).toBe(true);
  });

  it("모든 행이 집계 경로를 근거로 갖는다", () => {
    for (const r of rows) expect(r.evidence.aggregatePath).toContain("boards-18.2.json");
  });
});

describe("buildTftDeltas — 표본 게이트", () => {
  it("등장 보드가 모자라면 순방률·평균등수를 내지 않는다 — 등장률만 남는다", () => {
    const small = TFT_MIN_BOARDS - 1;
    const rows = buildTftDeltas(
      agg("18.1", TOTAL, [stat("A", small, 0.5, 4.5, TOTAL)]),
      agg("18.2", TOTAL, [stat("A", small, 0.6, 4.0, TOTAL)])
    );
    expect(rows.map((r) => r.metric)).toEqual(["playRate"]);
  });

  it("표준편차가 없으면 평균등수를 내지 않는다 — p값을 만들 수 없다", () => {
    const b = stat("A", 4000, 0.5, 4.5, TOTAL);
    const a = { ...stat("A", 4000, 0.5, 4.2, TOTAL), placementSd: null };
    const rows = buildTftDeltas(agg("18.1", TOTAL, [b]), agg("18.2", TOTAL, [a]));
    expect(rows.some((r) => r.metric === "avgPlacement")).toBe(false);
  });

  it("**표준편차가 undefined여도 막는다** — 낡은 집계 파일엔 그 필드가 아예 없다", () => {
    // 실측 사고(2026-09-20): placementSd를 추가하기 전에 만들어진 집계 JSON을 그대로 먹여
    // avgPlacement 델타 159건이 전부 ci=[null,null]·q=1로 나왔다. `!== null`은 undefined를 통과시킨다.
    const b = { ...stat("A", 4000, 0.5, 4.5, TOTAL), placementSd: undefined } as unknown as NamedStat;
    const a = stat("A", 4000, 0.5, 4.2, TOTAL);
    expect(buildTftDeltas(agg("18.1", TOTAL, [b]), agg("18.2", TOTAL, [a])).some((r) => r.metric === "avgPlacement")).toBe(
      false
    );
  });

  it("이전 패치에 없던 엔티티는 델타가 아니다", () => {
    const rows = buildTftDeltas(agg("18.1", TOTAL, []), agg("18.2", TOTAL, [stat("NEW", 3000, 0.5, 4.5, TOTAL)]));
    expect(rows).toEqual([]);
  });
});

describe("표시 규칙 상속 — LoL·PUBG와 같은 술어를 그대로 탄다", () => {
  const rows = buildTftDeltas(
    agg("18.1", TOTAL, [stat("BIG", 4000, 0.5, 4.5, TOTAL), stat("TINY", 4000, 0.5, 4.5, TOTAL)]),
    agg("18.2", TOTAL, [stat("BIG", 6400, 0.58, 4.1, TOTAL), stat("TINY", 4001, 0.5001, 4.5, TOTAL)])
  );

  it("TFT 지표 전부가 정렬 우선순위 표에 존재한다", () => {
    for (const r of rows) expect(STATUS_SORT_PRIORITY[r.status]).toBeTypeOf("number");
  });

  it("TFT 지표 전부가 효과크기 바닥을 갖는다 — 바닥 없는 지표는 바닥 검사를 통과해 버린다", () => {
    for (const r of rows) expect(EFFECT_SIZE_FLOORS[r.metric]).toBeDefined();
  });

  it("**미미한 변화는 isReportableRecord가 거른다** — TFT 전용 술어를 새로 만들지 않았다", () => {
    const tiny = rows.filter((r) => r.entityKey === "TINY");
    expect(tiny.length).toBeGreaterThan(0);
    for (const r of tiny) expect(isReportableRecord({ ...r, status: "unannounced" })).toBe(false);
  });

  it("큰 변화는 보고 자격을 얻는다", () => {
    const big = rows.find((r) => r.entityKey === "BIG" && r.metric === "playRate");
    expect(isReportableRecord({ ...big!, status: "unannounced" })).toBe(true);
  });
});

describe("BH-FDR", () => {
  it("모든 행에 q값이 붙는다", () => {
    const rows = buildTftDeltas(
      agg("18.1", TOTAL, [stat("A", 4000, 0.5, 4.5, TOTAL), stat("B", 3000, 0.5, 4.5, TOTAL)]),
      agg("18.2", TOTAL, [stat("A", 5000, 0.55, 4.2, TOTAL), stat("B", 3100, 0.51, 4.4, TOTAL)])
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.q).toBeGreaterThanOrEqual(0);
  });
});
