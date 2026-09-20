// src/components/tft/__tests__/causeRows.test.ts
// 홈 "추정 원인" 목록의 선택 규칙 — **"검토하지 못했다"가 "원인이 없다"로 둔갑하지 않는지**가
// 핵심이다. `llm.skipped`(예산 초과·파싱 실패) 행을 올리면 빈 문장이 원인인 척한다.
import { describe, it, expect } from "vitest";

import { selectTftCauseRows } from "../causeRows";
import type { DeltaRecord } from "@/pipeline/types";

function rec(overrides: Partial<DeltaRecord> = {}): DeltaRecord {
  return {
    id: "unit:A:playRate",
    entityType: "unit",
    entityKey: "A",
    entityName: "가",
    metric: "playRate",
    before: 0.2,
    after: 0.28,
    delta: 0.08,
    ci: [0.04, 0.12],
    n: { before: 5000, after: 5000 },
    q: 0.001,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "", noteAnchor: null },
    ...overrides,
  };
}

const llmOk = { skipped: false as const, summary: "같은 특성 유닛이 함께 올랐습니다.", summaryCites: [], summaryVerified: true };

describe("selectTftCauseRows", () => {
  it("LLM 미실행(skipped) 행은 원인 목록에 올리지 않는다", () => {
    const rows = selectTftCauseRows(
      [rec({ id: "a", llm: { skipped: true, reason: "call-budget-exceeded" } })],
      0.1,
      8
    );
    expect(rows).toHaveLength(0);
  });

  it("요약도 원인도 없으면 올리지 않는다(빈 카드 방지)", () => {
    const rows = selectTftCauseRows(
      [rec({ id: "a", llm: { skipped: false, summary: "", summaryCites: [], summaryVerified: true } })],
      0.1,
      8
    );
    expect(rows).toHaveLength(0);
  });

  it("요약이 있으면 올리고, 인용 검증 실패는 플래그로 남긴다(숨기지 않는다)", () => {
    const rows = selectTftCauseRows(
      [rec({ id: "a", llm: { ...llmOk, summaryVerified: false } })],
      0.1,
      8
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].summaryVerified).toBe(false);
    expect(rows[0].summary).toBe(llmOk.summary);
  });

  it("보고 자격이 없는 관측은 표와 같은 기준으로 빠진다(효과크기 바닥 미달)", () => {
    // `isReportableRecord`는 n을 직접 보지 않는다 — 표본 게이트는 판정 엔진이 이미 status로
    // 접어 넣었고, 이 술어가 독립으로 보는 것은 유의성과 **효과크기 바닥**이다.
    const rows = selectTftCauseRows(
      [rec({ id: "a", before: 0.2, after: 0.2001, delta: 0.0001, ci: [0.00005, 0.00015], llm: llmOk })],
      0.1,
      8
    );
    expect(rows).toHaveLength(0);
  });

  it("정렬은 대조표와 같다 — 판정 우선순위가 먼저, 그다음 바닥 대비 배수", () => {
    const strongAnnounced = rec({
      id: "announced",
      status: "announced-consistent",
      delta: 0.15,
      after: 0.35,
      matchedNoteId: "n1",
      matchedNoteIds: ["n1"],
      llm: llmOk,
    });
    const weakUnannounced = rec({ id: "gap", delta: 0.05, after: 0.25, llm: llmOk });
    const rows = selectTftCauseRows([strongAnnounced, weakUnannounced], 0.1, 8);
    expect(rows.map((r) => r.record.id)).toEqual(["gap", "announced"]);
  });

  it("상한을 지킨다", () => {
    const many = Array.from({ length: 20 }, (_, i) => rec({ id: `d${i}`, llm: llmOk }));
    expect(selectTftCauseRows(many, 0.1, 8)).toHaveLength(8);
  });
});
