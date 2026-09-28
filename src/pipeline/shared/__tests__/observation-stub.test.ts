// src/pipeline/shared/__tests__/observation-stub.test.ts — C14 관측 stub(2026-09-28, D5).
import { describe, expect, it } from "vitest";
import { buildObservationStub, deltasStateOf, isObservationStub, observationReasonLabel } from "../observation-stub";

const failure = { reason: "key-expired" as const, detail: "401", at: "2026-10-07T21:00:00Z" };

describe("관측 stub", () => {
  it("rows는 비어 있고 meta에 쌍·사유를 담는다", () => {
    const stub = buildObservationStub("tft", "18.3", "18.4", failure, 12);
    expect(stub.rows).toEqual([]);
    expect(stub.meta).toMatchObject({ game: "tft", from: "18.3", to: "18.4", noteCount: 12, observationFailed: failure });
    expect(isObservationStub(stub.meta)).toBe(true);
  });
  it("판정 파일 상태: 없음·stub·관측(쌍이 다르면 없음)", () => {
    expect(deltasStateOf(null, "18.3", "18.4")).toEqual({ kind: "none" });
    expect(deltasStateOf(buildObservationStub("tft", "18.3", "18.4", failure, 1), "18.3", "18.4")).toEqual({ kind: "stub" });
    expect(deltasStateOf({ meta: { from: "18.3", to: "18.4" }, rows: [] }, "18.3", "18.4")).toEqual({ kind: "observed" });
    expect(deltasStateOf({ meta: { from: "43.0", to: "43.1" }, rows: [] }, "43.1", "43.2")).toEqual({ kind: "none" });
  });
  it("사유마다 사람이 읽는 문구가 있다 — 조치 필요 여부까지", () => {
    expect(observationReasonLabel("awaiting-observation")).toMatch(/대기/);
    expect(observationReasonLabel("key-expired")).toMatch(/키/);
    expect(observationReasonLabel("crashed")).toMatch(/실패/);
  });
});
