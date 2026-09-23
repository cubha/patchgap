// src/components/__tests__/briefingRows.test.ts
// §8-2 "세는 단위는 대상" — 묶는 규칙을 렌더 없이 고정한다.
import { describe, expect, it } from "vitest";

import { groupBriefingItems, itemCountLabel, type BriefingItem } from "../briefingRows";

const item = (over: Partial<BriefingItem> & Pick<BriefingItem, "id" | "entityKey">): BriefingItem => ({
  entityName: over.entityKey,
  entityType: "unit",
  status: "unannounced",
  field: "등장률",
  change: "10% → 12%",
  ...over,
});

describe("groupBriefingItems", () => {
  it("같은 대상의 여러 지표를 한 그룹으로 묶는다", () => {
    const groups = groupBriefingItems([
      item({ id: "a1", entityKey: "Kha", field: "등장률" }),
      item({ id: "a2", entityKey: "Kha", field: "평균 등수" }),
      item({ id: "b1", entityKey: "Leona" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.field)).toEqual(["등장률", "평균 등수"]);
    expect(itemCountLabel(groups[0])).toBe("2개 항목");
    expect(itemCountLabel(groups[1])).toBe("1개 항목");
  });

  it("입력 순서를 보존한다 — 정렬은 호출부 책임이다", () => {
    const groups = groupBriefingItems([
      item({ id: "z", entityKey: "Zed" }),
      item({ id: "a", entityKey: "Ahri" }),
      item({ id: "z2", entityKey: "Zed" }),
    ]);
    expect(groups.map((g) => g.entityKey)).toEqual(["Zed", "Ahri"]);
  });

  it("이름이 같아도 유형이 다르면 다른 대상이다", () => {
    // TFT는 특성·아이템이 같은 한국어 이름을 쓰는 경우가 있다 — 이름으로 묶으면 섞인다.
    const groups = groupBriefingItems([
      item({ id: "t", entityKey: "Sniper", entityType: "trait", entityName: "사냥꾼" }),
      item({ id: "i", entityKey: "Sniper", entityType: "item", entityName: "사냥꾼" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("대표 상태는 첫 항목의 상태다 — 여기서 다시 고르지 않는다", () => {
    const groups = groupBriefingItems([
      item({ id: "1", entityKey: "Kha", status: "announced" }),
      item({ id: "2", entityKey: "Kha", status: "unannounced" }),
    ]);
    expect(groups[0].status).toBe("announced");
  });

  it("빈 입력은 빈 배열", () => {
    expect(groupBriefingItems([])).toEqual([]);
  });
});
