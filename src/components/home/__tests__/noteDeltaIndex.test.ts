// src/components/home/__tests__/noteDeltaIndex.test.ts
// 노트 → 델타 역색인(2026-09-18, 채점 라운드3 G1). 이전엔 page.tsx가 `matchedNoteIds`를 돌며
// **마지막 행이 이기는**(last-wins) 사전을 만들었다. 한 노트에 픽률·밴률·승률·포지션별 행이 여러 개
// 매칭되므로, 유의·바닥 통과 행이 있어도 뒤에 온 비유의 행이 덮어써 카드가 "관측 변화 없음"을
// 말했다(실측: 관측 보유 엔티티 1/20 — best-row면 7/20).
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { indexNoteDeltaRows, indexNoteDeltas } from "../noteDeltaIndex";

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
    status: "announced-consistent",
    matchedNoteId: "n1",
    matchedNoteIds: ["n1"],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

describe("indexNoteDeltas", () => {
  it("같은 노트에 여러 행이 매칭되면 유의·바닥 통과 행이 순서와 무관하게 이긴다", () => {
    const good = delta({ id: "good", metric: "pickRate", delta: -0.025, ci: [-0.034, -0.016], q: 0.001 });
    const weak = delta({ id: "weak", metric: "winRate", delta: -0.006, ci: [-0.05, 0.04], q: 1, status: "announced-inconsistent" });
    expect(indexNoteDeltas([good, weak], 0.1).n1.id).toBe("good");
    expect(indexNoteDeltas([weak, good], 0.1).n1.id).toBe("good");
  });

  it("둘 다 통과하면 상태 우선순위(불일치 > 일치), 같으면 |Δ|가 큰 쪽", () => {
    const cons = delta({ id: "cons", delta: 0.05, ci: [0.04, 0.06], q: 0.001, status: "announced-consistent" });
    const incons = delta({ id: "incons", delta: -0.03, ci: [-0.04, -0.02], q: 0.001, status: "announced-inconsistent" });
    expect(indexNoteDeltas([cons, incons], 0.1).n1.id).toBe("incons");
    const small = delta({ id: "small", delta: 0.03, ci: [0.02, 0.04], q: 0.001 });
    expect(indexNoteDeltas([small, cons], 0.1).n1.id).toBe("cons");
  });

  it("통과 행이 없으면 아무 행이라도 남긴다(노트가 짝을 잃지 않는다)", () => {
    const weak = delta({ id: "weak", delta: 0.001, ci: [-0.01, 0.01], q: 0.9, status: "announced-inconsistent" });
    expect(indexNoteDeltas([weak], 0.1).n1.id).toBe("weak");
  });

  it("한 행이 여러 노트에 매칭되면 각 노트 키에 모두 들어간다", () => {
    const row = delta({ id: "multi", matchedNoteIds: ["n1", "n2"] });
    const idx = indexNoteDeltas([row], 0.1);
    expect(idx.n1.id).toBe("multi");
    expect(idx.n2.id).toBe("multi");
  });
});

// ── 2026-09-18(채점 라운드4 S4 후속) 사유 계산은 대표가 아니라 전수를 본다 ──────────────
// **실측 회귀**: 자헨은 대표가 winRate +5.20%p(q=0.51, **비유의**)인데 짝 행에는 유의한
// pickRate +1.58%p(q=0)가 세 개 더 있다. 대표 규칙이 `|Δ|` 우선이라 유의·작은 행이 밀린 것이다.
// 대표만 보고 "왜 관측이 없나"를 답하면 "유의차 없음"이라 단정하게 되는데, 그 엔티티엔 유의한
// 행이 실재하므로 거짓이다 — 이 라운드가 고치려던 결함이 한 단계 아래에서 되살아난 형태였다.
describe("indexNoteDeltaRows — 짝 전수(S4 후속)", () => {
  const bigInsignificant = delta({
    id: "champion:X:winRate",
    metric: "winRate",
    before: 0.5,
    after: 0.552,
    delta: 0.052,
    ci: [-0.02, 0.12],
    q: 0.51,
    matchedNoteIds: ["n1"],
  });
  const smallSignificant = delta({
    id: "champion:X:pickRate",
    metric: "pickRate",
    before: 0.1,
    after: 0.1158,
    delta: 0.0158,
    ci: [0.012, 0.02],
    q: 0,
    matchedNoteIds: ["n1"],
  });

  it("대표는 |Δ| 큰 비유의 행이 이긴다(G1 규칙 불변 — 이 테스트가 그 전제를 고정한다)", () => {
    expect(indexNoteDeltas([bigInsignificant, smallSignificant])["n1"].metric).toBe("winRate");
  });

  it("전수 색인은 두 행을 **모두** 돌려준다 — 사유 계산이 유의한 행을 놓치지 않는다", () => {
    const all = indexNoteDeltaRows([bigInsignificant, smallSignificant])["n1"];
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.metric).sort()).toEqual(["pickRate", "winRate"]);
  });

  it("한 노트에 짝이 없으면 키가 없다(빈 배열을 지어내지 않는다)", () => {
    expect(indexNoteDeltaRows([bigInsignificant])["n2"]).toBeUndefined();
  });
});
