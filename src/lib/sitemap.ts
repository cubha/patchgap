// src/lib/sitemap.ts — sitemap 주소 목록(ST-1). 라우트 파일(`app/sitemap.ts`)은 기본 내보내기만 둔다 — 메타 라우트의 추가
// 내보내기는 Next 규약 밖이고, 테스트가 이 목록을 빌드 산출물과 대조하려면 lib에 있어야 한다.
//
// 주소 목록은 각 라우트의 `generateStaticParams`가 쓰는 **같은 lib 함수**에서 만든다 — 따로 나열하면 실재하지 않는 주소를
// 색인에 올리거나 실재하는 주소를 빠뜨린다. 넣지 않는 것: LoL 상세 별칭(구 지표 경로 — canonical이 정준 주소를 가리킨다),
// `_placeholder`, TFT 최신형 상세가 관측 쌍으로 보내는 안내 페이지(최신 쌍이 관측 전일 때).
import "server-only";
import { listPatchPairs, loadDeltas } from "@/lib/data";
import { detailEntityKeys } from "@/lib/detailRoutes";
import { itemSlug } from "@/lib/format";
import { GAMES, sectionHref } from "@/lib/game";
import { PLACEHOLDER, lolPastDetailParams, pastPairParams, tftDetailRows, tftPastDetailParams } from "@/lib/pairPages";
import { loadPubg, pubgMapKeys } from "@/lib/pubgData";
import { mapHref, weaponHref } from "@/lib/pubgRoutes";
import { loadTft } from "@/lib/tftData";
import { entitySlug } from "@/lib/tftRoutes";

/** 사이트 경로 전부(절대 주소 아님). */
export function sitemapPaths(): string[] {
  const paths: string[] = ["/"];
  for (const game of GAMES) {
    for (const section of ["", "compare", "methodology"] as const) paths.push(sectionHref(game.id, section));
  }
  for (const game of ["lol", "tft"] as const) {
    for (const { pair } of pastPairParams(game)) {
      if (pair === PLACEHOLDER) continue;
      paths.push(`/${game}/history/${pair}/`, `/${game}/history/${pair}/compare/`);
    }
  }
  // LoL 상세: 최신 주소는 대상 정준 슬러그만, 과거 쌍은 그 쌍의 정준 슬러그만.
  const lolRows = listPatchPairs()
    .map((p) => loadDeltas(p.from, p.to)?.rows)
    .filter((rows): rows is NonNullable<typeof rows> => rows !== undefined);
  for (const key of detailEntityKeys(lolRows)) paths.push(`/lol/item/${itemSlug(key)}/`);
  for (const { pair, id } of lolPastDetailParams()) if (pair !== PLACEHOLDER) paths.push(`/lol/history/${pair}/item/${id}/`);
  // TFT 최신 상세는 최신 쌍이 관측됐을 때만 본문이다(관측 전이면 과거 쌍으로 보내는 안내 페이지).
  const tft = loadTft();
  if (tft) for (const row of tftDetailRows(tft)) paths.push(`/tft/unit/${entitySlug(row.key)}/`);
  for (const { pair, key } of tftPastDetailParams()) if (pair !== PLACEHOLDER) paths.push(`/tft/history/${pair}/unit/${key}/`);
  for (const w of loadPubg()?.after.weapons ?? []) paths.push(weaponHref(w.weaponKey));
  for (const key of pubgMapKeys()) paths.push(mapHref(key));
  return Array.from(new Set(paths));
}
