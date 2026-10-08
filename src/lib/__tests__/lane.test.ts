// src/lib/__tests__/lane.test.ts
// parseLaneAxis(lane.ts) 단위 테스트 — 델타 id에서 라인 축(TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY/all)을
// 파싱하는 순수 함수. team-dev ST-C 프롬프트 최소 케이스: 5개 라인 각각 파싱 / all-scope(라인
// 없음) 파싱 / 잘못된 형식 id에 대한 null 처리.

import { describe, expect, it } from "vitest";
import { lanesForEntityKey, parseLaneAxis } from "../lane";
import type { DeltaRecord } from "@/pipeline/types";

function stubRecord(id: string, entityKey: string): Pick<DeltaRecord, "id" | "entityKey"> {
  return { id, entityKey };
}

function fullRecord(id: string, overrides: Partial<DeltaRecord> = {}): DeltaRecord {
  return {
    id,
    entityType: "champion",
    entityKey: id.split(":")[1],
    entityName: "테스트",
    metric: "pickRate",
    before: 0.1,
    after: 0.15,
    delta: 0.05,
    ci: [0.03, 0.07],
    n: { before: 6000, after: 6000 },
    q: 0.01,
    status: "announced-consistent",
    matchedNoteId: "n1",
    matchedNoteIds: ["n1"],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...overrides,
  };
}

// ST-19(2026-10-08 site-review lol-S6): 라인 칩(탑·원딜)을 눌러도 목록이 거의 안 줄었다 — 그 라인에 **행이 있기만 하면**
// 소속으로 쳤는데 26.19 데이터엔 TOP 302행·BOTTOM 224행이 있어 대부분의 챔피언이 모든 라인에 속했다. 소속은 그 라인에서
// **보고 자격**을 얻은 행이 있을 때만이다 — 방법론 「라인을 고르면 그 라인의 픽률·승률만 봅니다」와 맞아야 한다.
describe("lanesForEntityKey — 보고 자격이 있는 라인만(ST-19)", () => {
  it("★ 행이 있어도 보고 자격이 없으면(비유의·바닥 미달) 그 라인에 속하지 않는다", () => {
    const rows = [
      fullRecord("champion:Khazix:JUNGLE:pickRate"),
      fullRecord("champion:Khazix:TOP:pickRate", { q: 0.9, ci: [-0.01, 0.01], delta: 0.001, after: 0.101 }),
    ];
    expect(lanesForEntityKey(rows, "Khazix", 0.1)).toEqual(["JUNGLE"]);
  });

  it("qAlpha를 안 주면 기본 alpha로 같은 술어를 쓴다", () => {
    const rows = [fullRecord("champion:Khazix:JUNGLE:pickRate")];
    expect(lanesForEntityKey(rows, "Khazix")).toEqual(["JUNGLE"]);
  });

  it("scope=all 행은 라인이 아니다 — 자격이 있어도 결과에 없다", () => {
    expect(lanesForEntityKey([fullRecord("champion:Khazix:pickRate")], "Khazix", 0.1)).toEqual([]);
  });
});

describe("parseLaneAxis", () => {
  it("파싱: 5개 명명 포지션(scope=position, 4세그먼트) 각각", () => {
    expect(parseLaneAxis("champion:Ahri:TOP:pickRate")).toBe("TOP");
    expect(parseLaneAxis("champion:Ahri:JUNGLE:pickRate")).toBe("JUNGLE");
    expect(parseLaneAxis("champion:Ahri:MIDDLE:pickRate")).toBe("MIDDLE");
    expect(parseLaneAxis("champion:Ahri:BOTTOM:winRate")).toBe("BOTTOM");
    expect(parseLaneAxis("champion:Ahri:UTILITY:winRate")).toBe("UTILITY");
  });

  it("파싱: scope=all(3세그먼트)은 'all'", () => {
    expect(parseLaneAxis("champion:Ahri:pickRate")).toBe("all");
    expect(parseLaneAxis("champion:Ahri:banRate")).toBe("all");
    expect(parseLaneAxis("champion:Ahri:winRate")).toBe("all");
  });

  it("null: champion이 아닌 entityType", () => {
    expect(parseLaneAxis("item:1001:adoptionRate")).toBeNull();
    expect(parseLaneAxis("lane:TOP:goldAt10")).toBeNull();
    expect(parseLaneAxis("objective:dragon")).toBeNull();
    expect(parseLaneAxis("summary:avgDurationSec")).toBeNull();
  });

  it("null: 잘못된 형식 id(세그먼트 수 불일치·유효하지 않은 포지션 값)", () => {
    expect(parseLaneAxis("champion:Ahri")).toBeNull();
    expect(parseLaneAxis("champion:Ahri:FOO:pickRate")).toBeNull();
    expect(parseLaneAxis("champion:Ahri:TOP:pickRate:extra")).toBeNull();
    expect(parseLaneAxis("")).toBeNull();
  });
});

describe("lanesForEntityKey", () => {
  it("position-scope 행에서 라인 집합을 도출한다(LANE_ORDER 순서 보존)", () => {
    const records = [
      stubRecord("champion:Ahri:MIDDLE:pickRate", "Ahri"),
      stubRecord("champion:Ahri:TOP:pickRate", "Ahri"),
      stubRecord("champion:Ahri:MIDDLE:winRate", "Ahri"), // 같은 라인 중복 metric — 1개로 합쳐짐
    ];
    expect(lanesForEntityKey(records, "Ahri")).toEqual(["TOP", "MIDDLE"]);
  });

  it("scope=all 행은 라인 집합에 포함하지 않는다", () => {
    const records = [stubRecord("champion:Ahri:pickRate", "Ahri")];
    expect(lanesForEntityKey(records, "Ahri")).toEqual([]);
  });

  it("다른 entityKey 행은 무시한다", () => {
    const records = [stubRecord("champion:Zed:TOP:pickRate", "Zed")];
    expect(lanesForEntityKey(records, "Ahri")).toEqual([]);
  });

  it("position-scope 행이 없으면 빈 배열(라인을 추측하지 않음)", () => {
    expect(lanesForEntityKey([], "Ahri")).toEqual([]);
  });

  it("champion이 아닌 id 네임스페이스(lane:/objective: 등)는 parseLaneAxis가 항상 null이라 빈 배열로 안전하게 떨어진다(scope-critic 2026-09-10 확인 — 홈 스트림이 entityType 무관하게 모든 unannounced를 렌더하므로, 이 안전망이 없으면 라인 필터가 오작동할 수 있었다)", () => {
    const records = [
      stubRecord("lane:BOTTOM:goldAt10", "BOTTOM"),
      stubRecord("objective:dragon:firstSec", "dragon"),
      stubRecord("summary:avgDurationSec", "avgDurationSec"),
    ];
    expect(lanesForEntityKey(records, "BOTTOM")).toEqual([]);
    expect(lanesForEntityKey(records, "dragon")).toEqual([]);
    expect(lanesForEntityKey(records, "avgDurationSec")).toEqual([]);
  });
});
