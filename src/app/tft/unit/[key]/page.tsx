// src/app/tft/unit/[key]/page.tsx
// TFT 엔티티 상세(최신 쌍) — LoL `/lol/item/*`·PUBG `/pubg/weapon/*`와 같은 자리다. 본문은
// `components/tft/TftUnitDetail.tsx`에 있다(2026-09-28, 이월 R8 — 과거 쌍 상세와 같은 본문을 쓰려고 옮겼다).
// 유닛뿐 아니라 특성·아이템도 여기로 들어온다(라우트 이름은 `unit`이지만 키에 종류가 들어 있다).
//
// `output:'export'`라 `generateStaticParams`가 필수이고, 집계가 없으면 `_placeholder` 1건을
// 남긴다 — 빈 배열을 반환하면 `next build`가 즉시 실패한다(PUBG 상세와 같은 실측 근거).
// 행 집합은 대조표와 같은 `tftDetailRows`다(2026-09-21 링크 21건 404의 재발 방지 — `lib/pairPages.ts` 주석).
//
// **최신 쌍이 관측 전이면**(ST-17, 2026-10-08) 관측이 있는 최신 쌍의 대상으로 경로를 만들고, 각 페이지는 그 쌍의 상세로
// 보낸다 — 패치가 넘어갈 때 이미 공유된 최신형 링크가 404로 끊기지 않게.
import type { Metadata } from "next";

import TftObservedRedirect from "@/components/tft/TftObservedRedirect";
import TftUnitDetail from "@/components/tft/TftUnitDetail";
import { tftDetailRows } from "@/lib/pairPages";
import { pairBasePath, pairSectionLink } from "@/lib/pairRoutes";
import { latestObservedTftPair, loadTft, loadTftDeclaration, type TftBundle } from "@/lib/tftData";
import { entityKeyFromSlug as unslug, entitySlug, tftEntityHref } from "@/lib/tftRoutes";

/** 경로의 재료가 되는 번들 — 최신 쌍, 그것이 관측 전이면 관측이 있는 최신 쌍. */
function sourceBundle(): { bundle: TftBundle; observedPair: ReturnType<typeof latestObservedTftPair> } | null {
  const latest = loadTft();
  if (latest) return { bundle: latest, observedPair: null };
  const observed = latestObservedTftPair();
  const bundle = observed ? loadTft(observed.pair) : null;
  return bundle && observed ? { bundle, observedPair: observed } : null;
}

export function generateStaticParams(): Array<{ key: string }> {
  const source = sourceBundle();
  if (!source) return [{ key: "_placeholder" }];
  const rows = tftDetailRows(source.bundle);
  if (rows.length === 0) return [{ key: "_placeholder" }];
  return rows.map((r) => ({ key: entitySlug(r.key) }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const source = sourceBundle();
  const row = source ? tftDetailRows(source.bundle).find((r) => r.key === unslug(key)) : undefined;
  return { title: row ? `${row.name} — TFT · patchgap` : "TFT 상세 — patchgap" };
}

export default async function TftUnitPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const bundle = loadTft();
  if (bundle) return <TftUnitDetail slug={key} bundle={bundle} declaration={null} />;

  const declaration = loadTftDeclaration();
  const source = sourceBundle();
  if (declaration && source?.observedPair) {
    const row = tftDetailRows(source.bundle).find((r) => r.key === unslug(key));
    if (row) {
      const pair = source.observedPair.pair;
      return (
        <TftObservedRedirect
          name={row.name}
          href={tftEntityHref(row.key, pairBasePath("tft", pair))}
          pairLabel={`${pair.from} → ${pair.to}`}
          failure={declaration.failure}
          generatedAt={declaration.generatedAt}
        />
      );
    }
  }
  const observed = source?.observedPair ?? null;
  return (
    <TftUnitDetail
      slug={key}
      bundle={null}
      declaration={declaration}
      observed={observed ? pairSectionLink("tft", observed.pair, observed.isLatest, "compare", "대조표") : null}
    />
  );
}
