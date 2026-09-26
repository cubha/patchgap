import { describe, it, expect } from "vitest";

import { buildTftDeltas, type NamedStat, type TftAggregateNamed } from "../tft-delta";
import { assignStatus } from "../verdict";
import { TFT_MIN_BOARDS } from "../../aggregate/tft-boards";
import { isReportableRecord } from "../../shared/reportable";
import { STATUS_SORT_PRIORITY } from "../../shared/status-order";
import { EFFECT_SIZE_FLOORS, WIN_RATE_MIN_N } from "../../aggregate/stats";

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
  // 2026-09-27 명세 변경: 전에는 표본 미달 엔티티의 순방률·평균등수 행을 **아예 내지 않았다** —
  // 그래서 TFT에는 `insufficient-sample`이 한 건도 찍히지 않았고, "판정 유보"와 "관측 없음"이
  // 화면·방법론에서 구분되지 않았다(LoL은 승률 n<200을 행으로 내고 표본 부족으로 찍는다).
  // 이제 행은 내되 BH 가족에서 빼고(q=null) `assignStatus`가 표본 부족으로 찍는다.
  it("등장 보드가 모자라도 순방률·평균등수 행을 내고, 판정은 insufficient-sample이다", () => {
    const small = TFT_MIN_BOARDS - 1;
    const rows = buildTftDeltas(
      agg("18.1", TOTAL, [stat("A", small, 0.5, 4.5, TOTAL)]),
      agg("18.2", TOTAL, [stat("A", small, 0.6, 4.0, TOTAL)])
    );
    expect(rows.map((r) => r.metric).sort()).toEqual(["avgPlacement", "playRate", "top4Rate"]);
    for (const r of rows.filter((x) => x.metric !== "playRate")) {
      expect(r.q).toBeNull();
      expect(assignStatus(r, null)).toBe("insufficient-sample");
      expect(assignStatus(r, { noteIds: ["n1"], directionAgreement: "consistent" })).toBe("insufficient-sample");
    }
  });

  it("표본 미달 행은 BH 가족에 들어가지 않는다 — 다른 행의 q가 그대로다", () => {
    const big = [stat("A", 4000, 0.5, 4.5, TOTAL), stat("B", 3000, 0.5, 4.5, TOTAL)];
    const bigAfter = [stat("A", 5000, 0.55, 4.2, TOTAL), stat("B", 3100, 0.51, 4.4, TOTAL)];
    const without = buildTftDeltas(agg("18.1", TOTAL, big), agg("18.2", TOTAL, bigAfter));
    const withSmall = buildTftDeltas(
      agg("18.1", TOTAL, [...big, stat("S", 50, 0.2, 6.5, TOTAL)]),
      agg("18.2", TOTAL, [...bigAfter, stat("S", 60, 0.9, 1.5, TOTAL)])
    );
    // 등장률 행은 전체 보드가 분모라 표본 미달이 아니다 — 가족에 들어가므로 S:playRate만큼 q가 변할 수 있다.
    // 그래서 비교는 "S의 조건부 지표를 뺐을 때와 같은가"로 한다: S:playRate를 가진 채 조건부 지표만 추가된 경우.
    const withSmallPlayOnly = buildTftDeltas(
      agg("18.1", TOTAL, [...big, { ...stat("S", 50, 0.2, 6.5, TOTAL), placementSd: null }]),
      agg("18.2", TOTAL, [...bigAfter, { ...stat("S", 60, 0.9, 1.5, TOTAL), placementSd: null }])
    );
    expect(without.length).toBeGreaterThan(0);
    const qOf = (rows: typeof without) => Object.fromEntries(rows.filter((r) => !r.id.startsWith("unit:S:")).map((r) => [r.id, r.q]));
    // top4Rate(S)는 추가됐지만 q 계산에는 참여하지 않는다 → 나머지 q가 등장률만 있는 경우와 같아야 한다.
    expect(qOf(withSmall)).toEqual(qOf(withSmallPlayOnly));
  });

  it("TFT 표본 하한과 판정 엔진의 n 게이트 임계가 같다 — 갈라지면 행은 나오는데 판정이 어긋난다", () => {
    expect(TFT_MIN_BOARDS).toBe(WIN_RATE_MIN_N);
  });

  it("winRate·top4Rate·avgPlacement만 개체 n 게이트를 탄다 — 등장률(전체 보드 분모)은 아니다", () => {
    const rows = buildTftDeltas(
      agg("18.1", TOTAL, [stat("A", 10, 0.5, 4.5, TOTAL)]),
      agg("18.2", TOTAL, [stat("A", 12, 0.5, 4.5, TOTAL)])
    );
    const play = rows.find((r) => r.metric === "playRate");
    expect(play?.q).not.toBeNull();
    expect(play && assignStatus(play, null)).not.toBe("insufficient-sample");
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

describe("원천 매치 — evidence.matchIds", () => {
  it("이후 패치 집계의 표본 매치 id를 근거로 싣는다", () => {
    const b = stat("A", 4000, 0.5, 4.5, TOTAL);
    const a = { ...stat("A", 5000, 0.55, 4.2, TOTAL), sampleMatchIds: ["KR_9", "KR_10"] };
    const rows = buildTftDeltas(agg("18.1", TOTAL, [b]), agg("18.2", TOTAL, [a]));
    for (const r of rows) expect(r.evidence.matchIds).toEqual(["KR_9", "KR_10"]);
  });

  it("표본 id가 없는 낡은 집계 파일이면 빈 배열(지어내지 않는다)", () => {
    const rows = buildTftDeltas(agg("18.1", TOTAL, [stat("A", 4000, 0.5, 4.5, TOTAL)]), agg("18.2", TOTAL, [stat("A", 5000, 0.55, 4.2, TOTAL)]));
    for (const r of rows) expect(r.evidence.matchIds).toEqual([]);
  });
});

