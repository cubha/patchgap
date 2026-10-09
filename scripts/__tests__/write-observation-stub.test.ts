// scripts/__tests__/write-observation-stub.test.ts — C14 stub 쓰기(2026-09-28).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeObservationStub } from "../write-observation-stub";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "stub-"));
  fs.mkdirSync(path.join(root, "aggregated", "tft"), { recursive: true });
  fs.mkdirSync(path.join(root, "aggregated", "pubg"), { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const put = (rel: string, v: unknown) => fs.writeFileSync(path.join(root, "aggregated", rel), JSON.stringify(v));
const get = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, "aggregated", rel), "utf8"));

describe("writeObservationStub", () => {
  it("노트가 있으면 stub을 쓴다", () => {
    put("tft/notes-18.4.json", { items: [1, 2, 3] });
    expect(writeObservationStub("tft", root, "18.3", "18.4", "awaiting-observation", "")).toBe(true);
    expect(get("tft/deltas-18.3-18.4.json").meta).toMatchObject({ noteCount: 3, observationFailed: { reason: "awaiting-observation" } });
  });
  it("같은 쌍의 실제 관측은 덮지 않는다", () => {
    put("tft/notes-18.4.json", { items: [] });
    put("tft/deltas-18.3-18.4.json", { meta: { from: "18.3", to: "18.4" }, rows: [{ id: "x" }] });
    expect(writeObservationStub("tft", root, "18.3", "18.4", "crashed", "")).toBe(false);
    expect(get("tft/deltas-18.3-18.4.json").rows).toHaveLength(1);
  });
  it("PUBG는 이전 쌍의 관측 deltas.json을 **보존**하고 새 쌍 stub을 declaration.json에 쓴다", () => {
    // 2026-10-09(PLAN-home-observed-pair ST-9): 전에는 한 파일(deltas.json)을 stub으로 바꿔 홈이 관측을 잃고 선언 뷰로
    // 떨어졌다 — TFT 18.4에서 사용자가 지적한 결함이 PUBG 43.2에서 그대로 재현될 자리였다.
    put("pubg/notes-43.2.json", { items: [1] });
    put("pubg/deltas.json", { meta: { from: "42.3", to: "43.1" }, rows: [{ id: "x" }] });
    expect(writeObservationStub("pubg", root, "43.1", "43.2", "awaiting-observation", "")).toBe(true);
    expect(get("pubg/deltas.json").meta).toMatchObject({ from: "42.3", to: "43.1" });
    expect(get("pubg/deltas.json").rows).toHaveLength(1);
    expect(get("pubg/declaration.json").meta).toMatchObject({ from: "43.1", to: "43.2", noteCount: 1, observationFailed: { reason: "awaiting-observation" } });
  });
  it("PUBG도 같은 쌍의 실제 관측(deltas.json)이 있으면 stub을 쓰지 않는다", () => {
    put("pubg/notes-43.2.json", { items: [1] });
    put("pubg/deltas.json", { meta: { from: "43.1", to: "43.2" }, rows: [{ id: "x" }] });
    expect(writeObservationStub("pubg", root, "43.1", "43.2", "crashed", "")).toBe(false);
    expect(fs.existsSync(path.join(root, "aggregated", "pubg", "declaration.json"))).toBe(false);
  });
  it("노트가 없으면 던진다 — 선언 축 없는 stub은 결함이다", () => {
    expect(() => writeObservationStub("tft", root, "18.3", "18.4", "crashed", "")).toThrow(/선언 축/);
  });
});
