// src/app/lol/item/[id]/page.tsx
// **대상 상세**(평소 주소) — 본문은 `components/detail/LolItemDetail.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍
// 상세 `/lol/history/[pair]/item/[id]/`와 같은 본문을 쓰려고 옮겼다).
//
// **이 주소는 최신 쌍만 그린다**(ST-20, 2026-10-08 site-review lol-S11). 전에는 전 쌍을 훑어 판정이 선 쌍을 골랐고, 그래서
// `/lol/item/item~3124/`가 패치 선택기도 없이 26.17 → 26.18 데이터를 보여 줬다 — 현재 쌍 주소가 옛 쌍을 말하면 읽는 사람은
// 그것을 현재로 읽는다. 최신 쌍에 없으면 그 대상이 실재하는 과거 쌍 상세로 안내한다(디스코드로 나간 옛 링크의 생명줄).
//
// output:'export' 정적 배포이므로 generateStaticParams가 필수 — 모든 패치 쌍의 deltas rows에서
// id를 모은다(쌍이 0개면 `_placeholder` 1건 유지 — 실측(2026-09-05): output:'export'에서
// generateStaticParams가 빈 배열을 반환하면 `next build`가 즉시 실패한다). 경로는 전 쌍 합집합으로 두는 이유가 바로 그
// 옛 링크다 — 경로를 줄이면 그 링크가 조용히 404가 된다.
import LolItemDetail from "@/components/detail/LolItemDetail";
import { detailRouteSlugs } from "@/lib/detailRoutes";
import { listPatchPairs, loadDeltas } from "@/lib/data";

interface ItemPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams(): Array<{ id: string }> {
  // 2026-09-19 최종 채점 K2-4: 노이즈 상태(표본 부족·바닥 미달·변화 없음) 상세가 1,870건 빌드돼
  // 있었다. 링크는 0이라 우연히 밟을 일은 없었지만, 사용자 지시는 "아예 보여주지 않도록"이었고
  // URL을 직접 열면 그 관측이 그대로 나왔다 — 자격 판정은 `detailRouteIds`가 소유한다.
  const pairs = listPatchPairs();
  const rowsByPair = pairs
    .map((pair) => loadDeltas(pair.from, pair.to))
    .filter((deltas): deltas is NonNullable<typeof deltas> => deltas !== null)
    .map((deltas) => deltas.rows);
  // 정준(대상) + 별칭(구 지표 경로). 별칭을 빼면 이미 나간 디스코드 링크가 조용히 404가 된다.
  const slugs = detailRouteSlugs(rowsByPair);
  if (slugs.length === 0) return [{ id: "_placeholder" }];
  return slugs.map((id) => ({ id }));
}

export default async function ItemDetailPage({ params }: ItemPageProps) {
  const { id } = await params;
  const [latest, ...past] = listPatchPairs();
  return <LolItemDetail id={id} pairs={latest ? [latest] : []} otherPairs={past} />;
}
