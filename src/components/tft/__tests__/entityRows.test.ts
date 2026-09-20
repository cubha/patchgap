import { describe, it, expect } from "vitest";

import { TFT_METRICS, buildTftEntityRows, effectStrength } from "../entityRows";
import type { DeltaRecord, DeltaMetric, MatchStatus } from "@/pipeline/types";

function rec(
  entityKey: string,
  metric: DeltaMetric,
  delta: number,
  status: MatchStatus,
  before = 0.5,
  noteAnchor: string | null = null
): DeltaRecord {
  return {
    id: `unit:${entityKey}:${metric}`,
    entityType: "unit",
    entityKey,
    entityName: `이름-${entityKey}`,
    metric,
    before,
    after: before + delta,
    delta,
    // CI가 0을 제외해야 유의 — 부호에 맞춰 만든다.
    ci: delta > 0 ? [delta / 2, delta * 1.5] : [delta * 1.5, delta / 2],
    n: { before: 5000, after: 5000 },
    q: 0.001,
    status,
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "p", noteAnchor },
  };
}

describe("effectStrength — 단위를 없앤다", () => {
  it("절대 바닥 지표는 바닥 대비 배수다", () => {
    // top4Rate 바닥 0.02 → delta 0.06이면 3배
    expect(effectStrength(rec("A", "top4Rate", 0.06, "unannounced"))).toBeCloseTo(3, 6);
    // avgPlacement 바닥 0.15 → delta 0.3이면 2배
    expect(effectStrength(rec("A", "avgPlacement", 0.3, "unannounced", 4.5))).toBeCloseTo(2, 6);
  });

  it("**등수 0.3이 순방률 6%p보다 강하지 않다** — 절대값으로 재면 등수가 항상 이긴다", () => {
    const placement = effectStrength(rec("A", "avgPlacement", 0.3, "unannounced", 4.5));
    const top4 = effectStrength(rec("B", "top4Rate", 0.06, "unannounced"));
    expect(placement).toBeLessThan(top4);
  });

  it("상대 바닥 지표는 기저 대비로 환산한다", () => {
    // playRate 바닥 상대 0.25 → 기저 0.4에서 delta 0.2면 상대 0.5 = 2배
    expect(effectStrength(rec("A", "playRate", 0.2, "unannounced", 0.4))).toBeCloseTo(2, 6);
  });

  it("기저가 0이면 0 — 나눗셈을 터뜨리지 않는다", () => {
    expect(effectStrength(rec("A", "playRate", 0.2, "unannounced", 0))).toBe(0);
  });
});

describe("buildTftEntityRows", () => {
  it("한 엔티티의 지표들이 한 행으로 접힌다", () => {
    const rows = buildTftEntityRows([
      rec("A", "playRate", 0.2, "unannounced", 0.4),
      rec("A", "top4Rate", 0.06, "unannounced"),
    ]);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0].cells).sort()).toEqual(["playRate", "top4Rate"]);
  });

  it("행 배지는 그 엔티티에서 가장 앞선 판정이다", () => {
    const rows = buildTftEntityRows([
      rec("A", "playRate", 0.2, "announced-consistent", 0.4),
      rec("A", "top4Rate", 0.06, "unannounced"),
    ]);
    expect(rows[0].status).toBe("unannounced");
  });

  it("보고 자격 없는 관측은 셀에 들어가지 않는다 — 공용 술어가 정한다", () => {
    const rows = buildTftEntityRows([
      rec("A", "playRate", 0.2, "unannounced", 0.4),
      rec("A", "top4Rate", 0.0001, "no-change"),
    ]);
    expect(rows[0].cells.top4Rate).toBeUndefined();
  });

  it("근거 링크는 있는 것 중 하나를 올린다", () => {
    const rows = buildTftEntityRows([
      rec("A", "playRate", 0.2, "unannounced", 0.4),
      rec("A", "top4Rate", 0.06, "announced-consistent", 0.5, "https://x/#a"),
    ]);
    expect(rows[0].noteAnchor).toBe("https://x/#a");
  });

  it("정렬은 판정 우선순위 → 효과 강도", () => {
    const rows = buildTftEntityRows([
      rec("WEAK", "top4Rate", 0.03, "unannounced"),
      rec("STRONG", "top4Rate", 0.12, "unannounced"),
      rec("NOTED", "top4Rate", 0.9, "announced-consistent"),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["이름-STRONG", "이름-WEAK", "이름-NOTED"]);
  });

  it("열 순서는 채택 → 성과다", () => {
    expect(TFT_METRICS).toEqual(["playRate", "top4Rate", "avgPlacement"]);
  });
});
