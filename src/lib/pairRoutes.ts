// src/lib/pairRoutes.ts
// LoL 패치쌍 라우트 규칙(2026-09-28, PR-C B3 · 사용자 결정 D3). 순수 함수 — 헤더(클라이언트)와 라우트
// (`app/lol/history/[pair]/page.tsx`)가 같이 쓴다. 경로 규칙은 화면이 아니라 lib의 것이다(tftRoutes와 같은 이유).
//
// 최신 쌍은 따로 라우트를 두지 않고 **브리핑 홈**(`/lol/`)이다 — 같은 화면이 두 주소를 갖지 않게.
// 과거 쌍만 `/lol/history/{from}-{to}/`. 정적 export라 쌍마다 빌드 타임에 한 장씩 만든다.
export interface PairLike {
  from: string;
  to: string;
}

const PATCH = /^\d{2}\.\d{1,2}$/;

export function lolPairSlug(pair: PairLike): string {
  return `${pair.from}-${pair.to}`;
}

/** 목록의 첫 쌍(최신)은 브리핑 홈, 나머지는 과거 쌍 라우트. */
export function lolPairHref(pair: PairLike, pairs: readonly PairLike[]): string {
  const latest = pairs[0];
  if (latest && latest.from === pair.from && latest.to === pair.to) return "/lol/";
  return `/lol/history/${lolPairSlug(pair)}/`;
}

/** 슬러그 → 실재하는 쌍. 형식이 틀리거나 목록에 없으면 null(지어내지 않는다). */
export function lolPairFromSlug(slug: string, pairs: readonly PairLike[]): PairLike | null {
  const [from, to, ...rest] = slug.split("-");
  if (rest.length > 0 || !from || !to || !PATCH.test(from) || !PATCH.test(to)) return null;
  return pairs.find((p) => p.from === from && p.to === to) ?? null;
}

/** 지금 경로가 과거 쌍 라우트면 그 쌍, 아니면 null(= 기본 쌍을 보는 중). */
export function pairFromPathname(pathname: string, pairs: readonly PairLike[]): PairLike | null {
  const m = /^\/lol\/history\/([^/]+)\/?$/.exec(pathname);
  return m ? lolPairFromSlug(decodeURIComponent(m[1]), pairs) : null;
}
