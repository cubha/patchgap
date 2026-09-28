// scripts/__tests__/collect-tft-workflow.test.ts
// R3 실측(2026-09-28, run 36424128722): 첫 실제 수집이 잡 제한 120분에 취소됐고, `actions/cache`의 저장이 잡 끝
// post 스텝이라 돌지 않아 모은 매치가 전부 사라졌다. 그 재발을 막는 워크플로 구조를 고정한다.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const yml = fs.readFileSync(".github/workflows/collect-tft.yml", "utf8");
const step = (name: string): string => {
  const i = yml.indexOf(`- name: ${name}`);
  if (i < 0) throw new Error(`스텝 없음: ${name}`);
  const next = yml.indexOf("\n      - name:", i + 1);
  return yml.slice(i, next < 0 ? undefined : next);
};

describe("collect-tft.yml — 수집 마감과 부분 수집 보존(R3)", () => {
  it("수집 마감(분)이 잡 제한보다 짧다", () => {
    const timeout = Number(/timeout-minutes:\s*(\d+)/.exec(yml)?.[1]);
    const deadline = Number(/--deadline-minutes\s+(\d+)/.exec(step("Collect matches (F1)"))?.[1]);
    expect(deadline).toBeGreaterThan(0);
    expect(deadline).toBeLessThan(timeout);
  });
  it("raw 캐시는 복원(cache/restore)과 저장(cache/save, always())이 따로다 — post 스텝에 기대지 않는다", () => {
    expect(step("Restore data/raw/tft")).toContain("actions/cache/restore@");
    const save = step("Save data/raw/tft");
    expect(save).toContain("actions/cache/save@");
    expect(save).toMatch(/if:\s*always\(\)/);
    expect(yml.indexOf("- name: Save data/raw/tft")).toBeGreaterThan(yml.indexOf("- name: Collect matches (F1)"));
  });
  it("부분 수집이면 관측 스텝(집계·판정·브리핑)은 돌지 않고, 선언 stub은 돈다", () => {
    for (const name of ["Aggregate boards (F2)", "Sample size alert", "Match + verdict (F4)", "Discord briefing (TFT 채널)"]) {
      expect(step(name), name).toContain("steps.collect.outputs.partial != 'true'");
    }
    expect(step("Observation stub (선언 축만)")).toContain("steps.collect.outputs.partial == 'true'");
  });
});
