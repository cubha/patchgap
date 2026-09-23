// src/components/compare/__tests__/noteNav.test.ts
// 좌 「패치노트 항목」 내비의 **묶는 규칙**(UX-BRIEF §8-3). LoL에만 있던 내비를 TFT·PUBG에도
// 세우면서, 게임마다 자기 묶기를 다시 짜지 않도록 규칙을 순수 함수로 내린다.
// 대상 동일성은 `section:entity`다 — `briefingRows.groupBriefingItems`와 같은 규율이다.
import { describe, expect, it } from "vitest";
import {
  filterNoteNavGroups,
  groupNoteNavItems,
  noteNavSections,
  type NoteNavItem,
} from "../noteNav";

const item = (over: Partial<NoteNavItem> & Pick<NoteNavItem, "id" | "entity">): NoteNavItem => ({
  section: "champion",
  sectionLabel: "챔피언",
  summary: "",
  ...over,
});

const items: NoteNavItem[] = [
  item({ id: "n1", entity: "오공", detail: "Q", summary: "피해량 상향" }),
  item({ id: "n2", entity: "오공", detail: "E", summary: "쿨다운 하향" }),
  item({ id: "n3", entity: "갈라진 하늘", section: "item", sectionLabel: "아이템", summary: "가격 인하" }),
  item({ id: "n4", entity: "오공", section: "item", sectionLabel: "아이템", summary: "동명이의" }),
];

describe("묶기", () => {
  it("같은 섹션·같은 이름이면 한 묶음이다", () => {
    const groups = groupNoteNavItems(items);
    const wukong = groups.find((g) => g.entity === "오공" && g.section === "champion")!;
    expect(wukong.items).toHaveLength(2);
    expect(wukong.id).toBe("n1"); // 대표 id = 첫 줄
  });

  it("이름이 같아도 섹션이 다르면 다른 묶음이다 — 이름으로 묶지 않는다", () => {
    const groups = groupNoteNavItems(items);
    expect(groups.filter((g) => g.entity === "오공")).toHaveLength(2);
  });

  it("입력 순서를 보존한다 — 정렬은 호출부(게임)의 몫이다", () => {
    expect(groupNoteNavItems(items).map((g) => g.id)).toEqual(["n1", "n3", "n4"]);
  });

  it("보조 문구(detail)는 첫 등장 순서로 중복 없이 모은다", () => {
    const dup = [
      item({ id: "a", entity: "니달리", detail: "Q" }),
      item({ id: "b", entity: "니달리", detail: "Q" }),
      item({ id: "c", entity: "니달리", detail: "W" }),
    ];
    expect(groupNoteNavItems(dup)[0].details).toEqual(["Q", "W"]);
  });

  it("detail이 없으면 details는 빈 배열이다 — 빈 문자열을 넣지 않는다", () => {
    expect(groupNoteNavItems([item({ id: "z", entity: "제드" })])[0].details).toEqual([]);
  });
});

describe("섹션 탭", () => {
  it("등장한 섹션만, 등장 순서대로, 묶음 수를 센다 — 줄 수가 아니다", () => {
    expect(noteNavSections(groupNoteNavItems(items))).toEqual([
      { key: "champion", label: "챔피언", count: 1 },
      { key: "item", label: "아이템", count: 2 },
    ]);
  });

  it("노트가 없으면 탭도 없다 — 0건 탭을 지어내지 않는다", () => {
    expect(noteNavSections([])).toEqual([]);
  });
});

describe("거르기", () => {
  const groups = groupNoteNavItems(items);

  it("섹션이 null이면 전체", () => {
    expect(filterNoteNavGroups(groups, null, "")).toHaveLength(3);
  });

  it("섹션 + 검색이 함께 걸린다", () => {
    expect(filterNoteNavGroups(groups, "item", "오공").map((g) => g.id)).toEqual(["n4"]);
  });

  it("검색은 이름과 보조 문구 둘 다 본다", () => {
    expect(filterNoteNavGroups(groups, null, "e").map((g) => g.id)).toEqual(["n1"]);
  });
});
