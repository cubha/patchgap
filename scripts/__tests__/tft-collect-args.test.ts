// scripts/__tests__/tft-collect-args.test.ts
// R3 실측(2026-09-28): Actions 잡 제한(120분)에 걸려 수집이 취소되고 모은 매치가 사라졌다. 워크플로가
// `--deadline-minutes`로 수집 시간을 잡 제한보다 짧게 준다 — 인자 해석을 고정한다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs, writeCollectOutputs } from "../run-tft-collect";
import { parseObservationProgress } from "../../src/pipeline/shared/observation-stub";

describe("run-tft-collect --deadline-minutes", () => {
  it("분 단위 양의 정수를 받는다", () => {
    expect(parseArgs(["--deadline-minutes", "75"]).deadlineMinutes).toBe(75);
  });
  it("없으면 마감 없음(undefined) — 로컬 수집은 끝까지 돈다", () => {
    expect(parseArgs([]).deadlineMinutes).toBeUndefined();
  });
  it("0 이하·소수는 던진다", () => {
    expect(() => parseArgs(["--deadline-minutes", "0"])).toThrow(/deadline-minutes/);
    expect(() => parseArgs(["--deadline-minutes", "1.5"])).toThrow(/deadline-minutes/);
  });
});

// 2026-10-11: 워크플로가 이번 쌍(from,to)만 넘겨 18.1·18.2 같은 지난 창을 돌지 않게 한다.
describe("run-tft-collect --patches", () => {
  it("쉼표로 구분한 패치 목록을 받는다", () => {
    expect(parseArgs(["--patches", "18.3,18.4"]).patches).toEqual(["18.3", "18.4"]);
  });
  it("없으면 undefined — 전 창", () => {
    expect(parseArgs([]).patches).toBeUndefined();
  });
  it("패치 형식이 아니면 던진다(경로·셸 주입 차단)", () => {
    expect(() => parseArgs(["--patches", "18.3,../x"])).toThrow(/patches/);
    expect(() => parseArgs(["--patches", ""])).toThrow(/patches/);
  });
});

// 수집 출력 → stub 경계(2026-10-11 acceptance V2): 워크플로가 읽는 키(`partial`·`progress`)와 stub이 받는 형식이 같아야 한다.
describe("writeCollectOutputs — GITHUB_OUTPUT", () => {
  it("partial과 progress를 쓰고, progress는 stub 파서가 그대로 받는다", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ghout-"));
    const out = path.join(dir, "out");
    writeCollectOutputs(out, { stoppedAtDeadline: true, storedByPatch: { "18.3": 2500, "18.4": 813 } }, 2500);
    const lines = Object.fromEntries(fs.readFileSync(out, "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    expect(lines.partial).toBe("true");
    expect(parseObservationProgress(lines.progress)).toEqual([
      { patch: "18.3", stored: 2500, target: 2500 },
      { patch: "18.4", stored: 813, target: 2500 },
    ]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
