// src/app/tft/unit/[key]/page.tsx
// TFT 엔티티 상세(최신 쌍) — LoL `/lol/item/*`·PUBG `/pubg/weapon/*`와 같은 자리다. 본문은
// `components/tft/TftUnitDetail.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍 상세와 같은 본문을 쓰려고 옮겼다).
// 유닛뿐 아니라 특성·아이템도 여기로 들어온다(라우트 이름은 `unit`이지만 키에 종류가 들어 있다).
//
// `output:'export'`라 `generateStaticParams`가 필수이고, 집계가 없으면 `_placeholder` 1건을
// 남긴다 — 빈 배열을 반환하면 `next build`가 즉시 실패한다(PUBG 상세와 같은 실측 근거).
// 행 집합은 대조표와 같은 `tftDetailRows`다(2026-09-21 링크 21건 404의 재발 방지 — `lib/pairPages.ts` 주석).
import type { Metadata } from "next";

import TftUnitDetail from "@/components/tft/TftUnitDetail";
import { tftDetailRows } from "@/lib/pairPages";
import { loadTft, loadTftDeclaration } from "@/lib/tftData";
import { entityKeyFromSlug as unslug, entitySlug } from "@/lib/tftRoutes";

export function generateStaticParams(): Array<{ key: string }> {
  const bundle = loadTft();
  if (!bundle) return [{ key: "_placeholder" }];
  const rows = tftDetailRows(bundle);
  if (rows.length === 0) return [{ key: "_placeholder" }];
  return rows.map((r) => ({ key: entitySlug(r.key) }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const bundle = loadTft();
  const row = bundle ? tftDetailRows(bundle).find((r) => r.key === unslug(key)) : undefined;
  return { title: row ? `${row.name} — TFT · patchgap` : "TFT 상세 — patchgap" };
}

export default async function TftUnitPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const bundle = loadTft();
  return <TftUnitDetail slug={key} bundle={bundle} declaration={bundle ? null : loadTftDeclaration()} />;
}
