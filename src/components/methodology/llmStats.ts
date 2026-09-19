// src/components/methodology/llmStats.ts
// 방법론 "추정 원인" 카드가 말하는 수치를 **빌드 타임에 델타 파일에서 산출**한다(2026-09-19).
//
// 왜 순수 함수로 빼는가: 처음엔 그 수치를 화면에 리터럴로 적었는데, 같은 라운드의 마지막 단계
// (프롬프트 v4 재생성)가 데이터를 바꾸자 페이지가 **옛 값을 계속 말했다**(독립 채점 K2-7 지적:
// "보통 33·높음 3"이 v4 이전 커밋 값과 정확히 일치). 화면이 거짓을 말하지 않게 하려면 수치는
// 데이터에서 나와야 한다 — 이 프로젝트가 반복해서 배운 것과 같은 교훈이다.
import type { DeltaRecord } from "@/pipeline/types";

export interface LlmCauseStats {
  /** LLM 2단을 실제로 시도한 행 수(llm 필드가 있는 행). */
  attempted: number;
  /** 그중 원인을 하나도 못 찾은 행 수. */
  withoutCause: number;
  /** 검증을 통과한 원인을 하나 이상 가진 행 수. */
  withVerifiedCause: number;
  /**
   * 원인 후보는 냈으나 **전부 검증에서 기각된** 행 수(2026-09-19 최종 채점 K2-7).
   * 이 통이 없던 탓에 화면이 "110건 중 28 + 81"이라 말해 셈이 1 모자랐다 — 그 1건은
   * `champion:Syndra:TOP:pickRate`였다. 세 통의 합은 항상 `attempted`와 같다.
   */
  withUnverifiedCauseOnly: number;
  /** 검증 통과 원인의 신뢰도 분포. */
  confidence: { high: number; medium: number; low: number };
}

export function computeLlmCauseStats(rows: readonly DeltaRecord[]): LlmCauseStats {
  const stats: LlmCauseStats = {
    attempted: 0,
    withoutCause: 0,
    withVerifiedCause: 0,
    withUnverifiedCauseOnly: 0,
    confidence: { high: 0, medium: 0, low: 0 },
  };
  for (const row of rows) {
    if (!row.llm) continue;
    stats.attempted += 1;
    const verified = row.causes.filter((cause) => cause.verified);
    // 세 통은 서로 배타적이고 합이 attempted와 같다 — 화면이 셈을 닫을 수 있어야 한다.
    if (row.causes.length === 0) stats.withoutCause += 1;
    else if (verified.length > 0) stats.withVerifiedCause += 1;
    else stats.withUnverifiedCauseOnly += 1;
    for (const cause of verified) stats.confidence[cause.confidence] += 1;
  }
  return stats;
}

/**
 * 신뢰도 분포에서 **가장 많은 등급**을 고른다(2026-09-19 v5). 화면이 "낮음이 대부분"이라고 리터럴로
 * 단언하고 있었는데, 그 문장은 프롬프트나 모델이 바뀌면 조용히 거짓이 된다 — 같은 라운드의
 * 재생성에 화면이 뒤처졌던 K2-7과 정확히 같은 형태다. 동률이면 보수적으로 낮은 쪽을 고른다.
 * 검증 통과 원인이 하나도 없으면 null(할 말이 없다).
 */
export function dominantConfidence(stats: LlmCauseStats): { label: string; count: number } | null {
  const order: ReadonlyArray<readonly [keyof LlmCauseStats["confidence"], string]> = [
    ["low", "낮음"],
    ["medium", "보통"],
    ["high", "높음"],
  ];
  let best: { label: string; count: number } | null = null;
  for (const [key, label] of order) {
    const count = stats.confidence[key];
    if (count === 0) continue;
    if (best === null || count > best.count) best = { label, count };
  }
  return best;
}
