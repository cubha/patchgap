// src/components/home/__tests__/streamVerdict.test.ts
// 스트림 판정 문장(streamVerdict.ts) 단위 테스트 — 시안 .rn-obs / .verdict .m 신설분.

import { describe, expect, it } from "vitest";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import {
  buildNoteVerdict,
  formatQ,
  selectEntityObservation,
  selectReportableObservation,
} from "../streamVerdict";

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:X:banRate",
    entityType: "champion",
    entityKey: "X",
    entityName: "테스트챔프",
    metric: "banRate",
    before: 0.268,
    after: 0.424,
    delta: 0.157,
    ci: [0.14, 0.17],
    n: { before: 10000, after: 10000 },
    q: 0.0001,
    status: "announced-inconsistent",
    matchedNoteId: "n1",
    matchedNoteIds: ["n1"],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

function note(overrides: Partial<PatchNoteItem> = {}): PatchNoteItem {
  return {
    id: "n1",
    patch: "26.17",
    section: "champion",
    entity: "테스트챔프",
    skill: "Q",
    stat: "피해량",
    before: "70",
    after: "80",
    direction: "buff",
    summary: "요약",
    anchorUrl: "https://example.com/#x",
    anchorKind: "entity",
    ...overrides,
  };
}

describe("selectEntityObservation", () => {
  it("|delta|가 가장 큰 행을 대표로 고른다", () => {
    const rows = [
      delta({ id: "a", metric: "pickRate", delta: 0.02 }),
      delta({ id: "b", metric: "banRate", delta: -0.13 }),
      delta({ id: "c", metric: "winRate", delta: 0.05 }),
    ];
    expect(selectEntityObservation(rows)?.id).toBe("b");
  });

  it("delta===null(측정 불가) 행은 대표가 되지 않는다", () => {
    const rows = [delta({ id: "a", delta: null }), delta({ id: "b", delta: 0.01 })];
    expect(selectEntityObservation(rows)?.id).toBe("b");
  });

  it("전부 측정 불가면 null", () => {
    expect(selectEntityObservation([delta({ delta: null })])).toBeNull();
  });

  it("빈 배열이면 null", () => {
    expect(selectEntityObservation([])).toBeNull();
  });
});

describe("buildNoteVerdict", () => {
  it("짝지어진 델타가 없으면 문장을 만들지 않는다(무근거 문장 금지)", () => {
    expect(buildNoteVerdict(note(), undefined)).toBeNull();
  });

  it("상향 노트 + 유의한 상승 관측 → 노트=상향 · 밴률 상승", () => {
    const v = buildNoteVerdict(note({ direction: "buff" }), delta({ delta: 0.157, q: 0.0001 }));
    expect(v).toEqual({ noteLabel: "노트=상향", observedLabel: "밴률 상승", kind: "up" });
  });

  it("하향 노트 + 유의한 하락 관측 → 노트=하향 · 픽률 하락", () => {
    const v = buildNoteVerdict(
      note({ direction: "nerf" }),
      delta({ metric: "pickRate", delta: -0.069, q: 0.0001 })
    );
    expect(v).toEqual({ noteLabel: "노트=하향", observedLabel: "픽률 하락", kind: "down" });
  });

  it("q가 유의수준을 넘으면 방향어 없이 '유의차 없음'", () => {
    const v = buildNoteVerdict(note({ direction: "nerf" }), delta({ delta: -0.088, q: 0.22 }), 0.1);
    expect(v).toEqual({ noteLabel: "노트=하향", observedLabel: "유의차 없음", kind: "none" });
  });

  it("표본 부족(insufficient-sample)은 q와 무관하게 유의차 없음으로 판정한다", () => {
    const v = buildNoteVerdict(
      note({ direction: "adjust" }),
      delta({ status: "insufficient-sample", metric: "winRate", delta: 0.04, q: 0.001 })
    );
    expect(v).toEqual({ noteLabel: "노트=조정", observedLabel: "유의차 없음", kind: "none" });
  });

  it("direction=unknown은 방향을 지어내지 않고 '변경'으로 둔다", () => {
    const v = buildNoteVerdict(note({ direction: "unknown" }), delta({ delta: 0.157, q: 0.0001 }));
    expect(v?.noteLabel).toBe("노트=변경");
  });
});

describe("formatQ", () => {
  it("0.001 미만은 부등호 표기", () => {
    expect(formatQ(0.0001)).toBe("q<0.001");
  });

  it("0.001 이상은 값 표기(뒤따르는 0 제거)", () => {
    expect(formatQ(0.14)).toBe("q=0.14");
    expect(formatQ(0.1)).toBe("q=0.1");
  });

  it("null(계산 불가)이면 표기하지 않는다", () => {
    expect(formatQ(null)).toBeNull();
  });
});

// ── 2026-09-17(B3) 효과크기 바닥 게이트 ───────────────────────────────────────────
// 사용자가 "아직도 3% 미만의 미비한 변화내용 표기됨"을 지적했다. 결함은 "게이트가 없다"가
// 아니라 **"미공지 경로엔 있고 공지 경로엔 없다"는 비대칭**이었다. 실측(26.17→26.18): 노트
// 짝이 있는 135행 중 24행이 q<0.1을 통과하면서 바닥 아래다 — n≈10,000에서는 0.5%p 이동도
// 유의해지므로 "유의하다"가 "의미 있다"를 뜻하지 못한다.
describe("효과크기 바닥 게이트(B3)", () => {
  // 픽률 바닥은 절대 2%p. 아래 행은 q=0.0001(유의)이지만 delta=0.005(0.5%p)로 바닥 미달.
  const tiny = delta({ metric: "pickRate", before: 0.1, after: 0.105, delta: 0.005, ci: [0.003, 0.007] });
  const big = delta({ metric: "pickRate", before: 0.1, after: 0.14, delta: 0.04, ci: [0.03, 0.05] });

  it("selectReportableObservation은 바닥 미달 행을 대표로 뽑지 않는다", () => {
    expect(selectReportableObservation([tiny])).toBeNull();
    expect(selectReportableObservation([big])?.metric).toBe("pickRate");
  });

  it("바닥을 넘는 행이 섞여 있으면 그 행이 대표가 된다", () => {
    expect(selectReportableObservation([tiny, big])?.delta).toBe(0.04);
  });

  it("selectEntityObservation(미공지 경로)은 그대로 — 판정 단계에서 이미 게이트돼 있다", () => {
    expect(selectEntityObservation([tiny])?.delta).toBe(0.005);
  });

  it("buildNoteVerdict도 바닥 미달엔 방향어를 붙이지 않는다(한 단계 아래에서 되살아나던 결함)", () => {
    const verdict = buildNoteVerdict(note(), tiny);
    expect(verdict?.kind).toBe("none");
    expect(verdict?.observedLabel).toBe("변화 규모 바닥 미달");
  });

  it("'유의차 없음'과 '규모 미달'은 다른 말이다 — 차이는 실재하므로 없다고 말하지 않는다", () => {
    const notSignificant = buildNoteVerdict(note(), delta({ q: 1, ci: [-0.01, 0.2] }));
    const belowFloor = buildNoteVerdict(note(), tiny);
    expect(notSignificant?.observedLabel).toBe("유의차 없음");
    expect(belowFloor?.observedLabel).not.toBe(notSignificant?.observedLabel);
  });

  it("바닥을 넘고 유의하면 방향어가 그대로 붙는다(과잉 억제 방지)", () => {
    const verdict = buildNoteVerdict(note(), big);
    expect(verdict?.kind).toBe("up");
    expect(verdict?.observedLabel).toContain("상승");
  });
});
