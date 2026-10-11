// src/app/pubg/map/[key]/page.tsx
// PUBG 맵 상세 — 승인 아티팩트 §4의 `맵` 탭. 시안이 격하시킨 "항공뷰 지도"를 바로 여기서 쓴다
// ("항공뷰 지도는 격하돼 §4 맵 상세 탭에서만 쓴다 — 특정 맵 패치를 조회할 때는 여전히 필요").
//
// **판정 뱃지가 없는 이유**: 43.1 패치노트에 맵 항목이 0건이다. 짝지을 선언이 없는 축에 판정
// 어휘를 붙이면 "노트에 없다"가 관측이 아니라 전제가 된다 — LoL에서 집계 엔티티를 미공지에서
// 빼낸 것과 같은 판단이다(PLAN-patchgap.md 계약 확장 이력 2026-09-13 2차). 이 화면은 기술
// 통계만 말하고, 그 사실을 화면에서도 명시한다.
import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import PubgMapDetail from "@/components/pubg/PubgMapDetail";
import { loadPubg, loadPubgDeclaration, pubgMapKeys, pubgPair, loadPubgMaps } from "@/lib/pubgData";
import { mapKeyFromSlug, mapSlug } from "@/lib/pubgRoutes";
import { mapIdentity } from "@/pipeline/aggregate/pubg-maps";

interface PageProps {
  params: Promise<{ key: string }>;
}

export function generateStaticParams(): Array<{ key: string }> {
  const keys = pubgMapKeys();
  if (keys.length === 0) return [{ key: "_placeholder" }];
  return keys.map((key) => ({ key: mapSlug(key) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const mapKey = mapKeyFromSlug(key, pubgMapKeys());
  const name = mapKey ? mapIdentity(mapKey).koName : "맵";
  // 비교 행이 없는(한쪽 구간에만 표본) 맵은 없는 변화를 약속하지 않는다(트랙 B ST-17, pubg-S15 — 미라마 description이 「…무기 구성 변화」였다).
  const comparable = mapKey ? (loadPubgMaps()?.deltas.rows.some((r) => r.mapKey === mapKey) ?? false) : false;
  const pair = pubgPair();
  return pageMeta({
    game: "pubg",
    screen: "detail",
    entity: name,
    pair,
    path: `/pubg/map/${key}/`,
    description: comparable
      ? `${name}의 ${pair ? `${pair.from} → ${pair.to} ` : ""}매치 점유율·평균 매치 시간·봇 비율·매치당 획득(판정 없음 — 관측값).`
      : `${name} — 한쪽 패치 구간에만 표본이 잡혀 두 패치를 비교하지 않았습니다.`,
  });
}

export default async function PubgMapPage({ params }: PageProps) {
  const { key: slug } = await params;
  const bundle = loadPubg();
  return <PubgMapDetail slug={slug} bundle={bundle} declaration={bundle ? null : loadPubgDeclaration()} />;
}
