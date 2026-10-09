// src/lib/pairPages.ts
// 과거 패치쌍 라우트가 **어떤 페이지를 만드는가**(2026-09-28, 이월 R8). 서버 전용 — 빌드 타임 데이터를 읽는다.
//
// 경로 모양(`/lol/history/{쌍}/…`)은 `pairRoutes.ts`(순수, 헤더도 씀)가, **무엇이 실재하는가**는 여기가 소유한다.
// 둘을 나눈 이유: 링크를 만드는 쪽(화면)과 페이지를 만드는 쪽(generateStaticParams)이 같은 자격 함수를 봐야
// 링크가 404를 가리키지 않는다 — 2026-09-21 TFT 링크 21건이 404였던 결함이 정확히 그 둘의 분기였다.
//
// output:'export'라 generateStaticParams가 빈 배열이면 빌드가 죽는다 — 만들 페이지가 없으면 `_placeholder` 한 장을
// 남긴다(`/lol/item/[id]`와 같은 규약). 라우트는 `_placeholder`를 받으면 「기록 없음」을 그린다.
import "server-only";
import { getDefaultPair, listPatchPairs, loadDeltas } from "@/lib/data";
import { detailEntityKeys } from "@/lib/detailRoutes";
import { itemSlug } from "@/lib/format";
import { loadGameDataDiff } from "@/lib/gamedata";
import { isSamePair, pairFromSlug, pairSlug, type PairLike, type PairRouteGame } from "@/lib/pairRoutes";
import { entitySlug } from "@/lib/tftRoutes";
import { listTftPairs, loadTft, tftHomePair, type TftBundle } from "@/lib/tftData";
import { tftEntityRows, type TftEntityRow } from "@/lib/tftEntityRows";

export const PLACEHOLDER = "_placeholder";

/** 게임의 쌍 목록(최신 우선, 관측 stub 포함). 홈 쌍은 평소 주소가 그리고, 나머지가 과거 쌍 라우트다. */
export function pairsOf(game: PairRouteGame): PairLike[] {
  return game === "lol" ? listPatchPairs() : listTftPairs();
}

/**
 * **홈 쌍** — 관측이 있는 최신 쌍(PLAN-home-observed-pair, 2026-10-09). 평소 주소의 주인. 관측 쌍이 없으면 null(그때는
 * 모든 쌍이 과거 쌍 라우트고 평소 주소는 선언 뷰 폴백).
 */
export function homePairOf(game: PairRouteGame): PairLike | null {
  return game === "lol" ? getDefaultPair() : tftHomePair();
}

/** 과거 쌍 라우트가 그릴 쌍 = 홈을 뺀 나머지 — 홈보다 **새** 선언만 쌍도 여기다(그 노트는 숨지 않는다). */
export function pastPairsOf(game: PairRouteGame): PairLike[] {
  const home = homePairOf(game);
  return pairsOf(game).filter((pair) => !home || !isSamePair(home, pair));
}

/**
 * 라우트 슬러그 → 그 라우트가 그릴 쌍. 형식이 틀리거나, 목록에 없거나, **홈 쌍**이면 null —
 * 홈 쌍은 평소 주소가 주인이다(같은 화면이 두 주소를 갖지 않게).
 */
export function resolvePastPair(game: PairRouteGame, slug: string): PairLike | null {
  const found = pairFromSlug(slug, pairsOf(game));
  const home = homePairOf(game);
  if (!found || (home && isSamePair(home, found))) return null;
  return found;
}

/** 과거 쌍 브리핑·대조표의 정적 파라미터. */
export function pastPairParams(game: PairRouteGame): Array<{ pair: string }> {
  const past = pastPairsOf(game);
  if (past.length === 0) return [{ pair: PLACEHOLDER }];
  return past.map((pair) => ({ pair: pairSlug(pair) }));
}

/**
 * LoL 과거 쌍 상세의 슬러그 — **그 쌍의 행만** 보고, 판정이 선 대상의 **정준 슬러그**만 낸다.
 *
 * `detailRouteSlugs`와 같은 자격(`detailEntityKeys` — 노이즈 상태 제외, K2-4)을 쓰되 **별칭(구 지표 id)은 만들지
 * 않는다**: 별칭은 이미 디스코드로 나간 `/lol/item/…` 링크를 살리려는 것이고, 과거 쌍 상세 주소는 밖으로 나간
 * 적이 없다. 화면은 정준 링크(`lolEntityHref`)만 만든다.
 */
export function lolPairDetailSlugs(pair: PairLike): string[] {
  const deltas = loadDeltas(pair.from, pair.to);
  if (!deltas) return [];
  return detailEntityKeys([deltas.rows]).map((key) => itemSlug(key));
}

/**
 * TFT 상세가 보는 행 집합 — **대조표와 같은 것**이어야 한다(수치 축 포함).
 *
 * 2026-09-21 실측 결함: 대조표는 잠수함 전용 엔티티까지 행으로 만들어 이름에 링크를 걸었는데
 * 상세 `generateStaticParams`는 수치 축 없이 행을 만들어 그 링크가 전부 404였다
 * (`unit~DA_18_ElderDragon`·`item~DA_18_BackrowStar`·`unit~DA_18_Sentry`, TFT 21건).
 * 호출부가 여럿이라 인자를 하나씩 채우면 다음에 또 갈라진다 — 한 함수로 묶는다.
 */
export function tftDetailRows(bundle: TftBundle): TftEntityRow[] {
  const changes = loadGameDataDiff("tft", bundle.deltas.meta.from, bundle.deltas.meta.to)?.changes ?? [];
  return tftEntityRows(bundle.deltas, changes);
}

/** TFT 한 쌍의 상세 슬러그(관측 stub 쌍이면 빈 배열 — 그 쌍엔 상세가 없다). */
export function tftPairDetailSlugs(pair: PairLike): string[] {
  const bundle = loadTft(pair);
  return bundle ? tftDetailRows(bundle).map((row) => entitySlug(row.key)) : [];
}

/** 과거 쌍 상세의 (쌍, 대상) 목록 — 쌍마다 그 쌍에서 자격을 얻은 대상만. */
function pastPairDetails(game: PairRouteGame): Array<{ pair: string; slug: string }> {
  const slugsOf = game === "lol" ? lolPairDetailSlugs : tftPairDetailSlugs;
  return pastPairsOf(game).flatMap((pair) => slugsOf(pair).map((slug) => ({ pair: pairSlug(pair), slug })));
}

/** `/lol/history/[pair]/item/[id]`의 정적 파라미터. 없으면 `_placeholder` 한 장. */
export function lolPastDetailParams(): Array<{ pair: string; id: string }> {
  const out = pastPairDetails("lol").map(({ pair, slug }) => ({ pair, id: slug }));
  return out.length > 0 ? out : [{ pair: PLACEHOLDER, id: PLACEHOLDER }];
}

/** `/tft/history/[pair]/unit/[key]`의 정적 파라미터. 없으면 `_placeholder` 한 장. */
export function tftPastDetailParams(): Array<{ pair: string; key: string }> {
  const out = pastPairDetails("tft").map(({ pair, slug }) => ({ pair, key: slug }));
  return out.length > 0 ? out : [{ pair: PLACEHOLDER, key: PLACEHOLDER }];
}
