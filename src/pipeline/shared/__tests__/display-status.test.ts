// src/pipeline/shared/__tests__/display-status.test.ts
// 표시 전용 상태 키(2026-09-18, 채점 라운드1 ST-4 / 사용자 확정 M2). `announced-inconsistent`는
// 판정 엔진이 "방향 반대"와 "비유의"를 한 값에 넣는다(verdict.ts). 실측 26.17→26.18: 64건 중
// 59건이 비유의인데 전부 빨간 "공지-불일치"로 나가 노트 대부분이 틀린 것처럼 읽혔다.
// 내부 상태값은 그대로 두고 **화면 키만** 갈라낸다.
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "../../types";
import { displayStatus } from "../display-status";

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
    status: "announced-inconsistent",
    matchedNoteId: "note:a",
    matchedNoteIds: ["note:a"],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

describe("displayStatus", () => {
  it("유의한 공지-불일치는 그대로 announced-inconsistent", () => {
    expect(displayStatus(delta({}), 0.1)).toBe("announced-inconsistent");
  });

  it("비유의(q≥α)면 announced-unobserved — '관측 미확인'", () => {
    expect(displayStatus(delta({ q: 0.4 }), 0.1)).toBe("announced-unobserved");
  });

  it("CI가 0을 포함해도 announced-unobserved", () => {
    expect(displayStatus(delta({ ci: [-0.01, 0.03] }), 0.1)).toBe("announced-unobserved");
  });

  it("다른 상태는 손대지 않는다", () => {
    expect(displayStatus(delta({ status: "unannounced" }), 0.1)).toBe("unannounced");
    expect(displayStatus(delta({ status: "announced-consistent", q: 0.5 }), 0.1)).toBe("announced-consistent");
    expect(displayStatus(delta({ status: "no-change", q: null }), 0.1)).toBe("no-change");
  });
});
