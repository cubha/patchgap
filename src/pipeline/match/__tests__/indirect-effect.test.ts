// src/pipeline/match/__tests__/indirect-effect.test.ts
// 간접 영향 재분류(indirect-effect.ts) 단위 테스트 — ST-IE1 TDD.
// 규칙: unannounced + verified 원인 후보(candidateNoteId 존재) + confidence ≥ medium → indirect-effect.

import { describe, expect, it } from "vitest";
import type { DeltaRecord, LlmCause, PatchNoteItem } from "../../types";
import {
  INDIRECT_EFFECT_MIN_CONFIDENCE,
  meetsIndirectEffectConfidence,
  reclassifyIndirectEffects,
} from "../indirect-effect";
import { indexNotesById } from "../verdict";

function cause(overrides: Partial<LlmCause>): LlmCause {
  return {
    text: "폭풍갈퀴 공격 속도 강화가 제리 라인전 파워를 높였을 수 있습니다",
    candidateNoteId: "note:26.17:item:stormrazor:0a1d6b43",
    verified: true,
    confidence: "medium",
    ...overrides,
  };
}

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Zeri:winRate",
    entityType: "champion",
    entityKey: "Zeri",
    entityName: "제리",
    metric: "winRate",
    before: 0.48,
    after: 0.5375,
    delta: 0.0575,
    ci: [0.01, 0.1],
    n: { before: 1000, after: 1000 },
    q: 0.08,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: ["KR_1"], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:26.17:item:stormrazor:0a1d6b43",
    patch: "26.17",
    section: "item",
    entity: "폭풍갈퀴",
    skill: null,
    stat: "공격 속도",
    before: "20%",
    after: "25%",
    direction: "buff",
    summary: "공격 속도: 20% ⇒ 25%",
    anchorUrl: "https://example.com/#stormrazor",
    anchorKind: "entity",
    modeScope: "core",
    ...overrides,
  };
}

describe("meetsIndirectEffectConfidence", () => {
  it("기본 임계값은 medium이다", () => {
    expect(INDIRECT_EFFECT_MIN_CONFIDENCE).toBe("medium");
  });

  it("high·medium은 통과, low는 미달", () => {
    expect(meetsIndirectEffectConfidence("high")).toBe(true);
    expect(meetsIndirectEffectConfidence("medium")).toBe(true);
    expect(meetsIndirectEffectConfidence("low")).toBe(false);
  });
});

describe("reclassifyIndirectEffects", () => {
  const notesById = indexNotesById([note({})]);

  it("unannounced + verified medium 후보 → indirect-effect로 재분류한다", () => {
    const rows = [delta({ causes: [cause({})] })];
    const { deltas, reclassifiedCount } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].status).toBe("indirect-effect");
    expect(reclassifiedCount).toBe(1);
  });

  it("판정 근거 노트의 anchorUrl을 evidence.noteAnchor에 채운다(원천 링크 원칙)", () => {
    const rows = [delta({ causes: [cause({})] })];
    const { deltas } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].evidence.noteAnchor).toBe("https://example.com/#stormrazor");
  });

  it("matchedNoteId/matchedNoteIds는 건드리지 않는다(1단 매칭 결과 오염 금지)", () => {
    const rows = [delta({ causes: [cause({})] })];
    const { deltas } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].matchedNoteId).toBeNull();
    expect(deltas[0].matchedNoteIds).toEqual([]);
  });

  it("confidence=low만 있으면 재분류하지 않는다", () => {
    const rows = [delta({ causes: [cause({ confidence: "low" })] })];
    const { deltas, reclassifiedCount } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].status).toBe("unannounced");
    expect(reclassifiedCount).toBe(0);
  });

  it("low와 medium이 섞여 있으면 medium 하나로 재분류된다", () => {
    const rows = [delta({ causes: [cause({ confidence: "low" }), cause({ confidence: "medium" })] })];
    const { deltas } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].status).toBe("indirect-effect");
  });

  it("verified=false 후보는 신뢰도가 높아도 무시한다", () => {
    const rows = [delta({ causes: [cause({ verified: false, confidence: "high" })] })];
    const { deltas } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].status).toBe("unannounced");
  });

  it("candidateNoteId가 null이면 무시한다(링크 걸 대상이 없음)", () => {
    const rows = [delta({ causes: [cause({ candidateNoteId: null })] })];
    const { deltas } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].status).toBe("unannounced");
  });

  it("status가 unannounced가 아니면(예: announced-inconsistent) 재분류 대상이 아니다", () => {
    const rows = [delta({ status: "announced-inconsistent", causes: [cause({})] })];
    const { deltas, reclassifiedCount } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].status).toBe("announced-inconsistent");
    expect(reclassifiedCount).toBe(0);
  });

  it("below-threshold(효과크기 바닥 미달)도 재분류 대상이 아니다", () => {
    const rows = [delta({ status: "below-threshold", causes: [cause({})] })];
    const { deltas } = reclassifyIndirectEffects(rows, notesById);
    expect(deltas[0].status).toBe("below-threshold");
  });

  it("후보 노트가 notesById에 없으면 status는 바꾸되 noteAnchor는 null로 둔다", () => {
    const rows = [delta({ causes: [cause({ candidateNoteId: "note:없는:id" })] })];
    const { deltas } = reclassifyIndirectEffects(rows, new Map());
    expect(deltas[0].status).toBe("indirect-effect");
    expect(deltas[0].evidence.noteAnchor).toBeNull();
  });

  it("원본 배열·레코드를 변경하지 않는다(불변)", () => {
    const original = delta({ causes: [cause({})] });
    reclassifyIndirectEffects([original], notesById);
    expect(original.status).toBe("unannounced");
    expect(original.evidence.noteAnchor).toBeNull();
  });

  it("임계값을 인자로 낮추면 low도 재분류된다(상수 조정 가능성 확인)", () => {
    const rows = [delta({ causes: [cause({ confidence: "low" })] })];
    const { deltas } = reclassifyIndirectEffects(rows, notesById, "low");
    expect(deltas[0].status).toBe("indirect-effect");
  });
});
