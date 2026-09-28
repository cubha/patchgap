// src/app/lol/item/[id]/page.tsx
// **대상 상세**(평소 주소) — 본문은 `components/detail/LolItemDetail.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍
// 상세 `/lol/history/[pair]/item/[id]/`와 같은 본문을 쓰려고 옮겼다). 이 라우트는 **전 쌍**을 보고 판정이 선 쌍을
// 고른다(디스코드로 나간 링크가 이 주소라 그 규칙을 바꾸지 않는다).
//
// output:'export' 정적 배포이므로 generateStaticParams가 필수 — 모든 패치 쌍의 deltas rows에서
// id를 모은다(쌍이 0개면 `_placeholder` 1건 유지 — 실측(2026-09-05): output:'export'에서
// generateStaticParams가 빈 배열을 반환하면 `next build`가 즉시 실패한다).
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
  return <LolItemDetail id={id} pairs={listPatchPairs()} />;
}
