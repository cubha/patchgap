import { describe, expect, it } from "vitest";

import { latestPatchId, stalenessOf, stalenessTable } from "../staleness";

describe("latestPatchId", () => {
  it("마이너가 두 자리로 넘어가도 최신을 고른다", () => {
    // **이 테스트가 이 함수의 존재 이유다.** 사전순이면 "26.9" > "26.10"이라 마이너가 두 자리가
    // 되는 순간 조용히 한 패치 뒤로 간다 — 화면이 최신이라고 말하면서 옛 패치를 보여준다.
    expect(latestPatchId(["26.9", "26.10"])).toBe("26.10");
    expect(latestPatchId(["26.10", "26.9"])).toBe("26.10");
    expect(latestPatchId(["26.18", "26.19", "26.17"])).toBe("26.19");
  });

  it("메이저가 넘어가도 고른다", () => {
    expect(latestPatchId(["26.19", "27.1"])).toBe("27.1");
  });

  it("빈 목록은 null", () => {
    expect(latestPatchId([])).toBeNull();
  });
});

describe("stalenessOf", () => {
  it("캘린더가 집계보다 앞서면 미수집", () => {
    expect(stalenessOf("tft", "18.3", "18.2").behind).toBe(true);
  });

  it("같으면 최신", () => {
    expect(stalenessOf("pubg", "43.1", "43.1").behind).toBe(false);
  });

  it("집계가 없는데 캘린더에 패치가 있으면 미수집(첫 수집 전)", () => {
    expect(stalenessOf("lol", "26.19", null).behind).toBe(true);
  });

  it("캘린더가 비면 **미수집이라고 말하지 않는다**", () => {
    // 「감시자가 아직 아무것도 모른다」와 「받아야 하는데 못 받았다」는 다른 상태다.
    // 뭉치면 또 한 문구가 두 상태를 덮는다 — 이 모듈이 고치려는 결함 그 자체.
    const r = stalenessOf("lol", null, null);
    expect(r.behind).toBe(false);
    expect(r.calendarLatest).toBeNull();
  });

  it("집계가 캘린더보다 앞서도 미수집은 아니다(수기 투입 등)", () => {
    expect(stalenessOf("lol", "26.18", "26.19").behind).toBe(false);
  });
});

describe("stalenessTable", () => {
  it("세 상태를 구분해 적는다", () => {
    const table = stalenessTable([
      stalenessOf("lol", "26.19", "26.18"),
      stalenessOf("pubg", "43.1", "43.1"),
      stalenessOf("tft", null, null),
    ]);
    expect(table).toContain("| lol | 26.19 | 26.18 | 미수집 (26.18 → 26.19) |");
    expect(table).toContain("| pubg | 43.1 | 43.1 | 최신 |");
    expect(table).toContain("| tft | — | — | 캘린더 비어 있음 |");
  });

  it("며칠 밀렸는지는 적지 않는다 — 임계값을 부르지 않기 위해", () => {
    // 날짜를 적으면 곧 "N일 넘으면 실패"를 만들고 싶어진다. 그 N은 정직하게 고를 수 없다
    // (심사 대기가 몇 주면 매일 빨간불 → 그 알림은 무시된다 = 고치려던 실패 양식 그대로).
    const table = stalenessTable([stalenessOf("tft", "18.3", "18.2")]);
    expect(table).not.toMatch(/\d+\s*일/);
  });
});
