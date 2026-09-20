// src/pipeline/collect/pubg/__tests__/patch-calendar.test.ts
// 달력이 **커밋된 산출물과 같은 창**을 만드는지, 그리고 336시간 보존창을 넘긴 패치쌍을
// 조용히 돌리려 들지 않는지 본다.
import { describe, expect, it } from "vitest";

import {
  comparisonWindows,
  determinePubgRun,
  HARVEST_EARLIEST_DAY,
  HARVEST_LATEST_DAY,
  PUBG_PATCH_WINDOWS,
} from "../patch-calendar";

const at = (day: string): number => Date.parse(`${day}T21:00:00Z`);

describe("PUBG 패치 달력", () => {
  it("43.1 창이 커밋된 집계의 창과 같다", () => {
    // `data/aggregated/pubg/deltas.json`의 meta.window가 이 값이다 — 손으로 고른 날짜를
    // 산술로 재현하지 못하면, 다음 패치의 수치는 이전 패치와 같은 방식으로 만들어진 것이 아니다.
    expect(comparisonWindows("2026-09-09")).toEqual({
      before: ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"],
      after: ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"],
    });
  });

  it("두 창은 정확히 7일 차이라 요일이 맞는다", () => {
    const { before, after } = comparisonWindows("2026-09-09");
    for (let i = 0; i < before.length; i += 1) {
      const gap = (Date.parse(`${after[i]}T00:00:00Z`) - Date.parse(`${before[i]}T00:00:00Z`)) / 86_400_000;
      expect(gap, `${before[i]} → ${after[i]}`).toBe(7);
      expect(new Date(`${after[i]}T00:00:00Z`).getUTCDay()).toBe(
        new Date(`${before[i]}T00:00:00Z`).getUTCDay()
      );
    }
  });

  it("after 구간이 닫히기 전에는 돌지 않는다", () => {
    const d = determinePubgRun({ nowMs: at("2026-09-13"), outputsExist: false });
    expect(d.shouldRun).toBe(false);
    expect(d.reason).toContain("아직 안 닫혔다");
  });

  it("보존창 안(patch+7…+9)에서는 돈다", () => {
    for (const day of ["2026-09-16", "2026-09-17", "2026-09-18"]) {
      const d = determinePubgRun({ nowMs: at(day), outputsExist: false });
      expect(d.shouldRun, day).toBe(true);
      expect(d.from).toBe("42.3");
      expect(d.to).toBe("43.1");
      expect(d.telemetryTo).toBe("pc-2018-43");
    }
  });

  it("336시간을 넘기면 '수집 불가'라고 말한다 — 조용히 건너뛰지 않는다", () => {
    const d = determinePubgRun({ nowMs: at("2026-09-20"), outputsExist: false });
    expect(d.shouldRun).toBe(false);
    expect(d.reason).toContain("336시간");
    expect(d.reason).toContain("2026-09-04");
  });

  it("산출물이 있으면 중복 실행하지 않는다", () => {
    const d = determinePubgRun({ nowMs: at("2026-09-17"), outputsExist: true });
    expect(d.shouldRun).toBe(false);
    expect(d.reason).toContain("이미 있다");
  });

  it("force는 판정을 건너뛴다(사람이 이유를 안다)", () => {
    const d = determinePubgRun({ nowMs: at("2026-11-01"), outputsExist: true, force: true });
    expect(d.shouldRun).toBe(true);
  });

  it("달력이 낡으면 알람을 켠다 — 초록불 침묵을 막는다", () => {
    const fresh = determinePubgRun({ nowMs: at("2026-09-17"), outputsExist: true });
    expect(fresh.staleCalendar).toBe(false);
    // 마지막 패치로부터 70일 넘게 새 패치가 없다 = 상수를 갱신하지 않았다는 뜻이다.
    const stale = determinePubgRun({ nowMs: at("2026-12-01"), outputsExist: true });
    expect(stale.staleCalendar).toBe(true);
  });

  it("수집 가능 구간은 사흘이다(보존창 계산의 결과)", () => {
    expect(HARVEST_LATEST_DAY - HARVEST_EARLIEST_DAY).toBe(2);
    expect(PUBG_PATCH_WINDOWS.length).toBeGreaterThanOrEqual(2);
  });
});
