// src/pipeline/shared/__tests__/gap-total.test.ts
// 「미공지 Gap」 지표 축 목록과 타일의 항등식(ST-10, 2026-10-08 site-review parity-S7·tft-S18·tft-S9).
//
// 실측: TFT 18.2→18.3 브리핑 Gap 탭 지표 축 머리 「26건」(행 수) vs 대조표 미공지 칩 21(대상 수) vs 렌더 행 13, 그리고
// 렝가·아무무가 수치 축과 지표 축 **두 섹션에** 올라 있었다. 한 대상은 한 섹션에만 — 수치 축이 이긴다(증거 등급) — 그리고
// 지표 축 머리 수 = 대조표 미공지 칩 = 그 목록의 대상 수, 타일 = 수치 축 대상 + 지표 축 대상이어야 한다.
import { describe, expect, it } from "vitest";
import type { DeltaRecord, MatchStatus } from "../../types";
import type { PubgDeltaRow } from "../../match/pubg-delta";
import { pubgGapTotal, pubgMetricGapRows, tftGapTotal, tftMetricGapRows } from "../gap-total";

function row(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "unit:DA_18_Rengar:playRate",
    entityType: "unit",
    entityKey: "DA_18_Rengar",
    entityName: "렝가",
    metric: "playRate",
    before: 0.1,
    after: 0.15,
    delta: 0.05,
    ci: [0.03, 0.07],
    n: { before: 6000, after: 6000 },
    q: 0.01,
    status: "unannounced" as MatchStatus,
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...overrides,
  };
}

function pubgRow(overrides: Partial<PubgDeltaRow>): PubgDeltaRow {
  return {
    id: "weapon:berylm762:pickupShare",
    weaponKey: "berylm762",
    weaponName: "Beryl M762",
    metric: "pickupShare",
    before: 0.05,
    after: 0.06,
    relChange: 0.2,
    relCi: [0.1, 0.3],
    n: { before: 1000, after: 1000 },
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    evidence: { aggregatePath: "x", noteAnchor: null, matchIds: [] },
    ...overrides,
  };
}

describe("tftMetricGapRows — 지표 축 목록은 수치 축 대상을 뺀다", () => {
  const rengarPlay = row({});
  const rengarTop4 = row({ id: "unit:DA_18_Rengar:top4Rate", metric: "top4Rate" });
  const amumu = row({ id: "unit:DA_18_Amumu:playRate", entityKey: "DA_18_Amumu", entityName: "아무무" });
  const rows = [rengarPlay, rengarTop4, amumu];

  it("★ 수치 축(잠수함·불일치)에 있는 대상의 행은 지표 축 목록에서 빠진다 — 한 대상은 한 섹션에만", () => {
    const numeric = new Set(["unit:DA_18_Rengar"]);
    expect(tftMetricGapRows(rows, 0.1, numeric).map((r) => r.id)).toEqual(["unit:DA_18_Amumu:playRate"]);
  });

  it("수치 축이 비면 종전 `tftGapRows`와 같다", () => {
    expect(tftMetricGapRows(rows, 0.1, new Set()).map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });

  it("★ 항등식: 타일 = 수치 축 대상 수 + 지표 축 목록의 대상 수", () => {
    const numeric = new Set(["unit:DA_18_Rengar", "item:DA_Extract"]);
    const metricEntities = new Set(tftMetricGapRows(rows, 0.1, numeric).map((r) => `${r.entityType}:${r.entityKey}`));
    expect(tftGapTotal(rows, 0.1, numeric)).toBe(numeric.size + metricEntities.size);
  });

  it("보고 자격이 없는 행은 어느 쪽에도 없다", () => {
    const weak = row({ id: "unit:DA_18_Lux:playRate", entityKey: "DA_18_Lux", q: 0.9, ci: [-0.01, 0.01] });
    expect(tftMetricGapRows([weak], 0.1, new Set())).toEqual([]);
  });
});

describe("pubgMetricGapRows — 같은 규칙, 무기 키", () => {
  const beryl = pubgRow({});
  const groza = pubgRow({ id: "weapon:groza:pickupShare", weaponKey: "groza", weaponName: "Groza" });

  it("★ 수치 축에 있는 무기는 지표 축 목록에서 빠진다", () => {
    expect(pubgMetricGapRows([beryl, groza], new Set(["weapon:berylm762"])).map((r) => r.weaponKey)).toEqual(["groza"]);
  });

  it("항등식: 타일 = 수치 축 + 지표 축 대상 수", () => {
    const numeric = new Set(["weapon:berylm762"]);
    expect(pubgGapTotal([beryl, groza], numeric)).toBe(numeric.size + pubgMetricGapRows([beryl, groza], numeric).length);
  });
});
