// src/components/pubg/mapRotation.ts
// PUBG 맵 상세 기술통계 모드의 원인 칸 문장(2026-10-06 상세 공통 관측 섹션, PLAN D5).
//
// 맵 점유율은 패치 내용과 별개로 **맵 풀 교체**가 함께 움직인다 — 한 구간에만 열린 맵이 있으면 나머지 맵의 몫이
// 그만큼 바뀐다. 그래서 맵에는 판정을 붙이지 않고, 원인 칸은 이 사실만 말한다. 문장은 산출물(`map-deltas.json`의
// `onlyBefore`/`onlyAfter`)에서 만든다 — 손으로 적으면 다음 패치에서 조용히 틀린 맵 이름을 말한다.
import { mapIdentity } from "@/pipeline/aggregate/pubg-maps";

export interface MapPoolDiff {
  from: string;
  to: string;
  onlyBefore: readonly string[];
  onlyAfter: readonly string[];
}

const names = (keys: readonly string[]): string => keys.map((key) => mapIdentity(key).koName).join("·");

export function mapRotationSentence({ from, to, onlyBefore, onlyAfter }: MapPoolDiff): string {
  const parts: string[] = [];
  if (onlyBefore.length > 0) parts.push(`${from}에만 ${names(onlyBefore)}`);
  if (onlyAfter.length > 0) parts.push(`${to}에만 ${names(onlyAfter)}`);
  if (parts.length === 0) return "두 패치의 맵 풀은 같습니다.";
  return `맵 풀 로테이션(${parts.join(", ")})이 점유율을 함께 움직입니다.`;
}
