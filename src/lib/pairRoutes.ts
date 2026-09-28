// src/lib/pairRoutes.ts
// 패치쌍 라우트 규칙(2026-09-28, PR-C B3 · 사용자 결정 D3). 순수 함수 — 헤더(클라이언트)와 라우트
// (`app/{game}/history/[pair]/**`)가 같이 쓴다. 경로 규칙은 화면이 아니라 lib의 것이다(tftRoutes와 같은 이유).
//
// 최신 쌍은 따로 라우트를 두지 않고 **평소 주소**(`/lol/`·`/lol/compare/`)다 — 같은 화면이 두 주소를 갖지 않게.
// 과거 쌍만 `/{game}/history/{from}-{to}/`와 그 아래(`compare/`·상세). 정적 export라 쌍마다 빌드 타임에 만든다.
//
// **게임별로 일반화**(2026-09-28, 이월 R8): 처음엔 LoL 전용이었다(`/lol/history/…` 하드코딩). TFT도 쌍이 둘이 되면서
// 같은 규칙을 복사하면 두 벌이 갈라진다 — 게임을 인자로 받는다. `lol*` 이름은 기존 호출부·테스트용 얇은 별칭이다.
import { sectionHref, type GameId } from "@/lib/game";

export interface PairLike {
  from: string;
  to: string;
}

/** 과거 쌍 라우트가 **실재하는** 게임. PUBG는 쌍이 하나라 라우트가 없다(헤더 select가 닫히고 이유를 말한다). */
export const PAIR_ROUTE_GAMES = ["lol", "tft"] as const satisfies readonly GameId[];
export type PairRouteGame = (typeof PAIR_ROUTE_GAMES)[number];

export function hasPairRoutes(game: GameId): game is PairRouteGame {
  return (PAIR_ROUTE_GAMES as readonly GameId[]).includes(game);
}

/** 쌍 안에서 섹션으로 옮겨 갈 수 있는 곳 — 브리핑(`""`)과 대조표. 상세는 쌍마다 존재 여부가 달라 여기 없다. */
export type PairSection = "" | "compare";

const PATCH = /^\d{2}\.\d{1,2}$/;

export function pairSlug(pair: PairLike): string {
  return `${pair.from}-${pair.to}`;
}

function isSamePair(a: PairLike, b: PairLike): boolean {
  return a.from === b.from && a.to === b.to;
}

/**
 * 과거 쌍 라우트의 **기준 경로**(후행 슬래시 없음) — `/lol/history/26.16-26.17`. 그 쌍 화면 안의 링크(상세·대조표)는
 * 전부 이 아래로 간다. 화면이 이 문자열을 받아 링크를 만들므로, 최신 쌍 화면에선 `null`을 넘긴다(= 평소 주소).
 */
export function pairBasePath(game: PairRouteGame, pair: PairLike): string {
  return `/${game}/history/${pairSlug(pair)}`;
}

/** 목록의 첫 쌍(최신)은 평소 주소, 나머지는 과거 쌍 라우트의 같은 섹션. */
export function pairHref(
  game: PairRouteGame,
  pair: PairLike,
  pairs: readonly PairLike[],
  section: PairSection = ""
): string {
  const latest = pairs[0];
  if (latest && isSamePair(latest, pair)) return sectionHref(game, section);
  return pairSectionHref(game, section, pairBasePath(game, pair));
}

/**
 * 섹션 링크 — 과거 쌍 화면(`base`가 있음)이면 그 쌍 안의 섹션, 아니면 평소 섹션. 이동 경로(breadcrumbs)·헤더
 * 내비·미공지 타일이 이 한 함수로 쌍 맥락을 유지한다(방법론은 쌍이 없으므로 호출부가 평소 주소를 쓴다).
 */
export function pairSectionHref(game: GameId, section: PairSection, base: string | null): string {
  if (base === null) return sectionHref(game, section);
  return section.length === 0 ? `${base}/` : `${base}/${section}/`;
}

/** 슬러그 → 실재하는 쌍. 형식이 틀리거나 목록에 없으면 null(지어내지 않는다). */
export function pairFromSlug(slug: string, pairs: readonly PairLike[]): PairLike | null {
  const [from, to, ...rest] = slug.split("-");
  if (rest.length > 0 || !from || !to || !PATCH.test(from) || !PATCH.test(to)) return null;
  return pairs.find((p) => p.from === from && p.to === to) ?? null;
}

export interface HistoryPath {
  game: PairRouteGame;
  /** 원 슬러그(디코드됨). 실재 여부는 `pairFromSlug`가 따로 본다. */
  slug: string;
  /** 쌍 아래 세그먼트 — 브리핑 `[]`, 대조표 `["compare"]`, 상세 `["item", "champion~Ahri"]`. */
  rest: string[];
}

/** `/lol/history/26.16-26.17/item/x/` → `{ game:"lol", slug:"26.16-26.17", rest:["item","x"] }`. 과거 쌍 경로가 아니면 null. */
export function parseHistoryPath(pathname: string): HistoryPath | null {
  const segments = pathname.split("/").filter((seg) => seg.length > 0);
  const [game, history, slug, ...rest] = segments;
  if (history !== "history" || slug === undefined || game === undefined) return null;
  if (!(PAIR_ROUTE_GAMES as readonly string[]).includes(game)) return null;
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  return { game: game as PairRouteGame, slug: decoded, rest };
}

/** 지금 경로가 과거 쌍 라우트(그 아래 대조표·상세 포함)면 그 쌍, 아니면 null(= 기본 쌍을 보는 중). */
export function pairFromPathname(pathname: string, pairs: readonly PairLike[]): PairLike | null {
  const parsed = parseHistoryPath(pathname);
  return parsed ? pairFromSlug(parsed.slug, pairs) : null;
}

/**
 * 헤더 활성 탭·select 이동에 쓰는 **쌍 안의 섹션**. 과거 쌍 경로면 쌍 아래 첫 세그먼트(`""`·`compare`·`item`…),
 * 아니면 null — 호출부는 평소 `sectionOfPathname`을 쓴다.
 */
export function historySectionOf(pathname: string): string | null {
  const parsed = parseHistoryPath(pathname);
  return parsed ? (parsed.rest[0] ?? "") : null;
}

/**
 * 헤더 select에서 `next` 쌍을 골랐을 때 갈 곳 — **같은 섹션**의 그 쌍.
 *  - 브리핑 → 그 쌍의 브리핑, 대조표 → 그 쌍의 대조표(최신 쌍이면 평소 주소).
 *  - 상세 → 그 쌍의 **브리핑**. 대상 상세는 쌍마다 존재 여부가 다르고(판정이 선 쌍에만 만든다) 헤더는 그 목록을
 *    모른다 — 없는 페이지로 보내지 않는다. 최신 쌍의 `/lol/item/…`로도 보내지 않는다: 그 화면은 판정이 선 **다른**
 *    쌍의 관측을 그릴 수 있어 헤더가 말하는 쌍과 어긋난다.
 */
export function pairSelectHref(
  game: PairRouteGame,
  next: PairLike,
  pairs: readonly PairLike[],
  currentSection: string | null
): string {
  return pairHref(game, next, pairs, currentSection === "compare" ? "compare" : "");
}

// ── LoL 별칭(B3 호출부·테스트 호환) ─────────────────────────────────────────────

export function lolPairSlug(pair: PairLike): string {
  return pairSlug(pair);
}

/** 목록의 첫 쌍(최신)은 브리핑 홈, 나머지는 과거 쌍 라우트. */
export function lolPairHref(pair: PairLike, pairs: readonly PairLike[]): string {
  return pairHref("lol", pair, pairs);
}

export function lolPairFromSlug(slug: string, pairs: readonly PairLike[]): PairLike | null {
  return pairFromSlug(slug, pairs);
}
