// src/components/home/__tests__/noteSkillGroups.test.ts
// 스킬 묶음의 핵심 위험은 **과잉 병합**이다 — 26.18 `의회 - 투표 1 결과`는 skill이 null인
// 줄이 34개라, null을 하나의 그룹으로 취급하면 서로 다른 34줄이 한 행으로 사라진다.
import { describe, expect, it } from "vitest";
import { groupNotesBySkill, representativeRecord } from "../noteSkillGroups";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";

function note(over: Partial<PatchNoteItem> = {}): PatchNoteItem {
  return {
    id: "n1",
    patch: "26.18",
    section: "champion",
    entity: "카시오페아",
    skill: "E - 쌍독니",
    stat: "마나 소모량",
    before: "40",
    after: "45",
    direction: "nerf",
    summary: "마나 소모량: 40 ⇒ 45",
    anchorUrl: "https://example.test/notes",
    anchorKind: "section",
    ...over,
  };
}

function record(over: Partial<DeltaRecord> = {}): DeltaRecord {
  return {
    id: "champion:Cassiopeia:winRate",
    entityType: "champion",
    entityKey: "Cassiopeia",
    entityName: "카시오페아",
    metric: "winRate",
    before: 0.551,
    after: 0.544,
    delta: -0.006,
    ci: [-0.1, 0.09],
    q: 1,
    n: { before: 100, after: 100 },
    status: "no-change",
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "", noteAnchor: null },
    ...over,
  } as DeltaRecord;
}

describe("groupNotesBySkill", () => {
  it("같은 스킬 5줄을 한 행으로 묶는다(카시오페아 E - 쌍독니 실측 형태)", () => {
    const notes = ["마나 소모량", "기본 주문력 계수", "강화 주문력 계수", "재사용 대기시간", "피해량"].map(
      (stat, i) => note({ id: `n${i}`, stat, summary: `${stat}: A ⇒ B` })
    );
    const groups = groupNotesBySkill(notes);
    expect(groups).toHaveLength(1);
    expect(groups[0].skill).toBe("E - 쌍독니");
    expect(groups[0].notes).toHaveLength(5);
  });

  it("스킬이 다르면 행을 나눈다", () => {
    const groups = groupNotesBySkill([
      note({ id: "a", skill: "Q - 맹독 폭발" }),
      note({ id: "b", skill: "E - 쌍독니" }),
      note({ id: "c", skill: "Q - 맹독 폭발" }),
    ]);
    expect(groups.map((g) => g.skill)).toEqual(["Q - 맹독 폭발", "E - 쌍독니"]);
    expect(groups[0].notes).toHaveLength(2);
  });

  it("skill이 null인 줄은 절대 병합하지 않는다 — 34줄은 34행이다", () => {
    const notes = Array.from({ length: 34 }, (_, i) =>
      note({ id: `vote-${i}`, entity: "의회 - 투표 1 결과", skill: null, stat: null, summary: `안건 ${i}` })
    );
    const groups = groupNotesBySkill(notes);
    expect(groups).toHaveLength(34);
    expect(groups.every((g) => g.skill === null)).toBe(true);
    expect(new Set(groups.map((g) => g.key)).size).toBe(34);
  });

  it("스킬 있는 줄과 null 줄이 섞여도 각자 규칙을 따른다", () => {
    const groups = groupNotesBySkill([
      note({ id: "a", skill: "Q" }),
      note({ id: "b", skill: null }),
      note({ id: "c", skill: "Q" }),
      note({ id: "d", skill: null }),
    ]);
    expect(groups.map((g) => g.notes.length)).toEqual([2, 1, 1]);
  });

  it("문서 순서를 유지한다", () => {
    const groups = groupNotesBySkill([
      note({ id: "a", skill: "R" }),
      note({ id: "b", skill: "기본 지속 효과" }),
      note({ id: "c", skill: "R" }),
    ]);
    expect(groups.map((g) => g.skill)).toEqual(["R", "기본 지속 효과"]);
  });

  it("빈 입력", () => {
    expect(groupNotesBySkill([])).toEqual([]);
  });
});

describe("representativeRecord", () => {
  it("짝지어진 델타가 없으면 null", () => {
    expect(representativeRecord([note({ id: "a" })], {})).toBeNull();
  });

  it("상태 우선순위가 가장 높은 델타를 고른다 — 발견이 덜 중요한 상태에 가려지지 않게", () => {
    const best = representativeRecord(
      [note({ id: "a" }), note({ id: "b" })],
      {
        a: record({ id: "r-none", status: "no-change" }),
        b: record({ id: "r-un", status: "unannounced" }),
      }
    );
    expect(best?.id).toBe("r-un");
  });

  it("델타가 하나뿐이면 그것", () => {
    const only = record({ id: "solo", status: "announced-consistent" });
    expect(representativeRecord([note({ id: "a" }), note({ id: "b" })], { b: only })?.id).toBe("solo");
  });
});
