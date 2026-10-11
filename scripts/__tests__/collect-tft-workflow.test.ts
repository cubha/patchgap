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

// 2026-10-11 실측(10회 실행): 크롤러가 캘린더 전 창을 돌아 18.1·18.2까지 채웠고, 부분 수집 stub은 `awaiting-observation`이라 예정이 지난
// 뒤 화면이 날짜·진척 없이 남았다. 워크플로가 이번 쌍만 넘기고, 부분 수집이면 `collecting` + 진행으로 stub을 쓴다.
describe("collect-tft.yml — 이번 쌍만 수집하고 부분 수집은 진행을 남긴다", () => {
  it("수집 스텝은 --patches로 이번 쌍(from,to)만 넘긴다", () => {
    const collect = step("Collect matches (F1)");
    expect(collect).toMatch(/--patches "\$PATCH_FROM,\$PATCH_TO"/);
    expect(collect).toContain("PATCH_FROM: ${{ steps.determine.outputs.from }}");
    expect(collect).toContain("PATCH_TO: ${{ steps.determine.outputs.to }}");
  });
  it("부분 수집이면 stub 사유가 collecting이고 진행(steps.collect.outputs.progress)을 넘긴다", () => {
    const stub = step("Observation stub (선언 축만)");
    expect(stub).toContain("steps.collect.outputs.partial == 'true' && 'collecting'");
    expect(stub).toContain("steps.collect.outputs.progress");
    expect(stub).toMatch(/--progress "\$STUB_PROGRESS"/);
    // 출력을 내는 스텝 id가 `collect`여야 `steps.collect.outputs.*`가 비지 않는다.
    expect(step("Collect matches (F1)")).toMatch(/^\s+id: collect$/m);
  });
});
