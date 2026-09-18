// src/pipeline/shared/__tests__/display-status.test.ts
// 표시 전용 상태 키 — 2026-09-18 라운드6(사용자 C5·C1) 어휘 통일. 판정 엔진의 `MatchStatus`는
// 그대로 두고 **화면이 쓰는 키를 3종 + 부재 1종**으로 줄인다:
//   announced         공지(노트 짝이 있는 관측 전부 — 일치·비유의·바닥 미달을 더 이상 가르지 않는다)
//   announced-anomaly 공지 · 이상 관측(노트 방향과 **반대**로 유의·바닥 통과 — "공지는 상향인데 실측은 하락")
//   unannounced       미공지(`unannounced` + `indirect-effect` — "결국 미공지 내용")
//   unpaired          짝지은 관측 없음(홈 스킬 행 전용, 판정이 아니라 부재)
// 노이즈 3종(`below-threshold`·`insufficient-sample`·`no-change`)은 키를 그대로 통과시키되
// 화면은 `isNoiseStatus`로 **표시하지 않는다**(사용자 C1 "아예 보여주지 않도록").
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "../../types";
import { DISPLAY_SORT_PRIORITY, displayStatus, displayStatusOf, isNoiseStatus } from "../display-status";

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:X:pickRate",
    entityType: "champion",
    entityKey: "X",
    entityName: "테스트챔프",
    metric: "pickRate",
    before: 0.1,
    after: 0.15,
    delta: 0.05, // 픽률 바닥 2%p 통과
    ci: [0.03, 0.07],
    n: { before: 1000, after: 1000 },
    q: 0.02,
    status: "announced-inconsistent",
    matchedNoteId: "note:a",
    matchedNoteIds: ["note:a"],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

describe("displayStatus — 공지 계열", () => {
  it("방향 반대·유의·바닥 통과 → announced-anomaly(공지 · 이상 관측)", () => {
    expect(displayStatus(delta({}), 0.1)).toBe("announced-anomaly");
  });

  it("방향 반대지만 비유의(q≥α) → announced(공지)", () => {
    expect(displayStatus(delta({ q: 0.4 }), 0.1)).toBe("announced");
  });

  it("방향 반대지만 CI가 0 포함 → announced", () => {
    expect(displayStatus(delta({ ci: [-0.01, 0.07] }), 0.1)).toBe("announced");
  });

  it("방향 반대·유의지만 바닥 미달(픽률 1%p) → announced — 이상 관측이라 부를 규모가 아니다", () => {
    expect(displayStatus(delta({ delta: 0.01, after: 0.11, ci: [0.005, 0.015] }), 0.1)).toBe("announced");
  });

  it("방향 일치(announced-consistent)는 유의 여부와 무관하게 announced", () => {
    expect(displayStatus(delta({ status: "announced-consistent" }), 0.1)).toBe("announced");
    expect(displayStatus(delta({ status: "announced-consistent", q: 0.9 }), 0.1)).toBe("announced");
  });
});

describe("displayStatus — 미공지 계열·노이즈", () => {
  it("unannounced와 indirect-effect는 둘 다 unannounced(미공지)", () => {
    expect(displayStatus(delta({ status: "unannounced", matchedNoteIds: [] }), 0.1)).toBe("unannounced");
    expect(displayStatus(delta({ status: "indirect-effect", matchedNoteIds: [] }), 0.1)).toBe("unannounced");
  });

  it("노이즈 3종은 키를 그대로 통과시킨다(화면은 isNoiseStatus로 거른다)", () => {
    expect(displayStatus(delta({ status: "no-change", q: null }), 0.1)).toBe("no-change");
    expect(displayStatus(delta({ status: "below-threshold" }), 0.1)).toBe("below-threshold");
    expect(displayStatus(delta({ status: "insufficient-sample" }), 0.1)).toBe("insufficient-sample");
  });
});

describe("displayStatusOf — q 없이 상태값만으로(PUBG·방법론)", () => {
  it("consistent→announced · inconsistent→announced-anomaly · indirect→unannounced · 나머지 통과", () => {
    expect(displayStatusOf("announced-consistent")).toBe("announced");
    expect(displayStatusOf("announced-inconsistent")).toBe("announced-anomaly");
    expect(displayStatusOf("unannounced")).toBe("unannounced");
    expect(displayStatusOf("indirect-effect")).toBe("unannounced");
    expect(displayStatusOf("below-threshold")).toBe("below-threshold");
    expect(displayStatusOf("insufficient-sample")).toBe("insufficient-sample");
    expect(displayStatusOf("no-change")).toBe("no-change");
  });
});

describe("isNoiseStatus", () => {
  it("표본 부족·바닥 미달·변화 없음만 true", () => {
    expect(isNoiseStatus("below-threshold")).toBe(true);
    expect(isNoiseStatus("insufficient-sample")).toBe(true);
    expect(isNoiseStatus("no-change")).toBe(true);
    expect(isNoiseStatus("unannounced")).toBe(false);
    expect(isNoiseStatus("indirect-effect")).toBe(false);
    expect(isNoiseStatus("announced-consistent")).toBe(false);
    expect(isNoiseStatus("announced-inconsistent")).toBe(false);
  });
});

describe("DISPLAY_SORT_PRIORITY", () => {
  it("미공지 → 이상 관측 → 공지 → 노이즈 → 짝 없음 순", () => {
    const p = DISPLAY_SORT_PRIORITY;
    expect(p.unannounced).toBeLessThan(p["announced-anomaly"]);
    expect(p["announced-anomaly"]).toBeLessThan(p.announced);
    expect(p.announced).toBeLessThan(p["below-threshold"]);
    expect(p["below-threshold"]).toBeLessThan(p["insufficient-sample"]);
    expect(p["insufficient-sample"]).toBeLessThan(p["no-change"]);
    expect(p["no-change"]).toBeLessThan(p.unpaired);
  });
});
