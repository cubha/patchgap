// src/lib/__tests__/detailRoutes.test.ts
// 2026-09-19 최종 채점 K2-4(低): 노이즈 상태(표본 부족·바닥 미달·변화 없음) 상세 라우트 1,870건이
// **링크는 0인데 파일로는 존재**했다. 사용자 지시("아예 보여주지 않도록")는 링크를 지우는 것이
// 아니라 그 관측을 화면에서 없애는 것이라, 직접 URL로 열어도 나오면 안 된다.
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { detailRouteIds } from "../detailRoutes";

function row(id: string, status: DeltaRecord["status"]): DeltaRecord {
  return {
    id,
    entityType: "champion",
    entityKey: "X",
    entityName: "X",
    metric: "winRate",
    before: 0.5,
    after: 0.52,
    delta: 0.02,
    ci: [0.01, 0.03],
    n: { before: 500, after: 500 },
    q: 0.01,
    status,
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
  };
}

describe("detailRouteIds", () => {
  it("노이즈 3종은 라우트를 만들지 않는다", () => {
    const ids = detailRouteIds([
      [row("a", "unannounced"), row("b", "below-threshold"), row("c", "insufficient-sample"), row("d", "no-change")],
    ]);
    expect(ids).toEqual(["a"]);
  });

  it("공지·이상 관측·간접 영향은 남긴다", () => {
    const ids = detailRouteIds([
      [row("a", "announced-consistent"), row("b", "announced-inconsistent"), row("c", "indirect-effect")],
    ]);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("여러 패치 쌍에 같은 id가 있어도 한 번만 낸다", () => {
    expect(detailRouteIds([[row("a", "unannounced")], [row("a", "unannounced")]])).toEqual(["a"]);
  });

  it("전부 노이즈면 빈 배열 — 호출부가 _placeholder로 대체한다", () => {
    expect(detailRouteIds([[row("a", "no-change")]])).toEqual([]);
  });
});
