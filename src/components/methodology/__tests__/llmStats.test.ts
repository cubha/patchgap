// src/components/methodology/__tests__/llmStats.test.ts
// 방법론이 말하는 LLM 수치가 **데이터에서 나오는지** 고정한다. 리터럴로 적었다가 같은 라운드의
// 재생성에 뒤처져 화면이 거짓을 말한 적이 있다(독립 채점 K2-7).
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { computeLlmCauseStats } from "../llmStats";

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
    expect(computeLlmCauseStats([])).toEqual({
      attempted: 0,
      withoutCause: 0,
      withVerifiedCause: 0,
      confidence: { high: 0, medium: 0, low: 0 },
    });
  });
});
