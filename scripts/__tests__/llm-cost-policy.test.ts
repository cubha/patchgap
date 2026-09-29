// LLM 비용 정책의 배선 가드(2026-09-29). 엔진 게이트(llm-match.test.ts)는 로컬 기본을 캐시 전용으로 만들고,
// 여기서는 그 반대편 — CI가 명시 opt-in으로 부르고, 산 답을 잃지 않고, 끈 실행이 산 답을 덮지 않는지 — 를 본다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertNoLlmDowngrade, llmResultCount } from "../shared/llm-guard";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("CI 워크플로 — LLM 호출 opt-in · 즉시 저장 · 커밋", () => {
  for (const wf of ["collect", "collect-tft", "collect-pubg"]) {
    const src = read(`.github/workflows/${wf}.yml`);
    it(`${wf}: LLM 스텝이 PATCHGAP_LLM=1로 명시 opt-in한다`, () => {
      expect(src).toContain('PATCHGAP_LLM: "1"');
    });
    it(`${wf}: LLM 캐시를 always()로 즉시 저장한다(잡 실패에도 산 답을 잃지 않는다)`, () => {
      const save = src.slice(src.indexOf("- name: Save data/cache/llm"));
      expect(save).toMatch(/if: always\(\) &&/);
      expect(save).toContain("actions/cache/save@v4");
    });
    it(`${wf}: 커밋 스텝이 data/cache/llm을 올린다(로컬과 공유 · 7일 휘발 방지)`, () => {
      expect(src).toMatch(/git add [^\n]*data\/cache\/llm/);
    });
  }
  it(".gitignore가 data/cache/llm만 추적 대상으로 연다", () => {
    const gi = read(".gitignore");
    expect(gi).toContain("/data/cache/*");
    expect(gi).toContain("!/data/cache/llm/");
  });
});

describe("쓰기 게이트 — LLM을 끈 실행이 산 답을 덮지 않는다", () => {
  const withFile = (rows: unknown[], fn: (file: string) => void) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-guard-"));
    const file = path.join(dir, "deltas.json");
    fs.writeFileSync(file, JSON.stringify({ rows }));
    try {
      fn(file);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
  it("skipped가 아닌 llm만 센다", () => {
    expect(llmResultCount([{ llm: { skipped: false } }, { llm: { skipped: true } }, {}])).toBe(1);
  });
  it("기존 LLM 결과가 줄어드는 쓰기는 거부한다", () => {
    withFile([{ llm: { skipped: false } }, { llm: { skipped: false } }], (file) => {
      expect(() => assertNoLlmDowngrade(file, [{}, {}], "t")).toThrow(/2행이 0행으로/);
    });
  });
  it("같거나 늘면 통과, 파일이 없으면 통과", () => {
    withFile([{ llm: { skipped: false } }], (file) => {
      expect(() => assertNoLlmDowngrade(file, [{ llm: { skipped: false } }], "t")).not.toThrow();
    });
    expect(() => assertNoLlmDowngrade("/nonexistent/x.json", [], "t")).not.toThrow();
  });
});
