// effort 캐시 키 의미론(2026-10-06 /analyze 🟡). 태그는 "기본값과 다를 때만" 붙었는데, 그 비교 대상이 **지금의**
// 기본값(LLM_EFFORT)이라 기본값을 medium→high로 바꾸는 날 옛 medium 답(태그 없음)이 high 호출(역시 태그 없음)에
// 적중했다 — llm-config 주석이 막는다고 적은 바로 그 귀속 오류. 태그 없는 키는 **캐시를 만든 강도**에 고정돼야 한다.
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 기본값이 바뀐 미래를 흉내 낸다 — 나머지 설정은 실제 값 그대로.
vi.mock("../llm-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../llm-config")>()),
  LLM_EFFORT: "high",
}));

import { cacheKeyFor } from "../llm-match";

// 실제 커밋된 운영 캐시 1건(Opus 5.5, 9/30 이후 medium으로 생성). 파일명이 곧 키다.
const GOLDEN = "01023ceada3d84d4e7d65a0a3293e44b8bd6a49167a5c5fe2b90e6ceb357789f";

describe("cacheKeyFor — 태그 없는 키는 캐시를 만든 강도(medium)에 고정", () => {
  const file = path.join(process.cwd(), "data/cache/llm", `${GOLDEN}.json`);
  const c = JSON.parse(fs.readFileSync(file, "utf8")) as {
    model: string;
    promptVersion: string;
    deltaId: string;
    candidateSetHash: string;
  };

  it("기본값이 high로 바뀌어도 medium 키는 기존 파일명 그대로다(1,9xx건이 계속 적중)", () => {
    expect(cacheKeyFor(c.model, c.promptVersion, c.deltaId, c.candidateSetHash, "medium")).toBe(GOLDEN);
  });

  it("기본값이 high로 바뀌면 high 호출은 옛 medium 답을 재사용하지 않는다", () => {
    expect(cacheKeyFor(c.model, c.promptVersion, c.deltaId, c.candidateSetHash, "high")).not.toBe(GOLDEN);
  });
});
