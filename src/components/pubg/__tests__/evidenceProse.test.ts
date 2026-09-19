// src/components/pubg/__tests__/evidenceProse.test.ts
// 근거 문장 조립 검증(2026-09-19). 이 화면의 계약은 "사람이 읽고 납득할 수 있는가"라,
// 문장에 **수치와 판정 사유가 실제로 들어 있는지**를 고정한다.
import { describe, expect, it } from "vitest";
import type { PubgDeltaRow } from "@/pipeline/match/pubg-delta";
import { buildPubgEvidenceProse } from "../evidenceProse";

function row(overrides: Partial<PubgDeltaRow>): PubgDeltaRow {
  return {
    id: "pubg:weapon:BerylM762:pickupShare",
    weaponKey: "Item_Weapon_BerylM762_C",
    weaponName: "Beryl M762",
    metric: "pickupShare",
    before: 0.0404,
    after: 0.0468,
    relChange: 0.157,
    relCi: [0.14, 0.175],
    n: { before: 32835, after: 31207 },
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    evidence: { aggregatePath: "x", noteAnchor: null, matchIds: [] },
    ...overrides,
  };
}

const base = {
  subjectName: "Beryl M762",
  subjectKind: "무기",
  metricLabel: "획득 점유율",
  from: "43.0",
  to: "43.1",
  before: 0.0404,
  after: 0.0468,
  noteSummary: null,
};

describe("buildPubgEvidenceProse", () => {
  it("변화·신뢰구간·표본·패치노트 대조를 각각 한 문장으로 말한다", () => {
    const out = buildPubgEvidenceProse({ ...base, row: row({}) });
    expect(out).toHaveLength(4);
    expect(out[0]).toContain("4.04%에서 4.68%로 올랐습니다");
    expect(out[0]).toContain("+15.7%");
    expect(out[1]).toContain("0을 포함하지 않아");
    expect(out[2]).toContain("32,835건(43.0)");
    expect(out[3]).toContain("이 무기를 다룬 항목이 없어");
    // 식별자·파일 경로는 문장에 섞지 않는다(그건 접힌 원천 영역 몫이다).
    expect(out.join(" ")).not.toContain("data/aggregated");
  });

  it("표본 부족이면 '변화가 있는지 없는지를 말하지 않는다'고 밝힌다", () => {
    const out = buildPubgEvidenceProse({
      ...base,
      row: row({ status: "insufficient-sample", n: { before: 120, after: 90 } }),
    });
    expect(out[1]).toContain("기준에 못 미쳐");
  });

  it("비유의면 표본 흔들림과 구분되지 않는다고 말한다", () => {
    const out = buildPubgEvidenceProse({ ...base, row: row({ status: "no-change", relCi: [-0.02, 0.03] }) });
    expect(out[1]).toContain("표본이 흔들린 결과와 구분되지 않습니다");
  });

  it("짝지어진 노트가 있으면 그 문구를 인용한다", () => {
    const out = buildPubgEvidenceProse({ ...base, row: row({}), noteSummary: "베릴 M762 스폰율 30% 감소" });
    expect(out[3]).toContain('"베릴 M762 스폰율 30% 감소" 항목과 대조했습니다');
  });

  it("판정 행 자체가 없으면 판정하지 않았다고 말한다", () => {
    const out = buildPubgEvidenceProse({ ...base, row: null });
    expect(out[1]).toContain("판정 대상 목록에 없어");
  });
});
