// src/pipeline/match/cause-factuality.ts — C3 원인 문장 사실성 결정론 검사(2026-09-28).
export interface ArrowSource {
  before: string | null;
  after: string | null;
  summary: string;
}
export function arrowClaimsGrounded(_text: string, _sources: readonly ArrowSource[], _ownNumbers: readonly number[]): boolean {
  throw new Error("TODO(C3): arrowClaimsGrounded");
}
export function signedPercentClaimsGrounded(_text: string, _allowed: readonly number[]): boolean {
  throw new Error("TODO(C3): signedPercentClaimsGrounded");
}
export function totalDropAttributionGrounded(_text: string, _citedShare: number | null): boolean {
  throw new Error("TODO(C3): totalDropAttributionGrounded");
}
