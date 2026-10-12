// src/pipeline/shared/boundary.ts
// **경계 판정** — 점추정은 효과크기 바닥을 넘었지만 95% CI의 안쪽 끝(0에 가까운 끝)은 바닥 아래인 관측(트랙 B ST-25, 2026-10-11
// site-review pubg-S13 · §8 동등성으로 세 게임).
//
// 판정(상태)은 바꾸지 않는다 — 바닥 게이트는 점추정 기준이고(`meetsEffectFloor`·PUBG `classify`), 그 규칙은 방법론이 말한다. 화면은
// 같은 「미공지」라도 확신도가 다르다는 사실만 「경계」 보조 표기로 구별한다(리뷰 실측: Crossbow CI [−19.9%, −6.0%] vs 바닥 13.2%가
// Beryl CI [+14.0%, +17.5%]와 같은 무게로 보였다). 순수 함수 — 산출물 재생성 없이 표시 계층이 부른다.
import { meetsEffectFloor } from "../aggregate/stats";
import { conservativeEffect } from "../match/pubg-delta";
import type { DeltaMetric } from "../types";

/** LoL·TFT 행 — 지표별 바닥(`EFFECT_SIZE_FLOORS`)을 CI의 0에 가까운 끝에 다시 건다. */
export function isBoundaryRecord(r: {
  metric: DeltaMetric;
  delta: number | null;
  before: number | null;
  ci: readonly [number, number] | null;
}): boolean {
  if (!r.ci || r.delta === null) return false;
  if (!meetsEffectFloor(r.metric, r.delta, r.before)) return false; // 바닥 미달은 표에 오르지 않는다 — 경계가 아니다
  const [lo, hi] = r.ci;
  const inner = lo > 0 ? lo : hi < 0 ? hi : 0;
  return !meetsEffectFloor(r.metric, inner, r.before);
}

/** PUBG 행 — 상대 변화 CI의 보수적 끝(`conservativeEffect`, 정렬 키와 같은 값)이 쌍의 바닥 아래. */
export function isBoundaryPubgRow(row: { relCi: readonly [number, number] }, effectFloor: number): boolean {
  return conservativeEffect(row.relCi) < effectFloor;
}
