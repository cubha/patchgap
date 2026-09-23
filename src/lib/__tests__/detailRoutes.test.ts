// src/lib/__tests__/detailRoutes.test.ts
// 2026-09-19 최종 채점 K2-4(低): 노이즈 상태(표본 부족·바닥 미달·변화 없음) 상세 라우트 1,870건이
// **링크는 0인데 파일로는 존재**했다. 사용자 지시("아예 보여주지 않도록")는 링크를 지우는 것이
// 아니라 그 관측을 화면에서 없애는 것이라, 직접 URL로 열어도 나오면 안 된다.
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { detailEntityKeys, detailRouteIds, detailRouteSlugs, entityKeyOf } from "../detailRoutes";

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

// ── 2026-09-23 §8-7 #10: 라우트 단위를 **지표 → 대상**으로 옮겼다 ──────────────────
const entityRow = (over: Partial<DeltaRecord> & Pick<DeltaRecord, "id">): DeltaRecord => ({
  entityType: "champion",
  entityKey: "MonkeyKing",
  entityName: "오공",
  metric: "winRate",
  before: 0.5,
  after: 0.52,
  delta: 0.02,
  ci: [0.01, 0.03],
  n: { before: 1000, after: 1000 },
  q: 0.01,
  status: "unannounced",
  matchedNoteId: null,
  matchedNoteIds: [],
  causes: [],
  evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
  ...over,
});

const rows = [
  entityRow({ id: "champion:MonkeyKing:winRate" }),
  entityRow({ id: "champion:MonkeyKing:JUNGLE:winRate", metric: "winRate" }),
  entityRow({ id: "item:6610:adoptionRate", entityType: "item", entityKey: "6610", entityName: "갈라진 하늘", metric: "adoptionRate" }),
  // 노이즈는 라우트를 갖지 않는다(2026-09-19 K2-4).
  entityRow({ id: "champion:Zed:pickRate", entityKey: "Zed", entityName: "제드", status: "no-change" }),
];

describe("대상 단위 라우트", () => {
  it("한 대상의 지표가 여럿이어도 라우트는 하나다", () => {
    expect(detailEntityKeys([rows])).toEqual(["champion:MonkeyKing", "item:6610"]);
  });

  it("노이즈만 가진 대상은 라우트를 갖지 않는다", () => {
    expect(detailEntityKeys([rows])).not.toContain("champion:Zed");
  });

  it("행에서 대상 키를 뽑는다 — 지표·라인은 키에 들어가지 않는다", () => {
    expect(entityKeyOf(rows[1])).toBe("champion:MonkeyKing");
  });

  it("여러 패치 쌍에 걸쳐 중복 없이 모은다", () => {
    expect(detailEntityKeys([rows, rows])).toEqual(["champion:MonkeyKing", "item:6610"]);
  });
});

describe("구 지표 경로 별칭", () => {
  it("슬러그 목록은 대상 키와 구 지표 id를 **둘 다** 낸다", () => {
    const slugs = detailRouteSlugs([rows]);
    expect(slugs).toContain("champion~MonkeyKing");
    expect(slugs).toContain("champion~MonkeyKing~JUNGLE~winRate");
    expect(slugs).toContain("item~6610");
  });

  it("별칭은 구 라우트 자격(`detailRouteIds`)과 정확히 같은 집합이다", () => {
    const slugs = new Set(detailRouteSlugs([rows]));
    for (const id of detailRouteIds([rows])) {
      expect(slugs.has(id.replace(/:/g, "~")), id).toBe(true);
    }
  });

  it("중복 슬러그를 내지 않는다 — 정적 export가 같은 경로를 두 번 만들지 않게", () => {
    const slugs = detailRouteSlugs([rows, rows]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
