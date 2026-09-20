// src/components/item/__tests__/causeOrder.test.ts
// 상세 "추정 원인" 정렬(2026-09-18 라운드6, 사용자 L5 "추정원인의 신뢰도낮음은 최하단으로") — TDD RED.
// 파이프라인 산출 순서(`causes[]`)는 LLM 응답 순서라 low가 앞에 오고 medium이 뒤에 있는 행이 실재한다
// (home/logic.ts `representativeCause` 주석). 화면은 검증·신뢰도 순으로 다시 세운다:
// 검증 high → medium → low → 미검증. 같은 등급 안에서는 원래 순서(안정 정렬).
import { describe, expect, it } from "vitest";
import type { LlmCause } from "@/pipeline/types";
import { sortCauses } from "../causeOrder";

function cause(text: string, confidence: LlmCause["confidence"], verified = true): LlmCause {
  return { text, candidateNoteId: verified ? `note:${text}` : null, verified, confidence };
}

describe("sortCauses", () => {
  it("검증된 high → medium → low → 미검증 순", () => {
    const input = [
      cause("low-1", "low"),
      cause("unverified", "high", false),
      cause("medium-1", "medium"),
      cause("high-1", "high"),
    ];
    expect(sortCauses(input).map((c) => c.text)).toEqual(["high-1", "medium-1", "low-1", "unverified"]);
  });

  it("같은 등급 안에서는 원래 순서를 지킨다(안정 정렬)", () => {
    const input = [cause("low-a", "low"), cause("low-b", "low"), cause("medium-a", "medium"), cause("low-c", "low")];
    expect(sortCauses(input).map((c) => c.text)).toEqual(["medium-a", "low-a", "low-b", "low-c"]);
  });

  it("원본 배열을 변형하지 않는다", () => {
    const input = [cause("low", "low"), cause("high", "high")];
    const copy = [...input];
    sortCauses(input);
    expect(input).toEqual(copy);
  });

  it("빈 입력은 빈 배열", () => {
    expect(sortCauses([])).toEqual([]);
  });
});
