// src/pipeline/collect/pubg/__tests__/pubg-run-plan.test.ts
// C13·C14(2026-09-28, D5·D6) PUBG판 — PUBG도 비교 구간이 닫힐 때까지(패치+7일) 실행 **전체**가 스킵돼
// 수기로 넣은 노트가 일주일간 화면에 안 나왔다. 선언 축(노트 → stub deltas.json)은 노트가 들어오는 즉시,
// 관측(텔레메트리 수집·집계)은 기존 수확 창 규칙 그대로. stub은 "산출물 없음"과 같다 — 안 그러면
// 쌍이 같은 stub이 수확을 영원히 막는다.
import { describe, expect, it } from "vitest";
import { planPubgRun, type PubgDeltasState } from "../patch-calendar";
import type { PubgPatchWindow } from "../patch-calendar";

const W: PubgPatchWindow[] = [
  { patch: "43.1", telemetryPatch: "pc-2018-43", liveFrom: "2026-09-09" },
  { patch: "43.2", telemetryPatch: "pc-2018-43", liveFrom: "2026-10-08" },
];
const day = (n: number) => Date.parse("2026-10-08T00:00:00Z") + n * 86_400_000 + 3_600_000;
const none: PubgDeltasState = { kind: "none" };
const stub: PubgDeltasState = { kind: "stub" };
const observed: PubgDeltasState = { kind: "observed" };

describe("planPubgRun", () => {
  it("노트가 들어온 날 → 선언(stub)", () => {
    expect(planPubgRun({ nowMs: day(1), notesExist: true, deltas: none }, W).mode).toBe("declaration");
  });
  it("노트가 없으면 수확 전엔 할 일이 없다", () => {
    expect(planPubgRun({ nowMs: day(1), notesExist: false, deltas: none }, W).mode).toBe("skip");
  });
  it("stub이 있으면 수확 전엔 건너뜀", () => {
    expect(planPubgRun({ nowMs: day(3), notesExist: true, deltas: stub }, W).mode).toBe("skip");
  });
  it("수확 창에선 stub이 있어도 관측한다 — stub은 산출물이 아니다", () => {
    expect(planPubgRun({ nowMs: day(7), notesExist: true, deltas: stub }, W).mode).toBe("observation");
  });
  it("수확 창에서 노트가 없어도 수집은 한다(보존창) — notesReady=false", () => {
    const p = planPubgRun({ nowMs: day(8), notesExist: false, deltas: none }, W);
    expect(p.mode).toBe("observation");
    expect(p.notesReady).toBe(false);
  });
  it("실제 관측 산출물이 있으면 건너뜀", () => {
    expect(planPubgRun({ nowMs: day(8), notesExist: true, deltas: observed }, W).mode).toBe("skip");
  });
  it("보존창을 넘겨 관측을 못 해도, 노트가 있고 산출물이 없으면 선언은 한다", () => {
    expect(planPubgRun({ nowMs: day(12), notesExist: true, deltas: none }, W).mode).toBe("declaration");
  });
  it("force는 관측", () => {
    expect(planPubgRun({ nowMs: day(1), notesExist: true, deltas: observed, force: true }, W).mode).toBe("observation");
  });
});
