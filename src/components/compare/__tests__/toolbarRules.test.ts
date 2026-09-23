// src/components/compare/__tests__/toolbarRules.test.ts
// 대조표 도구모음의 **규칙**을 고정한다(UX-BRIEF §8-3 "상태 칩 세트·개수 표기·정렬·검색은 세 게임
// 동일 규칙"). 실측 이탈(§8-7 #7): 칩이 LoL 4·PUBG 3·TFT 0, 개수 표기는 PUBG만, 검색은 LoL만,
// 정렬은 PUBG만이었다. 렌더 없이 판정할 수 있어야 회귀를 테스트가 막는다.
import { describe, expect, it } from "vitest";
import {
  COMPARE_FILTERS,
  COMPARE_SORTS,
  countByFilter,
  matchesFilter,
  searchRows,
  sortRows,
  type CompareFilterKey,
} from "../toolbarRules";
import type { DisplayStatus } from "@/pipeline/shared/display-status";

interface Row {
  name: string;
  status: DisplayStatus;
  effect: number;
}
const rows: Row[] = [
  { name: "오공", status: "unannounced", effect: 0.108 },
  { name: "카밀", status: "announced", effect: 0.31 },
  { name: "에코", status: "announced-anomaly", effect: 0.05 },
  { name: "Groza", status: "unannounced", effect: 0.26 },
];
const statusOf = (r: Row) => r.status;

describe("칩 세트 — 세 게임이 같은 4종을 쓴다", () => {
  it("전체 · 공지 · 공지 · 이상 관측 · 미공지 순이다", () => {
    expect(COMPARE_FILTERS.map((f) => f.key)).toEqual([
      "all",
      "announced",
      "announced-anomaly",
      "unannounced",
    ]);
  });

  it("칩은 전부 개수를 가진다 — 표기 유무가 게임마다 갈리지 않는다", () => {
    const counts = countByFilter(rows, statusOf);
    expect(counts.all).toBe(4);
    expect(counts.announced).toBe(1);
    expect(counts["announced-anomaly"]).toBe(1);
    expect(counts.unannounced).toBe(2);
    // 키가 빠지면 화면이 `undefined`를 그린다 — 모든 칩 키가 채워져야 한다.
    for (const f of COMPARE_FILTERS) expect(typeof counts[f.key]).toBe("number");
  });

  it("`전체`는 무엇이든 통과시키고, 나머지는 표시 키와 정확히 일치한다", () => {
    expect(matchesFilter("unannounced", "all")).toBe(true);
    expect(matchesFilter("unannounced", "unannounced")).toBe(true);
    expect(matchesFilter("announced", "unannounced")).toBe(false);
  });

  it("칩 키는 URL 해시로 쓸 수 있는 형태다 — 타일이 `#unannounced`로 착지한다", () => {
    for (const f of COMPARE_FILTERS) expect(f.key).toMatch(/^[a-z-]+$/);
  });
});

describe("정렬 — 세 게임이 같은 키를 제공한다", () => {
  it("판정 우선순위 · 변화 크기 · 이름 3종이고 기본은 판정 우선순위다", () => {
    expect(COMPARE_SORTS.map((s) => s.key)).toEqual(["priority", "effect", "name"]);
    expect(COMPARE_SORTS[0].key).toBe("priority");
  });

  it("`effect`는 |변화| 내림차순", () => {
    const out = sortRows(rows, "effect", { statusOf, effectOf: (r) => r.effect, nameOf: (r) => r.name });
    expect(out.map((r) => r.name)).toEqual(["카밀", "Groza", "오공", "에코"]);
  });

  it("`name`은 이름 오름차순(로캘)", () => {
    const out = sortRows(rows, "name", { statusOf, effectOf: (r) => r.effect, nameOf: (r) => r.name });
    expect(out[0].name).toBe("Groza");
  });

  it("`priority`는 판정 우선순위 우선 · 같은 판정 안에서만 |변화|로 가른다", () => {
    const out = sortRows(rows, "priority", { statusOf, effectOf: (r) => r.effect, nameOf: (r) => r.name });
    // 미공지가 공지보다 위, 미공지 둘 사이에서는 |Δ| 큰 Groza가 앞.
    expect(out.map((r) => r.name)).toEqual(["Groza", "오공", "에코", "카밀"]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const before = rows.map((r) => r.name);
    sortRows(rows, "name", { statusOf, effectOf: (r) => r.effect, nameOf: (r) => r.name });
    expect(rows.map((r) => r.name)).toEqual(before);
  });
});

describe("검색 — 대상 이름으로 거른다", () => {
  it("빈 질의는 전부 통과시킨다", () => {
    expect(searchRows(rows, "", (r) => r.name)).toHaveLength(4);
  });

  it("부분 일치 · 대소문자 무시", () => {
    expect(searchRows(rows, "gro", (r) => r.name).map((r) => r.name)).toEqual(["Groza"]);
    expect(searchRows(rows, " 오공 ", (r) => r.name).map((r) => r.name)).toEqual(["오공"]);
  });

  it("맞는 것이 없으면 빈 배열 — 전체로 폴백하지 않는다", () => {
    expect(searchRows(rows, "없는이름", (r) => r.name)).toEqual([]);
  });
});

describe("필터 키 타입", () => {
  it("`all`과 표시 키만 허용한다", () => {
    const key: CompareFilterKey = "unannounced";
    expect(COMPARE_FILTERS.some((f) => f.key === key)).toBe(true);
  });
});
