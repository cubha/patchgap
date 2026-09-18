// src/components/home/__tests__/sectionBundle.test.ts
// 섹션 묶음 판별(ST1, 2026-09-18 채점 라운드5 B2) — TDD RED 먼저.
// 실측 26.18: 「의회 - 투표 1 결과」(34줄, section=champion) · 「증강」(28, other) · 「버그 수정」(7,
// system) · 「버그 수정 및 편의성 개선」(4, system)이 엔티티 카드로 렌더됐다. 판별 키는
// **아이콘 해석 실패 ∧ 비치장 ∧ 짝 델타 0행** — anchorKind·section·sections[] 어느 하나로도
// 결정론 분리가 안 된다는 것이 패널 실측(BRAINTRUST-residual3 §2).
import { describe, expect, it } from "vitest";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import type { MatchedStreamGroup } from "../releaseStream";
import type { StreamEntityIcon } from "../releaseStreamEntity";
import { isSectionBundle } from "../sectionBundle";

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
    anchorUrl: "https://example.com/#x",
    anchorKind: "section",
    ...overrides,
  };
}

function group(entity: string, notes: PatchNoteItem[]): MatchedStreamGroup {
  return { kind: "matched", entity, notes };
}

function delta(id: string, noteIds: string[]): DeltaRecord {
  return {
    id,
    entityType: "champion",
    entityKey: "X",
    entityName: "X",
    metric: "pickRate",
    before: 0.1,
    after: 0.12,
    delta: 0.02,
    ci: [0.01, 0.03],
    n: { before: 1000, after: 1000 },
    q: 0.02,
    status: "announced-consistent",
    matchedNoteId: noteIds[0] ?? null,
    matchedNoteIds: noteIds,
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
  };
}

const NO_ICON: StreamEntityIcon = { entityType: null, entityKey: null };
const CHAMPION_ICON: StreamEntityIcon = { entityType: "champion", entityKey: "Fiora" };

describe("isSectionBundle", () => {
  it("아이콘 해석 실패 + 비치장 + 짝 0행 → 섹션 묶음(의회 - 투표 1 결과, section=champion이어도)", () => {
    const g = group("의회 - 투표 1 결과", [
      note({ id: "c1", entity: "의회 - 투표 1 결과", summary: "제안된 아이템 3개 모두 부활" }),
      note({ id: "c2", entity: "의회 - 투표 1 결과", summary: "찬성 62%" }),
    ]);
    expect(isSectionBundle(g, NO_ICON, {})).toBe(true);
  });

  it("system/other 섹션 폴백(증강·버그 수정)도 같은 키로 잡힌다", () => {
    const aug = group("증강", [note({ id: "a1", entity: "증강", section: "other", skill: "광대 대학" })]);
    const bug = group("버그 수정", [note({ id: "b1", entity: "버그 수정", section: "system" })]);
    expect(isSectionBundle(aug, NO_ICON, {})).toBe(true);
    expect(isSectionBundle(bug, NO_ICON, {})).toBe(true);
  });

  it("아이콘이 해석되면(피오라 65줄, anchorKind=section이어도) 엔티티다", () => {
    const g = group("피오라", [note({ id: "f1", entity: "피오라", anchorKind: "section" })]);
    expect(isSectionBundle(g, CHAMPION_ICON, {})).toBe(false);
  });

  it("치장 그룹(홀 오브 레전드)은 아이콘이 없어도 섹션 묶음이 아니다 — 치장 분기가 우선", () => {
    const g = group("홀 오브 레전드", [
      note({ id: "h1", entity: "홀 오브 레전드", summary: "떠오른 전설 오리아나 스킨", anchorUrl: "https://example.com/#hall-of-legends" }),
    ]);
    expect(isSectionBundle(g, NO_ICON, {})).toBe(false);
  });

  it("짝지은 델타가 한 줄이라도 있으면 섹션 묶음이 아니다(짝이 있다는 것은 엔티티가 매칭됐다는 뜻)", () => {
    const g = group("신규 아이템 묶음", [note({ id: "n1", entity: "신규 아이템 묶음", section: "item" }), note({ id: "n2", entity: "신규 아이템 묶음", section: "item" })]);
    const rows = { n2: [delta("item:1:pickRate", ["n2"])] };
    expect(isSectionBundle(g, NO_ICON, rows)).toBe(false);
  });

  it("빈 노트 그룹은 섹션 묶음이 아니다(아무것도 없는 것을 '섹션'이라 부르지 않는다)", () => {
    expect(isSectionBundle(group("빈", []), NO_ICON, {})).toBe(false);
  });
});
