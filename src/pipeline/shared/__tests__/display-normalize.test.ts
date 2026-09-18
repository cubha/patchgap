// src/pipeline/shared/__tests__/display-normalize.test.ts
// 표시용 델타 정규화(2026-09-18 라운드6 재판정 보완 1·2) — RED 먼저. 클래식 모드 섹션 줄에만 짝지어진
// 관측은 미공지가 되고, 그 줄을 인용한 원인 후보는 회색(verified:false)이 된다. 엔진 산출물은 불변.
import { describe, expect, it } from "vitest";
import type { DeltaRecord, PatchNoteItem } from "../../types";
import { normalizeDeltasForDisplay, normalizeRecordForDisplay } from "../display-normalize";
import { isDisplayExcludedNote, isModeSectionNote } from "../excluded-notes";

const BASE = "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-18-notes/";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:26.18:champion:x:0000",
    patch: "26.18",
    section: "champion",
    entity: "테스트",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "요약",
    anchorUrl: `${BASE}#patch-x`,
    anchorKind: "entity",
    ...overrides,
  };
}

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Fiora:pickRate",
    entityType: "champion",
    entityKey: "Fiora",
    entityName: "피오라",
    metric: "pickRate",
    before: 0.1,
    after: 0.077,
    delta: -0.023,
    ci: [-0.03, -0.016],
    n: { before: 1000, after: 1000 },
    q: 0,
    status: "announced-consistent",
    matchedNoteId: "fiora-classic-1",
    matchedNoteIds: ["fiora-classic-1", "fiora-classic-2"],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

const classic1 = note({ id: "fiora-classic-1", entity: "피오라", anchorUrl: `${BASE}#patch-classic`, anchorKind: "section" });
const classic2 = note({ id: "fiora-classic-2", entity: "피오라", anchorUrl: `${BASE}#patch-classic`, anchorKind: "section" });
const aram = note({ id: "aug-1", entity: "증강", section: "other", anchorUrl: `${BASE}#patch-aram:-mayhem`, anchorKind: "section" });
const ekko = note({ id: "ekko-q", entity: "에코", anchorUrl: `${BASE}#patch-ekko` });
const notes = [classic1, classic2, aram, ekko];
const byId = new Map(notes.map((n) => [n.id, n] as const));

describe("isModeSectionNote / isDisplayExcludedNote", () => {
  it("클래식·아수라장 앵커는 모드 섹션이고, 챔피언 고유 앵커는 아니다", () => {
    expect(isModeSectionNote(classic1)).toBe(true);
    expect(isModeSectionNote(aram)).toBe(true);
    expect(isModeSectionNote(ekko)).toBe(false);
    expect(isDisplayExcludedNote(note({ entity: "의회 - 투표 1 결과" }))).toBe(true);
    expect(isDisplayExcludedNote(ekko)).toBe(false);
  });
});

describe("normalizeRecordForDisplay", () => {
  it("짝지은 노트가 전부 모드 섹션이면 표시용 상태는 미공지·짝 없음", () => {
    const out = normalizeRecordForDisplay(delta({}), byId);
    expect(out.status).toBe("unannounced");
    expect(out.matchedNoteIds).toEqual([]);
    expect(out.matchedNoteId).toBeNull();
  });

  it("짝이 사라져도 비유의면 변화 없음, 유의하나 바닥 미달이면 바닥 미달, 표본 부족은 그대로(엔진 무짝 규칙)", () => {
    expect(normalizeRecordForDisplay(delta({ q: 0.38, ci: [-0.3, 0.05] }), byId, 0.1).status).toBe("no-change");
    expect(normalizeRecordForDisplay(delta({ delta: -0.005, after: 0.095, ci: [-0.008, -0.002] }), byId, 0.1).status).toBe("below-threshold");
    expect(normalizeRecordForDisplay(delta({ status: "insufficient-sample" }), byId, 0.1).status).toBe("insufficient-sample");
    expect(normalizeRecordForDisplay(delta({ status: "insufficient-sample" }), byId, 0.1).matchedNoteIds).toEqual([]);
  });

  it("SR 노트가 하나라도 있으면 상태를 유지한다(같은 객체 반환)", () => {
    const rec = delta({ matchedNoteIds: ["fiora-classic-1", "ekko-q"], matchedNoteId: "fiora-classic-1" });
    expect(normalizeRecordForDisplay(rec, byId)).toBe(rec);
  });

  it("모드 섹션 줄을 인용한 검증 원인은 회색(verified:false)이 되고, 검증 후보가 안 남은 간접 영향은 미공지가 된다", () => {
    const rec = delta({
      id: "champion:Aatrox:TOP:winRate",
      entityKey: "Aatrox",
      status: "indirect-effect",
      matchedNoteId: null,
      matchedNoteIds: [],
      causes: [
        { text: "끝없는 갈증 패시브 하향의 파급", candidateNoteId: "fiora-classic-1", verified: true, confidence: "high" },
        { text: "근거 없는 추정", candidateNoteId: null, verified: false, confidence: "low" },
      ],
    });
    const out = normalizeRecordForDisplay(rec, byId);
    expect(out.status).toBe("unannounced");
    expect(out.causes[0].verified).toBe(false);
    expect(out.causes[0].text).toBe(rec.causes[0].text);
    expect(rec.causes[0].verified).toBe(true); // 입력 불변
  });

  it("LLM 요약이 모드 섹션 줄을 인용하면 summaryVerified가 false가 된다(상세 요약 회색)", () => {
    const rec = delta({
      status: "unannounced", matchedNoteId: null, matchedNoteIds: [],
      llm: { skipped: false, summary: "끝없는 갈증 너프가 가장 유력한 원인입니다", summaryCites: ["fiora-classic-1"], summaryVerified: true },
    });
    expect(normalizeRecordForDisplay(rec, byId).llm?.summaryVerified).toBe(false);
    const ok = delta({ status: "unannounced", matchedNoteId: null, matchedNoteIds: [], llm: { skipped: false, summary: "s", summaryCites: ["ekko-q"], summaryVerified: true } });
    expect(normalizeRecordForDisplay(ok, byId)).toBe(ok);
  });

  it("SR 노트를 인용한 검증 원인이 남으면 간접 영향을 유지한다", () => {
    const rec = delta({
      status: "indirect-effect",
      matchedNoteId: null,
      matchedNoteIds: [],
      causes: [
        { text: "증강 상향", candidateNoteId: "aug-1", verified: true, confidence: "medium" },
        { text: "에코 Q 상향의 파급", candidateNoteId: "ekko-q", verified: true, confidence: "low" },
      ],
    });
    const out = normalizeRecordForDisplay(rec, byId);
    expect(out.status).toBe("indirect-effect");
    expect(out.causes.map((c) => c.verified)).toEqual([false, true]);
  });
});

describe("normalizeDeltasForDisplay", () => {
  it("노트가 없으면 손대지 않고, 있으면 counts를 정규화된 행 기준으로 다시 센다", () => {
    const file = { meta: { from: "26.17", to: "26.18", generatedAt: "t", n: 2, counts: { "announced-consistent": 2 }, qAlpha: 0.1 }, rows: [delta({}), delta({ id: "champion:Ekko:pickRate", entityKey: "Ekko", matchedNoteIds: ["ekko-q"], matchedNoteId: "ekko-q" })] };
    expect(normalizeDeltasForDisplay(file, null)).toBe(file);
    const out = normalizeDeltasForDisplay(file, notes)!;
    expect(out.meta.counts).toEqual({ unannounced: 1, "announced-consistent": 1 });
    expect(out.rows[1]).toBe(file.rows[1]);
  });
});
