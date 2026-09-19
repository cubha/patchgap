import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WIN_RATE_MIN_N } from "../../aggregate/stats";
import { applyVerdicts, assignStatus, indexNotesById, sortDeltas, writeDeltas } from "../verdict";
import type { EntityMatchInfo, EntityMatchOutcome } from "../entity-match";
import type { DeltaRecord, MatchStatus, PatchNoteItem } from "../../types";

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Aatrox:winRate",
    entityType: "champion",
    entityKey: "Aatrox",
    entityName: "아트록스",
    metric: "winRate",
    before: 0.5,
    after: 0.55,
    delta: 0.05,
    ci: [0.01, 0.09], // 0 미포함
    n: { before: WIN_RATE_MIN_N, after: WIN_RATE_MIN_N },
    q: 0.01, // < 0.10 → 유의
    status: "no-change",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...overrides,
  };
}

const CONSISTENT_MATCH: EntityMatchInfo = { noteIds: ["n1"], directionAgreement: "consistent" };
const INCONSISTENT_MATCH: EntityMatchInfo = { noteIds: ["n1"], directionAgreement: "inconsistent" };
const NEUTRAL_MATCH: EntityMatchInfo = { noteIds: ["n1"], directionAgreement: "neutral" };

describe("assignStatus", () => {
  it("유의 + 노트 짝(방향 일치) → announced-consistent", () => {
    expect(assignStatus(delta({}), CONSISTENT_MATCH)).toBe("announced-consistent");
  });

  it("유의 + 노트 짝(방향 불일치) → announced-inconsistent", () => {
    expect(assignStatus(delta({}), INCONSISTENT_MATCH)).toBe("announced-inconsistent");
  });

  it("유의 + 노트 짝(방향 중립) → announced-inconsistent", () => {
    expect(assignStatus(delta({}), NEUTRAL_MATCH)).toBe("announced-inconsistent");
  });

  it("유의 + 노트 짝 없음 → unannounced", () => {
    expect(assignStatus(delta({}), null)).toBe("unannounced");
  });

  it("비유의(q>=0.10) + 노트 짝 있음 → announced-inconsistent", () => {
    const d = delta({ q: 0.5 });
    expect(assignStatus(d, CONSISTENT_MATCH)).toBe("announced-inconsistent");
  });

  it("비유의 + 노트 짝 없음 → no-change", () => {
    const d = delta({ q: 0.5 });
    expect(assignStatus(d, null)).toBe("no-change");
  });

  it("CI가 0을 포함하면(비유의 취급) 노트 짝 없어도 no-change", () => {
    const d = delta({ q: 0.01, ci: [-0.01, 0.09] });
    expect(assignStatus(d, null)).toBe("no-change");
  });

  it("winRate + n 게이트 미달은 유의/노트 여부와 무관하게 무조건 insufficient-sample", () => {
    const d = delta({ n: { before: 50, after: 300 } });
    expect(assignStatus(d, CONSISTENT_MATCH)).toBe("insufficient-sample");
    expect(assignStatus(d, null)).toBe("insufficient-sample");
    expect(assignStatus(delta({ n: { before: 50, after: 300 }, q: 0.9 }), null)).toBe(
      "insufficient-sample"
    );
  });

  it("winRate가 아닌 지표(pickRate)는 n 게이트를 적용하지 않는다", () => {
    const d = delta({ metric: "pickRate", n: { before: 10, after: 10 } });
    expect(assignStatus(d, null)).toBe("unannounced");
  });
});

describe("assignStatus — 효과크기 바닥 (2026-09-13 신규)", () => {
  it("유의 + 짝 없음 + pickRate |delta|=0.015(바닥 0.02 미달) → below-threshold(unannounced 아님)", () => {
    const d = delta({ metric: "pickRate", delta: 0.015, ci: [0.005, 0.025] });
    expect(assignStatus(d, null)).toBe("below-threshold");
  });

  it("유의 + 짝 없음 + pickRate |delta|=0.025(바닥 초과) → 그대로 unannounced", () => {
    const d = delta({ metric: "pickRate", delta: 0.025, ci: [0.015, 0.035] });
    expect(assignStatus(d, null)).toBe("unannounced");
  });

  it("설계 정정 회귀 가드 — 유의 + 짝 있음(일치) + 바닥 미달이어도 announced-consistent 그대로다"
    + "(바닥을 isSignificant()에 걸면 이 케이스가 announced-inconsistent로 뒤집히는 회귀가 생긴다)", () => {
    const d = delta({ metric: "pickRate", delta: 0.005, ci: [0.001, 0.009] });
    expect(assignStatus(d, CONSISTENT_MATCH)).toBe("announced-consistent");
  });

  it("설계 정정 회귀 가드 — 유의 + 짝 있음(불일치) + 바닥 미달이어도 announced-inconsistent 그대로다", () => {
    const d = delta({ metric: "pickRate", delta: 0.005, ci: [0.001, 0.009] });
    expect(assignStatus(d, INCONSISTENT_MATCH)).toBe("announced-inconsistent");
  });

  it("adoptionRate 상대기준 — before=0.04, delta=0.009(상대 22.5%, 미달) → below-threshold", () => {
    const d = delta({ metric: "adoptionRate", before: 0.04, delta: 0.009, ci: [0.005, 0.013] });
    expect(assignStatus(d, null)).toBe("below-threshold");
  });

  it("adoptionRate 상대기준 — before=0.04, delta=0.011(상대 27.5%, 충족) → unannounced", () => {
    const d = delta({ metric: "adoptionRate", before: 0.04, delta: 0.011, ci: [0.007, 0.015] });
    expect(assignStatus(d, null)).toBe("unannounced");
  });

  // 명세 변경(2026-09-13 2차): 연속 지표 바닥이 0 → 상대 3%(골드)로 바뀌었다. 라인 골드 행은
  // entity-match가 구조적으로 노트와 짝지어 주지 않으므로("짝 없음"이 관측이 아니라 전제),
  // 규모 바닥을 넘지 못하면 미공지로 올리지 않는다.
  it("연속 지표(goldAt14) 상대 1.2% 변화는 바닥 미달 → below-threshold", () => {
    const d = delta({ metric: "goldAt14", before: 6000, delta: 72, ci: [16, 128] });
    expect(assignStatus(d, null)).toBe("below-threshold");
  });

  it("연속 지표(goldAt14) 상대 3% 이상 변화는 여전히 unannounced로 올라온다", () => {
    const d = delta({ metric: "goldAt14", before: 6000, delta: 200, ci: [140, 260] });
    expect(assignStatus(d, null)).toBe("unannounced");
  });

  it("adoptionRate 기저 게이트 — 상대 33%여도 채택률이 1% 미만이면 below-threshold", () => {
    const d = delta({ metric: "adoptionRate", before: 0.00237, delta: 0.00079, ci: [0.0002, 0.0014] });
    expect(assignStatus(d, null)).toBe("below-threshold");
  });

  it("insufficient-sample(n 게이트)이 효과크기 바닥보다 우선한다", () => {
    const d = delta({
      metric: "winRate",
      n: { before: 50, after: 300 },
      delta: 0.05,
      ci: [0.01, 0.09],
    });
    expect(assignStatus(d, null)).toBe("insufficient-sample");
  });
});

describe("applyVerdicts", () => {
  it("매칭 결과로 status/matchedNoteId(s)/evidence.noteAnchor를 채운다", () => {
    const notes: PatchNoteItem[] = [
      {
        id: "n1",
        patch: "26.17",
        section: "champion",
        entity: "아트록스",
        skill: "Q",
        stat: "피해량",
        before: "10",
        after: "20",
        direction: "buff",
        summary: "피해량: 10 ⇒ 20",
        anchorUrl: "https://example.com/#patch-aatrox",
        anchorKind: "entity",
        modeScope: "core",
      },
    ];
    const deltas = [delta({ id: "champion:Aatrox:winRate" })];
    const outcome: EntityMatchOutcome = {
      matches: new Map([["champion:Aatrox:winRate", CONSISTENT_MATCH]]),
      mappingFailures: [],
    };

    const result = applyVerdicts(deltas, outcome, indexNotesById(notes));
    expect(result[0].status).toBe("announced-consistent");
    expect(result[0].matchedNoteId).toBe("n1");
    expect(result[0].matchedNoteIds).toEqual(["n1"]);
    expect(result[0].evidence.noteAnchor).toBe("https://example.com/#patch-aatrox");
  });

  it("매칭 없는 델타는 matchedNoteId=null·noteAnchor=null 유지", () => {
    const deltas = [delta({ id: "champion:Aatrox:winRate", q: 0.9 })];
    const outcome: EntityMatchOutcome = { matches: new Map(), mappingFailures: [] };

    const result = applyVerdicts(deltas, outcome, indexNotesById([]));
    expect(result[0].status).toBe("no-change");
    expect(result[0].matchedNoteId).toBeNull();
    expect(result[0].matchedNoteIds).toEqual([]);
    expect(result[0].evidence.noteAnchor).toBeNull();
  });

  it("원본 배열을 변경하지 않는다(불변)", () => {
    const original = delta({ id: "champion:Aatrox:winRate" });
    const deltas = [original];
    const outcome: EntityMatchOutcome = { matches: new Map(), mappingFailures: [] };
    applyVerdicts(deltas, outcome, indexNotesById([]));
    expect(original.status).toBe("no-change"); // 원본 값 그대로(mutate 안 됨)
  });
});

describe("sortDeltas", () => {
  it("status 우선순위(unannounced > announced-inconsistent > announced-consistent > insufficient-sample > no-change) → |delta| 내림차순", () => {
    const rows: Array<{ status: MatchStatus; delta: number | null; id: string }> = [
      { status: "no-change", delta: 0.5, id: "a" },
      { status: "unannounced", delta: 0.01, id: "b" },
      { status: "announced-consistent", delta: 0.9, id: "c" },
      { status: "unannounced", delta: 0.5, id: "d" },
      { status: "insufficient-sample", delta: null, id: "e" },
      { status: "announced-inconsistent", delta: -0.3, id: "f" },
    ];
    const deltas = rows.map((r) => delta({ id: r.id, status: r.status, delta: r.delta }));
    const sorted = sortDeltas(deltas).map((d) => d.id);
    // unannounced 그룹 내에서는 |delta| 내림차순: d(0.5) 앞에, b(0.01) 뒤
    expect(sorted).toEqual(["d", "b", "f", "c", "e", "a"]);
  });

  it("below-threshold는 unannounced보다 아래, insufficient-sample보다 위다(2026-09-13 신규)", () => {
    const rows: Array<{ status: MatchStatus; delta: number | null; id: string }> = [
      { status: "insufficient-sample", delta: null, id: "i" },
      { status: "unannounced", delta: 0.5, id: "u" },
      { status: "below-threshold", delta: 0.01, id: "t" },
      { status: "no-change", delta: 0.9, id: "n" },
    ];
    const deltas = rows.map((r) => delta({ id: r.id, status: r.status, delta: r.delta }));
    const sorted = sortDeltas(deltas).map((d) => d.id);
    expect(sorted).toEqual(["u", "t", "i", "n"]);
  });
});

describe("writeDeltas", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "verdict-write-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("deltas/{from}_{to}.json에 정렬된 rows + meta(counts 포함)를 기록한다", () => {
    const deltas = [
      delta({ id: "a", status: "unannounced", delta: 0.5 }),
      delta({ id: "b", status: "no-change", delta: 0.01 }),
    ];
    const result = writeDeltas({ from: "26.16", to: "26.17", deltas, dataRoot: tmpRoot });

    expect(result.filePath).toBe(path.join(tmpRoot, "aggregated", "deltas", "26.16_26.17.json"));
    expect(fs.existsSync(result.filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(result.filePath, "utf8"));
    expect(written.meta.from).toBe("26.16");
    expect(written.meta.to).toBe("26.17");
    expect(written.meta.n).toBe(2);
    expect(written.meta.counts).toEqual({ unannounced: 1, "no-change": 1 });
    expect(written.rows[0].id).toBe("a"); // unannounced가 우선순위 최상단
    expect(written.rows[1].id).toBe("b");
  });

  it("llm 메타를 전달하면 meta.llm에 그대로 실린다", () => {
    const deltas = [delta({ id: "a" })];
    const llm = {
      calls: 3,
      cacheHits: 1,
      skipped: 0,
      usage: { inputTokens: 100, cacheReadInputTokens: 50, cacheCreationInputTokens: 0, outputTokens: 20 },
    };
    const result = writeDeltas({ from: "26.16", to: "26.17", deltas, llm, dataRoot: tmpRoot });
    const written = JSON.parse(fs.readFileSync(result.filePath, "utf8"));
    expect(written.meta.llm).toEqual(llm);
  });
});
