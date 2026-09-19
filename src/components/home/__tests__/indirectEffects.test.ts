// src/components/home/__tests__/indirectEffects.test.ts
// 홈 Gap 탭의 인과 체인 조회(indirectEffects.ts) 단위 테스트 — ST-IE6 TDD에서 시작해
// 2026-09-17(B2 Gap 통합)에 `selectIndirectEffects`(정렬·상한 포함) → `indexIndirectCauses`
// (순수 조회)로 계약이 바뀌었다. 정렬·상한 테스트는 그래서 사라진 게 아니라 **소유자가
// 옮겨간 것**이다 — 목록 순서는 이제 `releaseStream.ts`(maxAbsDelta)가 단독으로 소유한다.
// "드레이븐 패턴"(챔피언 노트 0건인데 픽/밴/승률 이동 ← 그 챔프가 올리는 아이템 변경)을
// 인과 체인으로 보여주기 위해 델타 + 원인 노트를 묶어 반환한다는 목적 자체는 그대로다.

import { describe, expect, it } from "vitest";
import type { DeltaRecord, DeltasFile, LlmCause, PatchNoteItem } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { indexIndirectCauses } from "../indirectEffects";

function cause(overrides: Partial<LlmCause>): LlmCause {
  return {
    text: "폭풍갈퀴 공격 속도 강화가 제리 라인전 파워를 높였을 수 있습니다",
    candidateNoteId: "note:item:stormrazor",
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
    status: "indirect-effect",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [cause({})],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: "https://example.com/#stormrazor" },
    ...overrides,
  };
}

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:item:stormrazor",
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

function deltasFile(rows: DeltaRecord[]): DeltasFile {
  return {
    meta: { from: "26.16", to: "26.17", generatedAt: "2026-09-13T00:00:00.000Z", n: rows.length, counts: {}, qAlpha: 0.1 },
    rows,
  };
}

function notesFile(items: PatchNoteItem[]): NotesFile {
  return {
    meta: { patch: "26.17", sourceUrl: "https://example.com", fetchedAt: "2026-09-13T00:00:00.000Z", itemCount: items.length },
    summary: "요약",
    sections: [],
    items,
  };
}

describe("indexIndirectCauses", () => {
  it("deltas/notes가 null이면 빈 객체", () => {
    expect(indexIndirectCauses(null, null)).toEqual({});
  });

  it("indirect-effect 행만 색인한다(unannounced·below-threshold 제외)", () => {
    const rows = [
      delta({ id: "a", status: "indirect-effect" }),
      delta({ id: "b", status: "unannounced" }),
      delta({ id: "c", status: "below-threshold" }),
    ];
    expect(Object.keys(indexIndirectCauses(deltasFile(rows), notesFile([note({})])))).toEqual(["a"]);
  });

  it("원인 노트를 해석해 엔티티·섹션·앵커를 함께 반환한다(인과 체인)", () => {
    const index = indexIndirectCauses(deltasFile([delta({})]), notesFile([note({})]));
    const entry = index["champion:Zeri:winRate"];
    expect(entry.causeEntity).toBe("폭풍갈퀴");
    expect(entry.causeSection).toBe("item");
    expect(entry.causeAnchor).toBe("https://example.com/#stormrazor");
    expect(entry.causeText).toContain("폭풍갈퀴");
  });

  it("상한이 없다 — 행이 몇 개든 전부 색인한다(상한을 두면 어떤 행의 원인만 조용히 사라진다)", () => {
    const rows = Array.from({ length: 8 }, (_, i) => delta({ id: `d${i}`, delta: (8 - i) / 100 }));
    expect(Object.keys(indexIndirectCauses(deltasFile(rows), notesFile([note({})])))).toHaveLength(8);
  });

  it("임계 신뢰도 미만(low) 후보만 있는 행은 제외한다 — 재분류 규칙과 같은 기준을 쓴다", () => {
    const rows = [delta({ id: "low-only", causes: [cause({ confidence: "low" })] })];
    expect(indexIndirectCauses(deltasFile(rows), notesFile([note({})]))).toEqual({});
  });

  it("후보 노트가 notes에 없으면 엔티티는 null이되 항목 자체는 유지한다(status는 이미 확정)", () => {
    const rows = [delta({ causes: [cause({ candidateNoteId: "note:없음" })] })];
    const index = indexIndirectCauses(deltasFile(rows), notesFile([note({})]));
    expect(Object.keys(index)).toHaveLength(1);
    expect(index["champion:Zeri:winRate"].causeEntity).toBeNull();
    expect(index["champion:Zeri:winRate"].causeAnchor).toBeNull();
  });
});
