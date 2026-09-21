// src/components/tft/__tests__/entityRows.submarine.test.ts
// RED 먼저 — **행 집합이 갈라진 것**이 결함의 정체다(2026-09-21).
//
// `tft/compare/page.tsx`는 `buildTftEntityRows(rows, qAlpha, submarine)`로 잠수함 전용 행까지
// 만들어 이름에 링크를 걸었는데, 같은 파일의 `generateStaticParams`는 submarine 인자 **없이**
// 같은 함수를 불렀다. 그래서 링크는 있고 경로는 없다 — 실측 404(`unit~DA_18_ElderDragon` 외 TFT 21건).
//
// 호출부가 셋(`generateStaticParams`·`generateMetadata`·`TftUnitPage`)이라 하나만 고치면
// 빌드는 초록인데 본문이 "보고할 관측이 없는 엔티티다"로 뜬다. 그래서 **진입점을 하나로 만든다**.
import { describe, it, expect } from "vitest";

import { tftEntityRows } from "../entityRows";
import type { GameDataChange } from "@/pipeline/gamedata/types";
import type { DeltaMetric, DeltaRecord, MatchStatus } from "@/pipeline/types";

function rec(entityKey: string, metric: DeltaMetric, delta: number, status: MatchStatus): DeltaRecord {
  return {
    id: `unit:${entityKey}:${metric}`,
    entityType: "unit",
    entityKey,
    entityName: `이름-${entityKey}`,
    metric,
    before: 0.5,
    after: 0.5 + delta,
    delta,
    ci: delta > 0 ? [delta / 2, delta * 1.5] : [delta * 1.5, delta / 2],
    n: { before: 5000, after: 5000 },
    q: 0.001,
    status,
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "p", noteAnchor: null },
  };
}

function change(entityKey: string, entityName: string, field: string): GameDataChange {
  return {
    id: `gdc:tft:18.2:${entityKey}:${field}`,
    entityKey,
    entityName,
    entityType: "unit",
    field,
    fieldPath: field,
    before: 110,
    after: 125,
    relChange: 15 / 110,
    matchedNoteIds: [],
  };
}

const DELTAS = {
  rows: [rec("DA_18_KhaZix", "playRate", 0.05, "unannounced")],
  meta: { qAlpha: 0.1 },
};

describe("tftEntityRows — 대조표·상세·경로가 같은 행 집합을 본다", () => {
  it("★ 잠수함 전용 엔티티도 행이 된다 — 델타가 없어도", () => {
    const rows = tftEntityRows(DELTAS, [change("DA_18_ElderDragon", "장로 드래곤", "공격력")]);
    const keys = rows.map((r) => r.key);
    expect(keys).toContain("unit:DA_18_ElderDragon");
    // 링크를 걸어 놓고 경로를 안 만든 것이 실측 404의 원인이었다.
    expect(keys).toContain("unit:DA_18_KhaZix");
  });

  it("잠수함 전용 행은 관측 칸이 비고 변경 내역을 든다", () => {
    const rows = tftEntityRows(DELTAS, [change("DA_18_ElderDragon", "장로 드래곤", "공격력")]);
    const row = rows.find((r) => r.key === "unit:DA_18_ElderDragon");
    expect(row).toBeDefined();
    expect(Object.keys(row!.cells)).toHaveLength(0);
    expect(row!.status).toBe("submarine");
    expect(row!.submarineChanges.map((c) => c.field)).toEqual(["공격력"]);
  });

  it("델타가 있는 엔티티에도 수치 축이 얹힌다 — 배지가 덮이고 내역이 붙는다", () => {
    const rows = tftEntityRows(DELTAS, [change("DA_18_KhaZix", "카직스", "체력")]);
    const row = rows.find((r) => r.key === "unit:DA_18_KhaZix");
    expect(row!.status).toBe("submarine");
    expect(row!.submarineChanges).toHaveLength(1);
  });

  it("공지된 수치 변경은 잠수함이 아니다 — 행을 새로 만들지 않는다", () => {
    const announced: GameDataChange = {
      ...change("DA_18_ElderDragon", "장로 드래곤", "공격력"),
      matchedNoteIds: ["note-1"],
    };
    const rows = tftEntityRows(DELTAS, [announced]);
    expect(rows.map((r) => r.key)).not.toContain("unit:DA_18_ElderDragon");
  });

  it("수치 축 산출물이 없으면(빈 배열) 지표 축 행만 남는다", () => {
    const rows = tftEntityRows(DELTAS, []);
    expect(rows.map((r) => r.key)).toEqual(["unit:DA_18_KhaZix"]);
  });
});
