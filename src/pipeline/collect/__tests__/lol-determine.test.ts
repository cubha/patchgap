// src/pipeline/collect/__tests__/lol-determine.test.ts
// RED 먼저 — LoL `determine`이 **워크플로 안 heredoc**이라 tsc·eslint·vitest 어느 게이트도
// 그 코드를 보지 못한다(TFT·PUBG는 실파일이라 테스트가 있다). 수집 실행 여부를 정하는 코드가
// 검증 밖에 있다. 여기로 옮기면서 규칙을 고정한다.
//
// 동작은 heredoc과 **같아야 한다** — 이 테스트가 그 등가를 붙잡는다. 더해지는 것은 하나뿐:
// 캘린더가 말라 가면 경보를 낸다(LoL만 그게 없어서, 안 채우면 매주 초록으로 아무것도 안 했다).
import { describe, it, expect } from "vitest";

import { determineLolRun } from "../patch-calendar";

const CAL = {
  "26.17": { liveKst: "2026-08-27" },
  "26.18": { liveKst: "2026-09-10" },
  "26.19": { liveKst: "2026-09-24" },
};

describe("determineLolRun — heredoc과 같은 판정", () => {
  it("오늘이 라이브일이면 돈다", () => {
    const d = determineLolRun({ todayKst: "2026-09-24", calendar: CAL, hasOutputs: false });
    expect(d.shouldRun).toBe(true);
    expect(d.patch).toBe("26.19");
    expect(d.from).toBe("26.18");
    expect(d.to).toBe("26.19");
  });

  it("라이브일이 아니면 no-op", () => {
    const d = determineLolRun({ todayKst: "2026-09-23", calendar: CAL, hasOutputs: false });
    expect(d.shouldRun).toBe(false);
    expect(d.patch).toBeNull();
  });

  it("★ 캘린더 판정인데 산출물이 이미 있으면 중복 실행으로 보고 건너뛴다", () => {
    const d = determineLolRun({ todayKst: "2026-09-24", calendar: CAL, hasOutputs: true });
    expect(d.shouldRun).toBe(false);
  });

  it("force면 산출물이 있어도 돈다", () => {
    const d = determineLolRun({ todayKst: "2026-09-24", calendar: CAL, hasOutputs: true, force: true });
    expect(d.shouldRun).toBe(true);
  });

  it("수동 패치는 라이브일과 무관하게 돈다 — 그리고 중복 가드를 타지 않는다", () => {
    const d = determineLolRun({
      todayKst: "2026-10-01", calendar: CAL, hasOutputs: true, manualPatch: "26.18",
    });
    expect(d.shouldRun).toBe(true);
    expect(d.patch).toBe("26.18");
    expect(d.from).toBe("26.17");
  });

  it("수동 from·to가 캘린더 추론을 이긴다", () => {
    const d = determineLolRun({
      todayKst: "2026-09-24", calendar: CAL, hasOutputs: false,
      manualFrom: "26.16", manualTo: "26.19",
    });
    expect(d.from).toBe("26.16");
    expect(d.to).toBe("26.19");
  });

  it("첫 패치는 from이 자기 자신이다(앞이 없다)", () => {
    const d = determineLolRun({ todayKst: "2026-08-27", calendar: CAL, hasOutputs: false });
    expect(d.from).toBe("26.17");
  });

  it("★ 26.9와 26.18을 문자열로 정렬하지 않는다 — 앞 패치를 숫자로 찾는다", () => {
    const cal = { "26.9": { liveKst: "2026-05-01" }, "26.18": { liveKst: "2026-09-10" } };
    const d = determineLolRun({ todayKst: "2026-09-10", calendar: cal, hasOutputs: false });
    expect(d.from).toBe("26.9");
  });
});

describe("determineLolRun — 캘린더가 마르면 말한다", () => {
  it("★ 마지막 패치가 주기를 한참 넘기면 경보다 — 이게 없어서 매주 초록으로 아무것도 안 했다", () => {
    const d = determineLolRun({ todayKst: "2026-10-30", calendar: CAL, hasOutputs: false });
    expect(d.shouldRun).toBe(false);
    expect(d.staleCalendar).toBe(true);
  });

  it("정상 구간에서는 경보가 아니다 — 매일 울면 아무도 안 본다", () => {
    const d = determineLolRun({ todayKst: "2026-09-30", calendar: CAL, hasOutputs: false });
    expect(d.staleCalendar).toBe(false);
  });
});
