// src/components/item/__tests__/llmCaption.test.ts
// 상세 "추정 원인" 캡션(ST6, 2026-09-18 채점 라운드5 D4) — TDD RED 먼저.
// 사용자 결정: "분석 LLM 모델을 사용자가 알아야 할 이유가 있나" → 없다. 캡션은 이 문장이 LLM
// 검토 결과라는 사실과 기준 시각만 말한다. 어떤 모델인지는 방법론 화면이 말한다.
// 실측: 상세 1,737페이지 중 226에 "모델 claude-opus-5 · 캐시 …"가 노출돼 채점표 D4 문구
// ("모델명 노출 없음")와 충돌했다(BRAINTRUST-residual3 §5).
import { describe, expect, it } from "vitest";
import { llmCaption } from "../CausesPanel";

describe("llmCaption", () => {
  const caption = llmCaption("2026-09-18T01:11:00.000Z");

  it("LLM 검토 사실과 KST 기준 시각을 말한다", () => {
    expect(caption).toContain("LLM 검토");
    expect(caption).toContain("2026-09-18 10:11 KST");
    expect(caption).toContain("기준");
  });

  it("raw 모델 id(claude-*)와 개발 어휘('캐시')를 노출하지 않는다", () => {
    expect(caption).not.toMatch(/claude-/);
    expect(caption).not.toContain("캐시");
    expect(caption).not.toContain("모델");
  });
});
