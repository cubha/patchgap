// src/lib/pairRoutes.ts — B3 구현 전 시그니처.
export interface PairLike {
  from: string;
  to: string;
}
export function lolPairSlug(_pair: PairLike): string {
  throw new Error("TODO(B3): lolPairSlug");
}
export function lolPairHref(_pair: PairLike, _pairs: readonly PairLike[]): string {
  throw new Error("TODO(B3): lolPairHref");
}
export function lolPairFromSlug(_slug: string, _pairs: readonly PairLike[]): PairLike | null {
  throw new Error("TODO(B3): lolPairFromSlug");
}
export function pairFromPathname(_pathname: string, _pairs: readonly PairLike[]): PairLike | null {
  throw new Error("TODO(B3): pairFromPathname");
}
