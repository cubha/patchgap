// src/lib/__tests__/observationEta.test.ts
// 「관측은 언제부터인가」(PLAN-home-observed-pair ST-3, 2026-10-09). 선언만 쌍의 배너·안내가 날짜 없이 "관측 대기"라고만
// 하면 사람은 고장과 대기를 구별하지 못한다. 날짜는 캘린더 창 시작 + 관측 N일차 이후 **첫 cron 시각**으로 계산한다 —
// 실측(TFT 18.4): 라이브 2026-10-06T18:00Z, N=3 → 임계 10-09T18:00Z → 첫 cron(21:00 UTC) = 10-09T21:00Z = 10/10(토) 06:00 KST.
import { describe, expect, it } from "vitest";

import { etaLabelKst, nextCronAfter, tftObservationEta, tftObservationSchedule } from "@/lib/observationEta";

const WINDOWS = [
  { patch: "18.3", startMs: Date.parse("2026-09-22T18:00:00Z"), endMs: Date.parse("2026-10-06T18:00:00Z") },
  { patch: "18.4", startMs: Date.parse("2026-10-06T18:00:00Z"), endMs: null },
];

describe("nextCronAfter — 임계 시각 이후 첫 cron(매일 HH:00 UTC)", () => {
  it("임계가 cron 시각 전이면 그날, 지나면 다음 날", () => {
    expect(nextCronAfter(Date.parse("2026-10-09T18:00:00Z"), 21)).toBe(Date.parse("2026-10-09T21:00:00Z"));
    expect(nextCronAfter(Date.parse("2026-10-09T21:00:00Z"), 21)).toBe(Date.parse("2026-10-09T21:00:00Z"));
    expect(nextCronAfter(Date.parse("2026-10-09T21:00:01Z"), 21)).toBe(Date.parse("2026-10-10T21:00:00Z"));
  });
});

describe("tftObservationEta — 창 시작 + 관측 N일차 이후 첫 cron", () => {
  it("세트 중간 패치(18.4)는 3일차", () => {
    expect(tftObservationEta("18.4", WINDOWS)).toBe("2026-10-09T21:00:00.000Z");
  });
  it("세트 개시 패치(x.1)는 9일차", () => {
    const windows = [{ patch: "19.1", startMs: Date.parse("2026-11-01T18:00:00Z"), endMs: null }];
    expect(tftObservationEta("19.1", windows)).toBe("2026-11-10T21:00:00.000Z");
  });
  it("캘린더에 없는 패치는 null — 날짜를 지어내지 않는다", () => {
    expect(tftObservationEta("18.9", WINDOWS)).toBeNull();
  });
});

describe("etaLabelKst — 「10/10(토) 06:00 KST」", () => {
  it("KST 요일·시각", () => {
    expect(etaLabelKst("2026-10-09T21:00:00.000Z")).toBe("10/10(토) 06:00 KST");
    expect(etaLabelKst("2026-11-10T21:00:00.000Z")).toBe("11/11(수) 06:00 KST");
  });
});

describe("cron 시각 상수는 워크플로가 정본이다 — 산문·상수가 갈리면 날짜가 조용히 틀린다", () => {
  it("TFT_COLLECT_CRON_HOUR_UTC == collect-tft.yml의 cron 시", async () => {
    const fs = await import("node:fs");
    const { TFT_COLLECT_CRON_HOUR_UTC } = await import("@/lib/observationEta");
    const yml = fs.readFileSync(".github/workflows/collect-tft.yml", "utf8");
    const m = /-\s*cron:\s*"(\d+)\s+(\d+)\s+\*\s+\*\s+\*"/.exec(yml);
    expect(m, "collect-tft.yml에 매일 cron이 있어야 한다").not.toBeNull();
    expect(TFT_COLLECT_CRON_HOUR_UTC).toBe(Number(m![2]));
  });
});

describe("웹 창 합성은 파이프라인 창 합성과 같다 — 복제 드리프트 게이트", () => {
  it("loadTftWindowsForWeb() deep-equal scripts/shared/calendar#loadTftWindows()", async () => {
    const { loadTftWindowsForWeb } = await import("@/lib/observationEta");
    const { loadTftWindows } = await import("../../../scripts/shared/calendar");
    expect(loadTftWindowsForWeb()).toEqual(loadTftWindows("data"));
  });
});

// 2026-10-11 실측: 예정(10/10 06:00 KST)이 지난 뒤에도 stub이 남자(75분 마감 부분 수집) 날짜 계산이 null이 되어 화면이 「표본이 쌓이면」만
// 말했다 → 불변식 2건 실패·Discord 경보 반복. 대기·수집 중이면 **언제나** 다음 실행 시각을 말한다(날짜를 지어내는 게 아니라 cron 규칙).
describe("tftObservationSchedule — 대기·수집 중이면 늘 다음 실행 시각", () => {
  const at = "2026-10-07T12:00:00Z";
  it("대기 + 예정이 미래 → 첫 관측(예정 시각)", () => {
    const s = tftObservationSchedule({ reason: "awaiting-observation", detail: "", at }, "18.4", Date.parse("2026-10-08T00:00:00Z"), WINDOWS);
    expect(s).toEqual({ kind: "first", label: "10/10(토) 06:00 KST" });
  });
  it("대기 + 예정이 지났다 → 다음 수집(빌드 시각 이후 첫 cron)", () => {
    const s = tftObservationSchedule({ reason: "awaiting-observation", detail: "", at }, "18.4", Date.parse("2026-10-10T15:00:00Z"), WINDOWS);
    expect(s).toEqual({ kind: "next", label: "10/11(일) 06:00 KST" });
  });
  it("수집 중 → 다음 수집", () => {
    const s = tftObservationSchedule({ reason: "collecting", detail: "", at }, "18.4", Date.parse("2026-10-10T15:00:00Z"), WINDOWS);
    expect(s).toEqual({ kind: "next", label: "10/11(일) 06:00 KST" });
  });
  it("키 만료·크래시는 날짜가 아니라 조치가 답 — null", () => {
    for (const reason of ["key-expired", "crashed", "product-unapproved"] as const) {
      expect(tftObservationSchedule({ reason, detail: "", at }, "18.4", Date.parse("2026-10-08T00:00:00Z"), WINDOWS)).toBeNull();
    }
  });
  it("캘린더에 없는 패치의 대기는 null — 날짜를 지어내지 않는다", () => {
    expect(tftObservationSchedule({ reason: "awaiting-observation", detail: "", at }, "19.9", Date.parse("2026-10-08T00:00:00Z"), WINDOWS)).toBeNull();
  });
});
