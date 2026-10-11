// src/pipeline/shared/__tests__/observation-stub.test.ts — C14 관측 stub(2026-09-28, D5).
import { describe, expect, it } from "vitest";
import {
  buildObservationStub,
  deltasStateOf,
  isObservationStub,
  observationProgressText,
  observationReasonLabel,
  parseObservationProgress,
} from "../observation-stub";

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

// 2026-10-11 실측: 75분 마감 부분 수집 stub이 `awaiting-observation`이라 예정일이 지난 뒤 화면이 날짜도 진행도 없이 「표본이 쌓이면」만
// 말했다 — 수집 중인지 고장인지 사람이 가를 수 없었다. 부분 수집은 별도 사유 + 진행을 싣는다.
describe("부분 수집(collecting)", () => {
  it("사유 문구가 수집 중임을 말한다 — 대기·고장과 다른 문장", () => {
    expect(observationReasonLabel("collecting")).toMatch(/수집 중/);
    expect(observationReasonLabel("collecting")).not.toBe(observationReasonLabel("awaiting-observation"));
  });
  it("진행 문구는 목표에 못 미친 패치만 적재/목표로 말한다", () => {
    expect(
      observationProgressText([
        { patch: "18.3", stored: 2500, target: 2500 },
        { patch: "18.4", stored: 813, target: 2500 },
      ])
    ).toBe("18.4 813/2,500매치");
    expect(
      observationProgressText([
        { patch: "18.3", stored: 1849, target: 2500 },
        { patch: "18.4", stored: 390, target: 2500 },
      ])
    ).toBe("18.3 1,849/2,500 · 18.4 390/2,500매치");
  });
  it("진행이 없거나 전부 찼으면 null — 지어내지 않는다", () => {
    expect(observationProgressText(undefined)).toBeNull();
    expect(observationProgressText([{ patch: "18.4", stored: 2500, target: 2500 }])).toBeNull();
  });
  it("진행 JSON 파싱: 형식이 틀리면 던진다(워크플로 출력 → stub 경계)", () => {
    expect(parseObservationProgress('[{"patch":"18.4","stored":813,"target":2500}]')).toEqual([{ patch: "18.4", stored: 813, target: 2500 }]);
    expect(() => parseObservationProgress('[{"patch":"../x","stored":1,"target":2}]')).toThrow(/progress/);
    expect(() => parseObservationProgress('{"patch":"18.4"}')).toThrow(/progress/);
    expect(() => parseObservationProgress('[{"patch":"18.4","stored":-1,"target":2500}]')).toThrow(/progress/);
  });
});
