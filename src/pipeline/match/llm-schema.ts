// src/pipeline/match/llm-schema.ts
// LLM 2단 응답 계약 — 출력 스키마와 사용량 형태(2026-10-06 `llm-match.ts` 분할). 엔진·캐시·검증·문장 규칙이 함께 쓴다.
import { z } from "zod";

export const OutputSchema = z.object({
  causes: z.array(
    z.object({
      candidateNoteId: z.string().nullable(),
      text: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
  summary: z.string(),
  /** B4 후속 수정(S3 인용 강제) — summary가 근거로 인용한 후보 노트 id 목록. 델타 수치만 근거로
   * 썼으면(자기 델타 외 인용 없음) 빈 배열. verifySummaryCites가 구조적으로 검증한다. */
  summaryCites: z.array(z.string()),
});

export type LlmOutput = z.infer<typeof OutputSchema>;

export interface LlmUsageTotals {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
}
