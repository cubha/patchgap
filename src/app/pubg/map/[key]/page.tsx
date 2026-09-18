// src/app/pubg/map/[key]/page.tsx
// PUBG 맵 상세 — 승인 아티팩트 §4의 `맵` 탭. 시안이 격하시킨 "항공뷰 지도"를 바로 여기서 쓴다
// ("항공뷰 지도는 격하돼 §4 맵 상세 탭에서만 쓴다 — 특정 맵 패치를 조회할 때는 여전히 필요").
//
// **판정 뱃지가 없는 이유**: 43.1 패치노트에 맵 항목이 0건이다. 짝지을 선언이 없는 축에 판정
// 어휘를 붙이면 "노트에 없다"가 관측이 아니라 전제가 된다 — LoL에서 집계 엔티티를 미공지에서
// 빼낸 것과 같은 판단이다(PLAN-patchgap.md 계약 확장 이력 2026-09-13 2차). 이 화면은 기술
// 통계만 말하고, 그 사실을 화면에서도 명시한다.
import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import PubgDetailSplash, { type PubgDetailStat } from "@/components/pubg/PubgDetailSplash";
import { PubgFooter, PubgUnavailable, pct } from "@/components/pubg/shared";
import { loadPubg, loadPubgAssets, loadPubgMaps } from "@/lib/pubgData";
import { mapKeyFromSlug, mapSlug, weaponHref } from "@/lib/pubgRoutes";
import { mapIdentity } from "@/pipeline/aggregate/pubg-maps";
import { publicMapPath } from "@/pipeline/pubg/asset-path";

interface PageProps {
  params: Promise<{ key: string }>;
}

/** 맵 키 후보 — 두 구간 합집합(한쪽에만 표본이 잡힌 맵도 상세는 존재한다). */
function allMapKeys(): string[] {
  const maps = loadPubgMaps();
  if (!maps) return [];
  return [...new Set([...maps.before.maps, ...maps.after.maps].map((m) => m.mapKey))];
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function generateStaticParams(): Array<{ key: string }> {
  const keys = allMapKeys();
  if (keys.length === 0) return [{ key: "_placeholder" }];
  return keys.map((key) => ({ key: mapSlug(key) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const mapKey = mapKeyFromSlug(key, allMapKeys());
  const name = mapKey ? mapIdentity(mapKey).koName : "맵";
  return {
    title: `${name} · PUBG 42.3 ⇒ 43.1 · patchgap`,
    description: `${name}의 42.3 → 43.1 매치 점유율·평균 소요·무기 구성 변화.`,
  };
}

export default async function PubgMapPage({ params }: PageProps) {
  const { key: slug } = await params;
  const bundle = loadPubg();
  const maps = loadPubgMaps();
  if (!bundle || !maps) {
    return (
      <main>
      <Container>
        <PubgUnavailable />
      </Container>
    </main>
    );
  }

  const mapKey = mapKeyFromSlug(slug, allMapKeys());
  const statAfter = mapKey ? (maps.after.maps.find((m) => m.mapKey === mapKey) ?? null) : null;
  const statBefore = mapKey ? (maps.before.maps.find((m) => m.mapKey === mapKey) ?? null) : null;
  const shown = statAfter ?? statBefore;

  if (!mapKey || !shown) {
    return (
      <main>
      <Container>
        <div className="py-12">
          <h1 className="font-display text-2xl font-bold text-fg">알 수 없는 맵</h1>
          <p className="mt-3 text-sm text-muted">
            이 표본에 그 맵이 없습니다.{" "}
            <Link href="/pubg/" className="text-accent underline-offset-2 hover:underline">
              브리핑으로 →
            </Link>
          </p>
        </div>
      </Container>
    </main>
    );
  }

  const identity = mapIdentity(mapKey);
  const assets = loadPubgAssets();
  const hasRender = identity.assetName !== "" && (assets?.maps.includes(identity.assetName) ?? false);
  const delta = maps.deltas.rows.find((r) => r.mapKey === mapKey) ?? null;
  // 한쪽 구간에만 표본이 잡힌 맵 — 비교행이 없다는 사실을 문장으로 말한다.
  const oneSided = delta === null;

  const stats: PubgDetailStat[] = [
    {
      label: "매치 점유율",
      value: delta
        ? `${pct(delta.matchShare.before, 1)} → ${pct(delta.matchShare.after, 1)}`
        : pct(shown.matchShare, 1),
      tone: delta ? (delta.matchShareDelta > 0 ? "up" : "down") : undefined,
    },
    {
      label: "평균 매치 시간",
      value: delta
        ? `${fmtDuration(delta.avgDurationSec.before)} → ${fmtDuration(delta.avgDurationSec.after)}`
        : fmtDuration(shown.avgDurationSec),
    },
    {
      label: "봇 비율",
      value: delta
        ? `${pct(delta.botShare.before)} → ${pct(delta.botShare.after)}`
        : pct(shown.botShare),
    },
    {
      label: "매치 수",
      value: delta
        ? `${delta.n.before.toLocaleString()} → ${delta.n.after.toLocaleString()}`
        : shown.nMatches.toLocaleString(),
    },
  ];

  return (
    <main>
      <Container>
      <div className="flex flex-col gap-6 pt-12 pb-8">
        <nav className="font-mono text-xs text-muted">
          <Link href="/pubg/" className="hover:text-fg-2">
            브리핑
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-fg-2">{identity.koName}</span>
        </nav>

        <PubgDetailSplash
          eyebrow={`맵 · ${identity.sizeLabel}`}
          title={identity.koName}
          imageSrc={hasRender ? publicMapPath(identity.assetName) : null}
          fit="cover"
          fallbackMark={identity.koName}
          stats={stats}
          verdict={
            oneSided
              ? "한쪽 구간에만 표본이 잡혀 두 패치를 비교하지 않았습니다."
              : "43.1 패치노트에 맵 항목 없음 · 관측값만 표시"
          }
        />

        <SectionCard
          eyebrow="구성"
          title={`${identity.koName}에서 많이 줍는 총`}
          variant="glass"
          action={<span className="font-mono text-xs text-muted">43.1 기준</span>}
        >
          {(statAfter ?? shown).topWeapons.length === 0 ? (
            <p className="p-5 text-sm text-muted">이 구간 표본에 무기 획득 기록이 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-soft">
              {(statAfter ?? shown).topWeapons.map((weapon) => (
                <li key={weapon.weaponKey} className="flex items-baseline justify-between gap-3 px-5 py-3">
                  <Link
                    href={weaponHref(weapon.weaponKey)}
                    className="font-display font-bold text-fg hover:text-accent"
                  >
                    {weapon.weaponName}
                  </Link>
                  <span className="font-mono text-sm tabular-nums text-fg-2">
                    {pct(weapon.share, 2)}
                    <span className="ml-2 text-xs text-muted">
                      {weapon.pickups.toLocaleString()}회
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="px-5 pt-3 pb-5 text-xs text-muted">이 맵 안의 총 무기 획득 대비 점유율</p>
        </SectionCard>

        <PubgFooter generatedAt={maps.deltas.meta.generatedAt} nVerdicts={bundle.deltas.meta.n} />
      </div>
    </Container>
    </main>
  );
}
