// src/components/home/__tests__/laneExcludedItems.test.ts
// 2026-09-19 최종 확인 지적: 라인 캡션의 탭 스코프는 **현 데이터로 수정 전후가 구별되지 않는다**
// (두 탭 모두 아이템을 갖고 있어 우연히 같은 결과가 나온다). 통과가 코드 독해에만 기대고 회귀를
// 막을 자리가 없었다. 한쪽 탭에만 아이템이 있는 상황을 픽스처로 만들어 고정한다.
import { describe, expect, it } from "vitest";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { hasLaneExcludedItemsIn } from "../ReleaseNoteStream";
import type { ReleaseStreamEntry } from "../ReleaseNoteStream";

const icon: ReleaseStreamEntry["icon"] = { entityType: null, entityKey: null };

function note(section: PatchNoteItem["section"]): PatchNoteItem {
  return {
    id: `note:26.18:${section}:x:0`,
    patch: "26.18",
    section,
    entity: "X",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "s",
    anchorUrl: "https://x/#patch-x",
    anchorKind: "entity",
    modeScope: "core",
  };
}

function delta(entityType: DeltaRecord["entityType"]): DeltaRecord {
  return {
    id: `${entityType}:X:pickRate`,
    entityType,
    entityKey: "X",
    entityName: "X",
    metric: "pickRate",
    before: 0.1,
    after: 0.12,
    delta: 0.02,
    ci: [0.01, 0.03],
    n: { before: 500, after: 500 },
    q: 0.01,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
  };
}

/** 패치 내용 탭(matched)에만 아이템이 있고, 미공지 Gap 탭(unannounced)에는 챔피언만 있다. */
const entries: ReleaseStreamEntry[] = [
  { group: { kind: "matched", entity: "구인수의 격노검", notes: [note("item")] }, icon, lanes: [] },
  { group: { kind: "unannounced", entity: "오공", deltas: [delta("champion")] }, icon, lanes: ["JUNGLE"] },
];

describe("hasLaneExcludedItemsIn", () => {
  it("아이템이 있는 탭에서만 말한다 — 없는 탭에서 말하면 거짓이다", () => {
    expect(hasLaneExcludedItemsIn(entries, "MIDDLE", "content")).toBe(true);
    expect(hasLaneExcludedItemsIn(entries, "MIDDLE", "gap")).toBe(false);
  });

  it("라인이 '전체'면 빠진 것이 없으므로 말하지 않는다", () => {
    expect(hasLaneExcludedItemsIn(entries, "all", "content")).toBe(false);
  });

  it("그 라인에 속한 아이템이면 빠지지 않았으므로 말하지 않는다", () => {
    const laned: ReleaseStreamEntry[] = [
      { group: { kind: "matched", entity: "아이템", notes: [note("item")] }, icon, lanes: ["MIDDLE"] },
    ];
    expect(hasLaneExcludedItemsIn(laned, "MIDDLE", "content")).toBe(false);
  });

  it("아이템이 아예 없으면 말하지 않는다", () => {
    const champOnly: ReleaseStreamEntry[] = [
      { group: { kind: "matched", entity: "오공", notes: [note("champion")] }, icon, lanes: ["JUNGLE"] },
    ];
    expect(hasLaneExcludedItemsIn(champOnly, "MIDDLE", "content")).toBe(false);
  });
});
