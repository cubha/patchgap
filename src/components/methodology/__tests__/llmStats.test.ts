// src/components/methodology/__tests__/llmStats.test.ts
// 방법론이 말하는 LLM 수치가 **데이터에서 나오는지** 고정한다. 리터럴로 적었다가 같은 라운드의
// 재생성에 뒤처져 화면이 거짓을 말한 적이 있다(독립 채점 K2-7).
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { computeLlmCauseStats, dominantConfidence } from "../llmStats";

function row(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:X:pickRate",
    entityType: "champion",
    entityKey: "X",
    entityName: "X",
    metric: "pickRate",
    before: 0.1,
    after: 0.12,
    delta: 0.02,
    ci: [0.01, 0.03],
    n: { before: 100, after: 100 },
    q: 0.01,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

describe("computeLlmCauseStats", () => {
  it("시도·미검출·검증 통과·신뢰도 분포를 센다", () => {
    const stats = computeLlmCauseStats([
      row({ llm: { skipped: false, summary: "a", summaryCites: [], summaryVerified: true }, causes: [] }),
      row({
        llm: { skipped: false, summary: "b", summaryCites: [], summaryVerified: true },
        causes: [
          { text: "t", candidateNoteId: "n1", verified: true, confidence: "medium" },
          { text: "u", candidateNoteId: null, verified: false, confidence: "low" },
        ],
      }),
      row({ llm: { skipped: true, reason: "call-budget-exceeded" }, causes: [] }),
      row({}), // llm 없음 — 시도 대상이 아니다
    ]);
    expect(stats.attempted).toBe(3);
    expect(stats.withoutCause).toBe(2);
    expect(stats.withVerifiedCause).toBe(1);
    expect(stats.confidence).toEqual({ high: 0, medium: 1, low: 0 });
  });

  it("빈 입력은 전부 0", () => {
    // 2026-09-19 **명세 변경**: `withUnverifiedCauseOnly` 통이 생겨 이 deep-equal에 칸이 하나
    // 늘었다. 통과시키려고 고친 것이 아니라 집계 구조 자체가 바뀐 경우다(최종 채점 K2-7 — 세 통의
    // 합이 attempted와 같아야 화면이 셈을 닫는다).
    expect(computeLlmCauseStats([])).toEqual({
      attempted: 0,
      withoutCause: 0,
      withVerifiedCause: 0,
      withUnverifiedCauseOnly: 0,
      confidence: { high: 0, medium: 0, low: 0 },
    });
  });
});

// 2026-09-19 최종 채점 K2-7(中): 방법론이 "대상 110건 중 못 찾은 것 28건, 검증 통과 81건"이라
// 말했는데 28+81=109다. `champion:Syndra:TOP:pickRate`는 원인 후보가 있으나 전부 검증에서 기각돼
// 어느 통에도 들어가지 않았다. 세 통의 합이 시도 수와 같아야 화면이 셈을 닫는다.
describe("셈이 닫힌다(최종 채점 K2-7)", () => {
  it("못 찾음 + 검증 통과 + 검증 미통과 = 시도", () => {
    const stats = computeLlmCauseStats([
      row({ llm: { skipped: false, summary: "a", summaryCites: [], summaryVerified: true }, causes: [] }),
      row({
        llm: { skipped: false, summary: "b", summaryCites: [], summaryVerified: true },
        causes: [{ text: "t", candidateNoteId: "n1", verified: true, confidence: "medium" }],
      }),
      row({
        // 후보는 냈으나 전부 기각 — 이 행이 어디에도 안 세지던 결함 그 자체다.
        llm: { skipped: false, summary: "c", summaryCites: [], summaryVerified: false },
        causes: [{ text: "u", candidateNoteId: null, verified: false, confidence: "low" }],
      }),
    ]);
    expect(stats.attempted).toBe(3);
    expect(stats.withoutCause).toBe(1);
    expect(stats.withVerifiedCause).toBe(1);
    expect(stats.withUnverifiedCauseOnly).toBe(1);
    expect(stats.withoutCause + stats.withVerifiedCause + stats.withUnverifiedCauseOnly).toBe(stats.attempted);
  });

  it("커밋된 판정 산출물에서도 셈이 닫힌다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "data", "aggregated", "deltas");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as { rows: DeltaRecord[] };
      const stats = computeLlmCauseStats(parsed.rows);
      expect(`${file}: ${stats.withoutCause + stats.withVerifiedCause + stats.withUnverifiedCauseOnly}`).toBe(
        `${file}: ${stats.attempted}`
      );
    }
  });
});

describe("dominantConfidence", () => {
  // 화면이 "낮음이 대부분"이라고 리터럴로 단언하면 프롬프트·모델이 바뀐 다음 라운드에 조용히
  // 거짓이 된다. 분포에서 뽑게 만들어 그 경로를 없앤다.
  it("가장 많은 등급을 고른다", () => {
    expect(dominantConfidence({ attempted: 0, withoutCause: 0, withVerifiedCause: 0, withUnverifiedCauseOnly: 0, confidence: { high: 2, medium: 9, low: 3 } })).toEqual({ label: "보통", count: 9 });
  });

  it("동률이면 보수적으로 낮은 쪽을 고른다", () => {
    expect(dominantConfidence({ attempted: 0, withoutCause: 0, withVerifiedCause: 0, withUnverifiedCauseOnly: 0, confidence: { high: 5, medium: 5, low: 5 } })).toEqual({ label: "낮음", count: 5 });
  });

  it("검증 통과 원인이 없으면 null — 할 말이 없다", () => {
    expect(dominantConfidence({ attempted: 3, withoutCause: 3, withVerifiedCause: 0, withUnverifiedCauseOnly: 0, confidence: { high: 0, medium: 0, low: 0 } })).toBeNull();
  });
});
