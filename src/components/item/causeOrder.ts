// src/components/item/causeOrder.ts
// 상세 "추정 원인(LLM)" 표시 순서(2026-09-18 라운드6, 사용자 L5 "추정원인의 신뢰도낮음은 최하단으로").
// 순수 함수 — 파이프라인 산출(`DeltaRecord.causes`)은 LLM 응답 순서 그대로라 low가 앞에 오고
// medium이 뒤에 있는 행이 실재한다(home/logic.ts `representativeCause` 주석). 화면은 읽는 사람이
// 믿을 만한 것부터 보게 다시 세운다: 검증 high → medium → low → 미검증. 같은 등급 안에서는 원래
// 순서(안정 정렬). 데이터는 건드리지 않는다.
import type { LlmCause } from "@/pipeline/types";

const CONFIDENCE_RANK: Record<LlmCause["confidence"], number> = { high: 0, medium: 1, low: 2 };

function rank(cause: LlmCause): number {
  // 미검증(인용 노트가 실재하지 않음)은 신뢰도와 무관하게 맨 뒤 — "무근거 문장은 회색" 원칙의 순서판.
  if (!cause.verified) return 3;
  return CONFIDENCE_RANK[cause.confidence];
}

export function sortCauses(causes: readonly LlmCause[]): LlmCause[] {
  return [...causes].sort((a, b) => rank(a) - rank(b));
}
