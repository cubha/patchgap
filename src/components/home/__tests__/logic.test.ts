// src/components/home/__tests__/logic.test.ts
// 브리핑 홈 순수 로직(logic.ts) 단위 테스트 — 요약 수치 계산·상위 N 선택·추정 원인 표기·
// metric→DeltaValue kind 매핑. ST-11 완료 조건("요약 수치 계산 함수(순수 함수로 분리:
// computeHeadline(deltas, notes))").

import { describe, expect, it } from "vitest";
import type { DeltaRecord, LlmCause, PatchNoteItem } from "@/pipeline/types";
import type { DeltasFile } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import {
  absDelta,
  computeHeadline,
  countRelevantNoteEntities,
  entityFallbackLabel,
  excludeObservation,
  resolveGapCause,
  formatMetricValue,
  formatNotePreviewText,
  formatObservedSummary,
  indexNotesById,
  isSignificantDelta,
  metricKind,
  selectAnnouncedPreview,
  selectTopUnannounced,
} from "../logic";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:26.17:champion:x:0000",
    patch: "26.17",
    section: "champion",
    entity: "테스트챔프",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "테스트 요약",
    anchorUrl: "https://example.com/#x",
    anchorKind: "entity",
    modeScope: "core",
    ...overrides,
  };
}

function notesFile(items: PatchNoteItem[]): NotesFile {
  return {
    meta: { patch: "26.17", sourceUrl: "https://example.com", fetchedAt: "2026-09-05T00:00:00.000Z", itemCount: items.length },
    summary: "요약",
    sections: [],
    items,
  };
}

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

function deltasFile(rows: DeltaRecord[]): DeltasFile {
  return {
    meta: { from: "26.16", to: "26.17", generatedAt: "2026-09-05T05:00:00.000Z", n: rows.length, counts: {}, qAlpha: 0.1 },
    rows,
  };
}

describe("countRelevantNoteEntities", () => {
  it("null이면 0", () => {
    expect(countRelevantNoteEntities(null)).toBe(0);
  });

  it("champion·item 섹션만 세고, 같은 엔티티 여러 줄은 1건으로 묶는다", () => {
    const notes = notesFile([
      note({ id: "a", entity: "아우렐리온 솔", section: "champion" }),
      note({ id: "b", entity: "아우렐리온 솔", section: "champion" }),
      note({ id: "c", entity: "폭풍갈퀴", section: "item" }),
      note({ id: "d", entity: "시스템 변경", section: "system" }),
      note({ id: "e", entity: "기타", section: "other" }),
    ]);
    expect(countRelevantNoteEntities(notes)).toBe(2);
  });
});

describe("isSignificantDelta", () => {
  it("q<0.10 & CI가 0을 포함하지 않으면 유의", () => {
    expect(isSignificantDelta(delta({ q: 0.02, ci: [0.01, 0.03] }))).toBe(true);
  });

  it("q===null이면 비유의", () => {
    expect(isSignificantDelta(delta({ q: null, ci: [0.01, 0.03] }))).toBe(false);
  });

  it("q>=0.10이면 비유의", () => {
    expect(isSignificantDelta(delta({ q: 0.1, ci: [0.01, 0.03] }))).toBe(false);
  });

  it("CI가 0을 포함하면 비유의(자기쌍처럼 delta≈0인 경우)", () => {
    expect(isSignificantDelta(delta({ q: 0.02, ci: [-0.01, 0.01] }))).toBe(false);
  });

  it("status==='insufficient-sample'이면 q·CI가 유의해 보여도 무조건 비유의", () => {
    expect(
      isSignificantDelta(delta({ status: "insufficient-sample", q: 0.01, ci: [0.5, 0.9] }))
    ).toBe(false);
  });
});

describe("computeHeadline", () => {
  it("deltas·notes 둘 다 null이면 전부 0(빈 상태 렌더 보장)", () => {
    expect(computeHeadline(null, null)).toEqual({
      noteEntityCount: 0,
      noteItemCount: 0,
      statCount: 0,
      unannouncedCount: 0,
    });
  });

  it("M은 상태 라벨이 아니라 q·CI 유의성으로 센다(코디네이터 정정, 2026-09-05)", () => {
    const notes = notesFile([note({ id: "a", entity: "A" }), note({ id: "b", entity: "B", section: "item" })]);
    const rows = deltasFile([
      // 노트 짝은 있지만 비유의(자기쌍 실측과 동일한 케이스) — M에서 제외돼야 한다.
      delta({ id: "1", status: "announced-inconsistent", q: 1, ci: [-0.01, 0.01], matchedNoteIds: ["a"] }),
      // 유의 + 짝 없음 = 미공지, M에는 포함.
      delta({ id: "2", status: "unannounced", q: 0.02, ci: [0.01, 0.03] }),
      // 유의 + 짝 있음(방향 불일치) = M에 포함.
      delta({ id: "3", status: "announced-inconsistent", q: 0.01, ci: [-0.05, -0.02], matchedNoteIds: ["b"] }),
      // 승률 게이트 미달 — q·CI가 유의해 보여도 M에서 제외.
      delta({ id: "4", status: "insufficient-sample", q: 0.01, ci: [0.2, 0.4] }),
      // 비유의 + 짝 없음 = no-change, M에서 제외.
      delta({ id: "5", status: "no-change", q: 0.8, ci: [-0.02, 0.02] }),
    ]);
    expect(computeHeadline(rows, notes)).toEqual({
      noteEntityCount: 2,
      noteItemCount: 2,
      statCount: 2,
      unannouncedCount: 1,
    });
  });

  it("자기쌍(26.17→26.17)과 동일한 형태(delta≈0, q=1)에서는 M=0이어야 한다", () => {
    const rows = deltasFile([
      delta({ id: "1", status: "announced-inconsistent", q: 1, ci: [-0.014, 0.014], delta: 0, matchedNoteIds: ["a"] }),
      delta({ id: "2", status: "insufficient-sample", q: 1, ci: [-0.4, 0.4], delta: 0 }),
      delta({ id: "3", status: "no-change", q: 1, ci: [-0.01, 0.01], delta: 0 }),
    ]);
    expect(computeHeadline(rows, null).statCount).toBe(0);
  });
});

describe("selectTopUnannounced", () => {
  it("unannounced만 필터링하고 파일 순서를 신뢰한다(재정렬 없음)", () => {
    const rows = deltasFile([
      delta({ id: "1", status: "unannounced", delta: 0.01 }),
      delta({ id: "2", status: "no-change" }),
      delta({ id: "3", status: "unannounced", delta: 0.05 }),
    ]);
    const result = selectTopUnannounced(rows, 5);
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("limit을 넘지 않는다", () => {
    const rows = deltasFile(
      Array.from({ length: 10 }, (_, i) => delta({ id: `u${i}`, status: "unannounced" }))
    );
    expect(selectTopUnannounced(rows, 5)).toHaveLength(5);
  });

  it("deltas가 null이면 빈 배열", () => {
    expect(selectTopUnannounced(null)).toEqual([]);
  });
});

describe("selectAnnouncedPreview", () => {
  it("matchedNoteIds가 있는 행만 뽑아(서로 다른 엔티티) |delta| 내림차순으로 정렬한다(상태 라벨 무관)", () => {
    const rows = deltasFile([
      delta({ id: "small", entityKey: "A", status: "announced-consistent", delta: 0.01, matchedNoteIds: ["n1"] }),
      delta({ id: "big", entityKey: "B", status: "announced-inconsistent", delta: -0.09, matchedNoteIds: ["n2"] }),
      delta({ id: "mid", entityKey: "C", status: "announced-consistent", delta: 0.05, matchedNoteIds: ["n3"] }),
      delta({ id: "excluded-unmatched", entityKey: "D", status: "unannounced", delta: 0.5, matchedNoteIds: [] }),
    ]);
    const result = selectAnnouncedPreview(rows, 5);
    expect(result.map((r) => r.id)).toEqual(["big", "mid", "small"]);
  });

  it("짝은 있지만 표본 부족(insufficient-sample)인 행도 포함한다(status 필터였다면 누락됐을 케이스)", () => {
    const rows = deltasFile([
      delta({ id: "low-sample-but-matched", status: "insufficient-sample", delta: 0.3, matchedNoteIds: ["n1"] }),
    ]);
    expect(selectAnnouncedPreview(rows).map((r) => r.id)).toEqual(["low-sample-but-matched"]);
  });

  it("delta===null인 레코드는(서로 다른 엔티티일 때) 맨 뒤로 밀린다", () => {
    const rows = deltasFile([
      delta({ id: "null-delta", entityKey: "A", status: "announced-consistent", delta: null, matchedNoteIds: ["n1"] }),
      delta({ id: "has-delta", entityKey: "B", status: "announced-consistent", delta: 0.01, matchedNoteIds: ["n2"] }),
    ]);
    expect(selectAnnouncedPreview(rows).map((r) => r.id)).toEqual(["has-delta", "null-delta"]);
  });

  it("같은 엔티티의 지표별 행 여러 개는 대표 1건으로 dedupe한다(실측 버그 회귀 고정 — 26.17 자기쌍 키아나 6행 반복)", () => {
    const rows = deltasFile([
      delta({ id: "champion:Q:pickRate", entityKey: "Q", metric: "pickRate", delta: 0, matchedNoteIds: ["n"] }),
      delta({ id: "champion:Q:banRate", entityKey: "Q", metric: "banRate", delta: 0, matchedNoteIds: ["n"] }),
      delta({ id: "champion:Q:winRate", entityKey: "Q", metric: "winRate", delta: 0, matchedNoteIds: ["n"] }),
      delta({ id: "champion:Q:TOP:pickRate", entityKey: "Q", metric: "pickRate", delta: 0, matchedNoteIds: ["n"] }),
      delta({ id: "champion:Q:JUNGLE:winRate", entityKey: "Q", metric: "winRate", delta: 0, matchedNoteIds: ["n"] }),
      // 서로 다른 엔티티 — dedupe 대상이 아니므로 함께 살아남아야 한다.
      delta({ id: "champion:R:pickRate", entityKey: "R", metric: "pickRate", delta: 0.03, matchedNoteIds: ["n2"] }),
    ]);
    const result = selectAnnouncedPreview(rows, 5);
    const qiyanaLikeRows = result.filter((r) => r.entityKey === "Q");
    expect(qiyanaLikeRows).toHaveLength(1);
    expect(result.map((r) => r.entityKey).sort()).toEqual(["Q", "R"]);
  });

  it("dedupe 대표는 챔피언 scope=all 행(3세그먼트 id)을 포지션 행보다 우선한다", () => {
    const rows = deltasFile([
      // 포지션 행이 |delta|가 더 커도 all-scope 행이 대표가 된다.
      delta({ id: "champion:Q:TOP:pickRate", entityKey: "Q", delta: 0.5, matchedNoteIds: ["n"] }),
      delta({ id: "champion:Q:winRate", entityKey: "Q", delta: 0.01, matchedNoteIds: ["n"] }),
    ]);
    const result = selectAnnouncedPreview(rows, 5);
    expect(result.map((r) => r.id)).toEqual(["champion:Q:winRate"]);
  });

  it("scope=all 행이 없으면 포지션 행 중 |delta| 최댓값을 대표로 고른다", () => {
    const rows = deltasFile([
      delta({ id: "champion:Q:TOP:pickRate", entityKey: "Q", delta: 0.02, matchedNoteIds: ["n"] }),
      delta({ id: "champion:Q:JUNGLE:winRate", entityKey: "Q", delta: -0.08, matchedNoteIds: ["n"] }),
    ]);
    const result = selectAnnouncedPreview(rows, 5);
    expect(result.map((r) => r.id)).toEqual(["champion:Q:JUNGLE:winRate"]);
  });
});

describe("formatNotePreviewText", () => {
  it("엔티티명이 문장 맨 앞에 오도록 조립한다(스킬 있음)", () => {
    const n = note({ entity: "나서스", skill: "기본 지속 효과", summary: "생명력 흡수 12/18/24% ⇒ 10/15/20%" });
    expect(formatNotePreviewText(n, 1, "폴백")).toBe(
      "나서스 · 기본 지속 효과 — 생명력 흡수 12/18/24% ⇒ 10/15/20%"
    );
  });

  it("skill이 null이면 가운뎃점 없이 조립한다", () => {
    const n = note({ entity: "클래식", skill: null, summary: "룬 페이지 2개 추가 지급" });
    expect(formatNotePreviewText(n, 1, "폴백")).toBe("클래식 — 룬 페이지 2개 추가 지급");
  });

  it("matchedNoteCount>1이면 '외 K건'을 덧붙인다", () => {
    const n = note({ entity: "아우렐리온 솔", skill: "Q", summary: "초당 마나 소모량 조정" });
    expect(formatNotePreviewText(n, 3, "폴백")).toBe("아우렐리온 솔 · Q — 초당 마나 소모량 조정 외 2건");
  });

  it("matchedNoteCount===1이면 '외 K건'을 붙이지 않는다", () => {
    const n = note({ entity: "트런들", skill: null, summary: "사거리 표시 개선" });
    expect(formatNotePreviewText(n, 1, "폴백")).toBe("트런들 — 사거리 표시 개선");
  });

  it("note가 없으면(방어적 케이스) 폴백 엔티티명만 반환한다", () => {
    expect(formatNotePreviewText(undefined, 1, "말파이트")).toBe("말파이트");
  });
});

describe("absDelta", () => {
  it("null은 -Infinity", () => {
    expect(absDelta(delta({ delta: null }))).toBe(-Infinity);
  });
  it("음수는 절대값", () => {
    expect(absDelta(delta({ delta: -0.07 }))).toBeCloseTo(0.07);
  });
});

describe("metricKind", () => {
  it.each([
    ["pickRate", "pp"],
    ["banRate", "pp"],
    ["winRate", "pp"],
    ["adoptionRate", "pp"],
    ["avgDurationSec", "sec"],
    ["firstSec", "sec"],
    ["goldAt14", "gold"],
    ["unknownMetric", "gold"],
  ] as const)("%s → %s", (metric, kind) => {
    expect(metricKind(metric)).toBe(kind);
  });
});

describe("formatMetricValue", () => {
  it("null이면 대시", () => {
    expect(formatMetricValue(null, "pickRate")).toBe("—");
  });
  it("pp는 퍼센트", () => {
    expect(formatMetricValue(0.046, "pickRate")).toBe("4.6%");
  });
  it("sec은 분:초", () => {
    expect(formatMetricValue(352, "firstSec")).toBe("5:52");
  });
  it("gold는 천단위 콤마", () => {
    expect(formatMetricValue(4820, "goldAt14")).toBe("4,820");
  });
});

describe("formatObservedSummary", () => {
  it("metric 라벨 + 부호 있는 값", () => {
    expect(formatObservedSummary(delta({ metric: "pickRate", delta: -0.018 }))).toBe("픽률 −1.8%p");
  });
  it("delta===null이면 관측 불가", () => {
    expect(formatObservedSummary(delta({ delta: null }))).toBe("픽률 관측 불가");
  });
});

describe("indexNotesById", () => {
  it("null이면 빈 객체", () => {
    expect(indexNotesById(null)).toEqual({});
  });
  it("id로 조회 가능한 맵을 만든다", () => {
    const notes = notesFile([note({ id: "x1", summary: "요약1" })]);
    const map = indexNotesById(notes);
    expect(map["x1"]?.summary).toBe("요약1");
  });
});


describe("entityFallbackLabel", () => {
  it("objective 4종은 한 글자 라벨", () => {
    expect(entityFallbackLabel({ entityType: "objective", entityKey: "dragon" })).toBe("용");
    expect(entityFallbackLabel({ entityType: "objective", entityKey: "herald" })).toBe("전");
    expect(entityFallbackLabel({ entityType: "objective", entityKey: "baron" })).toBe("바");
    expect(entityFallbackLabel({ entityType: "objective", entityKey: "tower" })).toBe("포");
  });
  it("lane은 골, summary는 경", () => {
    expect(entityFallbackLabel({ entityType: "lane", entityKey: "TOP" })).toBe("골");
    expect(entityFallbackLabel({ entityType: "summary", entityKey: "avgDurationSec" })).toBe("경");
  });
  it("champion/item은 undefined(EntityIcon 기본 동작에 위임)", () => {
    expect(entityFallbackLabel({ entityType: "champion", entityKey: "Trundle" })).toBeUndefined();
    expect(entityFallbackLabel({ entityType: "item", entityKey: "3047" })).toBeUndefined();
  });
});

describe("excludeObservation", () => {
  // 홈 릴리즈노트 스트림 미공지 카드: 헤더(ObservationLine)가 대표 관측 1건을 이미 보여주므로,
  // 카드 하단 전체 delta 리스트는 그 레코드를 다시 포함하면 안 된다(2026-09-11 중복 렌더 버그).
  it("observation과 id가 같은 레코드를 리스트에서 제외한다", () => {
    const ban = delta({ id: "champion:Camille:banRate", metric: "banRate", delta: -0.1 });
    const pick = delta({ id: "champion:Camille:pickRate", metric: "pickRate", delta: -0.089 });
    expect(excludeObservation([ban, pick], ban)).toEqual([pick]);
  });

  it("observation이 null이면 원본 배열을 그대로 돌려준다", () => {
    const ban = delta({ id: "champion:Camille:banRate" });
    expect(excludeObservation([ban], null)).toEqual([ban]);
  });

  it("observation과 일치하는 id가 리스트에 없으면 전부 유지한다", () => {
    const ban = delta({ id: "champion:Camille:banRate" });
    const other = delta({ id: "champion:Other:banRate" });
    expect(excludeObservation([ban], other)).toEqual([ban]);
  });
});

// ── resolveGapCause (2026-09-17, B5) ─────────────────────────────────────────────
// 이 함수의 존재 이유는 **네 상태를 한 문구로 뭉개지 않는 것**이다. 실측에서 미공지 47건 중
// 14건이 "호출 자체가 없었음"인데 22건의 "검토했으나 후보 없음"과 같은 말로 표시됐고,
// 사용자는 그것을 시스템 고장으로 읽었다. 그래서 테스트도 네 갈래를 각각 고정한다.
function llmCause(over: Partial<LlmCause> = {}): LlmCause {
  return { text: "폭풍갈퀴 변경의 파급", candidateNoteId: "note:x", verified: true, confidence: "medium", ...over };
}

describe("resolveGapCause", () => {
  it("검증된 후보가 있으면 원인 문장 그대로(verified)", () => {
    expect(resolveGapCause(delta({ causes: [llmCause()] }))).toEqual({
      mode: "verified",
      text: "폭풍갈퀴 변경의 파급",
    });
  });

  it("후보가 검증에 실패하면 문장은 살리되 미검증임을 밝힌다", () => {
    const result = resolveGapCause(delta({ causes: [llmCause({ verified: false })] }));
    expect(result.mode).toBe("candidate");
    expect(result.text).toContain("후보 미검증");
  });

  it("llm 필드 자체가 없으면 '미검토' — 후보가 없다고 말하지 않는다", () => {
    const result = resolveGapCause(delta({ causes: [] }));
    expect(result.mode).toBe("unreviewed");
    expect(result.text).toContain("원인 미검토");
  });

  it("예산 소진으로 건너뛴 것도 '미검토'이며 사유를 말한다", () => {
    const result = resolveGapCause(
      delta({ causes: [], llm: { skipped: true, reason: "call-budget-exceeded" } })
    );
    expect(result.mode).toBe("unreviewed");
    expect(result.text).toContain("호출 예산 소진");
  });

  it("검토했고 후보가 없으면 '설명 후보 없음' — 이것이 미검토와 구분되는 핵심", () => {
    const result = resolveGapCause(
      delta({ causes: [], llm: { skipped: false, summary: "설명할 조항을 찾지 못했습니다" } })
    );
    expect(result.mode).toBe("none");
    expect(result.text).toContain("설명 후보 없음");
  });

  it("미검토와 후보없음은 절대 같은 문구가 아니다(회귀 고정)", () => {
    const unreviewed = resolveGapCause(delta({ causes: [] }));
    const none = resolveGapCause(delta({ causes: [], llm: { skipped: false } }));
    expect(unreviewed.text).not.toBe(none.text);
    expect(unreviewed.mode).not.toBe(none.mode);
  });
});

// ── resolveGapCause — confidence 분리 (2026-09-18, 채점 라운드1 ST-2 / 사용자 확정 M1) ──────
// 모델을 Opus로 올리면 후보는 늘지만 대부분 `low`다. `verified:true`(id가 실재)와 "믿을 만함"은
// 다른 말이라, low는 본문색 "추정 원인"이 아니라 회색 "가능성"으로만 나간다(무근거 회색 원칙).
describe("resolveGapCause — 신뢰도 분리", () => {
  it("verified + medium 이상은 verified(본문색)", () => {
    expect(resolveGapCause(delta({ causes: [llmCause({ confidence: "medium" })] })).mode).toBe("verified");
    expect(resolveGapCause(delta({ causes: [llmCause({ confidence: "high" })] })).mode).toBe("verified");
  });

  it("verified + low는 weak — 회색 '가능성' 문장", () => {
    const result = resolveGapCause(delta({ causes: [llmCause({ confidence: "low" })] }));
    expect(result.mode).toBe("weak");
    expect(result.text).toBe("폭풍갈퀴 변경의 파급");
  });

  it("첫 후보가 low라도 뒤에 medium이 있으면 그것을 대표로 쓴다", () => {
    const result = resolveGapCause(
      delta({ causes: [llmCause({ confidence: "low", text: "약한 후보" }), llmCause({ confidence: "medium", text: "강한 후보" })] })
    );
    expect(result).toEqual({ mode: "verified", text: "강한 후보" });
  });

  it("미검증(verified:false)은 신뢰도와 무관하게 candidate", () => {
    expect(resolveGapCause(delta({ causes: [llmCause({ verified: false, confidence: "high" })] })).mode).toBe("candidate");
  });
});
