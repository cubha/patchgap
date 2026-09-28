// src/pipeline/collect/__tests__/tft-run-plan.test.ts
// C13·C14(2026-09-28, 사용자 결정 D5·D6) — 선언 축(패치노트·F9)과 관측 축(매치 수집·판정)을 가른다.
//  - 선언: 새 패치를 **탐지 즉시**. 키가 없어도 돈다(노트·CDragon은 공개 자원) → 관측 stub 판정 파일.
//  - 관측: 세트 중간 3일차 · 세트 개시 9일차부터(F11 실측). **기록된 관측 시점**(observedUntil)이 N일차
//    이전이면 한 번 더 모은다 — 「오늘이 N일차인가」로 보면 cron이 늦게 도는 날 영영 놓친다.
//  - 키가 죽어 관측을 못 하면: 실제 관측 산출물은 **절대 stub으로 덮지 않는다**.
import { describe, expect, it } from "vitest";
import {
  planTftRun,
  applyTftKeyFailure,
  observationDayOf,
  TFT_OBSERVATION_DAY_MID_SET,
  TFT_OBSERVATION_DAY_SET_LAUNCH,
  type DeltasState,
} from "../tft-patch-calendar";
import type { TftPatchWindow } from "../tft-crawler";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-09-22T18:00:00Z");
const W: TftPatchWindow[] = [
  { patch: "18.2", startMs: Date.parse("2026-09-09T18:00:00Z"), endMs: START },
  { patch: "18.3", startMs: START, endMs: null },
];
const at = (days: number) => START + days * DAY;
const none: DeltasState = { kind: "none" };
const stub: DeltasState = { kind: "stub" };
const observed = (untilMs: number | null): DeltasState => ({ kind: "observed", observedUntilMs: untilMs });
const plan = (days: number, deltas: DeltasState, notesExist = deltas.kind !== "none", extra = {}) =>
  planTftRun({ nowMs: at(days), notesExist, deltas, ...extra }, W);

describe("관측 개시일 N", () => {
  it("세트 중간 3일 · 세트 개시(X.1) 9일", () => {
    expect(TFT_OBSERVATION_DAY_MID_SET).toBe(3);
    expect(TFT_OBSERVATION_DAY_SET_LAUNCH).toBe(9);
    expect(observationDayOf("18.3")).toBe(3);
    expect(observationDayOf("19.1")).toBe(9);
  });
});

describe("planTftRun — 선언 축은 즉시, 관측 축은 N일차", () => {
  it("0일차, 아무것도 없음 → 선언(노트 + stub)", () => {
    expect(plan(0.05, none).mode).toBe("declaration");
  });
  it("0일차 다시, stub·노트 있음 → 건너뜀(매일 다시 쓰지 않는다)", () => {
    expect(plan(0.9, stub).mode).toBe("skip");
  });
  it("stub은 있는데 노트가 없음 → 선언 다시", () => {
    expect(plan(1, stub, false).mode).toBe("declaration");
  });
  it("N−1일차 → 건너뜀", () => {
    expect(plan(2.5, stub).mode).toBe("skip");
  });
  it("N일차 → 관측", () => {
    expect(plan(3.05, stub).mode).toBe("observation");
  });
  it("cron이 N일차를 놓쳐도 그 뒤 아무 날이나 관측한다", () => {
    expect(plan(5.2, stub).mode).toBe("observation");
    expect(plan(5.2, none).mode).toBe("observation");
  });
  it("관측 시점이 N일차 이후로 기록되면 그 뒤로는 건너뜀", () => {
    expect(plan(6, observed(at(3.1))).mode).toBe("skip");
  });
  it("관측 시점이 N일차 이전이면(초반 수집) 한 번 더 관측한다", () => {
    expect(plan(6, observed(at(1.4))).mode).toBe("observation");
  });
  it("관측 시점을 모르는 옛 산출물(18.3 오늘)은 한 번 관측한다", () => {
    expect(plan(6, observed(null)).mode).toBe("observation");
  });
  it("N일차 전에는 옛 산출물이 있어도 건너뜀", () => {
    expect(plan(2, observed(null)).mode).toBe("skip");
  });
  it("force·수동 지정은 관측", () => {
    expect(plan(0.5, observed(at(0.2)), true, { force: true }).mode).toBe("observation");
    expect(plan(0.5, none, false, { manualPatch: "18.3" }).mode).toBe("observation");
  });
  it("캘린더 밖이면 건너뜀(실패 아님)", () => {
    expect(planTftRun({ nowMs: START - 30 * DAY, notesExist: false, deltas: none }, W).mode).toBe("skip");
  });
});

describe("applyTftKeyFailure — 키가 죽었을 때의 강등", () => {
  it("실제 관측 산출물이 있으면 건너뜀 — stub으로 덮지 않는다", () => {
    expect(applyTftKeyFailure(plan(6, observed(null)), observed(null), true).mode).toBe("skip");
  });
  it("아무것도 없으면 선언(stub)으로 강등", () => {
    expect(applyTftKeyFailure(plan(4, none), none, false).mode).toBe("declaration");
  });
  it("stub·노트가 이미 있으면 건너뜀", () => {
    expect(applyTftKeyFailure(plan(4, stub), stub, true).mode).toBe("skip");
  });
  it("관측이 아닌 계획은 그대로", () => {
    const p = plan(0.1, none);
    expect(applyTftKeyFailure(p, none, false)).toBe(p);
  });
});
