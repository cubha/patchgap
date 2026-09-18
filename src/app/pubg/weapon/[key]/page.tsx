// src/app/pubg/weapon/[key]/page.tsx
// PUBG 무기 상세 — 승인 아티팩트 §4 "항목상세 스플래시"의 `무기` 탭. 사용자 지시
// ("총기류, 맵류의 상세화면 전환 및 스플레시아트 디자인이 누락됨. 보완진행", 2026-09-17).
//
// output:'export'라 generateStaticParams가 필수다. 집계가 없으면 `_placeholder` 1건을 남긴다 —
// 빈 배열을 반환하면 `next build`가 즉시 실패한다(2026-09-05 실측, `/item/[id]`와 동일).
import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import PubgDetailSplash, { type PubgDetailStat } from "@/components/pubg/PubgDetailSplash";
import { PubgFooter, PubgUnavailable, pct, signedPct } from "@/components/pubg/shared";
import { isReportable, loadPubg, loadPubgAssets } from "@/lib/pubgData";
import { displayStatusOf } from "@/pipeline/shared/display-status";
import { weaponKeyFromSlug, weaponSlug } from "@/lib/pubgRoutes";
import { publicWeaponPath } from "@/pipeline/pubg/asset-path";
import { weaponCategoryLabel } from "@/pipeline/aggregate/pubg-weapon-key";

interface PageProps {
  params: Promise<{ key: string }>;
}

export function generateStaticParams(): Array<{ key: string }> {
  const bundle = loadPubg();
  const keys = bundle?.after.weapons.map((w) => w.weaponKey) ?? [];
  if (keys.length === 0) return [{ key: "_placeholder" }];
  return keys.map((key) => ({ key: weaponSlug(key) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const bundle = loadPubg();
  const weaponKey = weaponKeyFromSlug(key, bundle?.after.weapons.map((w) => w.weaponKey) ?? []);
  const name = bundle?.after.weapons.find((w) => w.weaponKey === weaponKey)?.weaponName ?? "무기";
  return {
    title: `${name} · PUBG 42.3 ⇒ 43.1 · patchgap`,
    description: `${name}의 42.3 → 43.1 획득 점유율 변화와 판정 근거.`,
  };
}

export default async function PubgWeaponPage({ params }: PageProps) {
  const { key: slug } = await params;
  const bundle = loadPubg();
  if (!bundle) {
    return (
      <main>
      <Container>
        <PubgUnavailable />
      </Container>
    </main>
    );
  }

  const { deltas, before, after, notes } = bundle;
  const weaponKey = weaponKeyFromSlug(
    slug,
    after.weapons.map((w) => w.weaponKey)
  );
  const statAfter = after.weapons.find((w) => w.weaponKey === weaponKey);
  const statBefore = before.weapons.find((w) => w.weaponKey === weaponKey);

  if (!weaponKey || !statAfter) {
    return (
      <main>
      <Container>
        <div className="py-12">
          <h1 className="font-display text-2xl font-bold text-fg">알 수 없는 무기</h1>
          <p className="mt-3 text-sm text-muted">
            이 표본에 그 무기가 없습니다.{" "}
            <Link href="/pubg/compare/" className="text-accent underline-offset-2 hover:underline">
              대조표로 →
            </Link>
          </p>
        </div>
      </Container>
    </main>
    );
  }

  const row = deltas.rows.find((r) => r.weaponKey === weaponKey) ?? null;
  const note = row?.matchedNoteId ? (notes.find((n) => n.id === row.matchedNoteId) ?? null) : null;

  // 자산 유무를 **빌드 타임에** 판정한다 — 없는 무기가 실제로 9종 있다(RPD 포함).
  const assets = loadPubgAssets();
  const hasRender = assets?.weapons.includes(weaponKey) ?? false;

  // 2026-09-18 라운드6(C1 + scope-critic ST9): 목록(브리핑·대조표·그리드)은 판정이 선 무기만 강조하지만,
  // 사용자가 **직접 연 상세**에서는 관측값(변화·CI)을 숨기지 않고 판정이 없는 이유를 사실대로 말한다 —
  // 표본 부족을 "유의한 변화 없음"이라 부르면 거짓이다. 배지는 판정이 선 행에만.
  const judged = row !== null && isReportable(row.status);
  const rel = row?.relChange ?? null;
  const unjudgedReason =
    row === null
      ? "판정 대상 아님"
      : row.status === "insufficient-sample"
        ? "획득 표본이 부족해 판정하지 않음"
        : row.status === "below-threshold"
          ? "변화가 효과크기 바닥 미만이라 판정하지 않음"
          : "유의한 변화 없음";
  const stats: PubgDetailStat[] = [
    {
      label: "획득 점유율",
      value: `${pct(statBefore?.share ?? 0, 2)} → ${pct(statAfter.share, 2)}`,
    },
  ];
  if (rel !== null) {
    stats.push({
      label: "상대 변화",
      value: signedPct(rel),
      tone: rel > 0 ? "up" : "down",
    });
  }
  if (row) {
    stats.push({
      label: "95% CI",
      value: `[${signedPct(row.relCi[0])}, ${signedPct(row.relCi[1])}]`,
    });
    stats.push({
      label: "표본 n",
      value: `${row.n.before.toLocaleString()} → ${row.n.after.toLocaleString()}`,
    });
  }

  return (
    <main>
      <Container>
      <div className="flex flex-col gap-6 pt-12 pb-8">
        <nav className="font-mono text-xs text-muted">
          <Link href="/pubg/" className="hover:text-fg-2">
            브리핑
          </Link>
          <span className="px-1.5">/</span>
          <Link href="/pubg/compare/" className="hover:text-fg-2">
            대조표
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-fg-2">{statAfter.weaponName}</span>
        </nav>

        <PubgDetailSplash
          // 시안 §4 `.detail-eyebrow`가 "무기 · 돌격소총"처럼 세부 분류를 쓴다.
          eyebrow={`무기 · ${weaponCategoryLabel(weaponKey)}`}
          title={statAfter.weaponName}
          imageSrc={hasRender ? publicWeaponPath(weaponKey) : null}
          fit="contain"
          fallbackMark={statAfter.weaponName}
          stats={stats}
          verdict={
            row && judged ? (
              <>
                <StatusBadge status={displayStatusOf(row.status)} />{" "}
                {note ? `공지 "${note.summary}" 대조` : "43.1 패치노트에 이 무기 항목 없음"}
              </>
            ) : (
              unjudgedReason
            )
          }
        />

        <SectionCard eyebrow="근거" title="원천" variant="glass">
          <div className="flex flex-col gap-3 p-5 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 text-muted">
              <span className="font-bold text-fg-2">집계 파일</span>
              <span className="font-mono text-xs break-all">
                {row?.evidence.aggregatePath ??
                  `data/aggregated/pubg/weapons-43.1.json#weapons[weaponKey=${weaponKey}]`}
              </span>
            </div>
            {row?.evidence.noteAnchor ? (
              <a
                className="font-mono text-xs text-accent underline-offset-2 hover:underline"
                href={row.evidence.noteAnchor}
                target="_blank"
                rel="noreferrer"
              >
                패치노트 원문 보기 ↗
              </a>
            ) : null}
            {row && row.evidence.matchIds.length > 0 ? (
              <div className="text-muted">
                <span className="font-bold text-fg-2">표본 매치</span>{" "}
                <span className="font-mono text-xs break-all">
                  {row.evidence.matchIds.slice(0, 3).join(" · ")}
                  {row.evidence.matchIds.length > 3 ? ` 외 ${row.evidence.matchIds.length - 3}건` : ""}
                </span>
              </div>
            ) : null}
            <Link href="/pubg/methodology/" className="text-xs font-bold text-accent hover:underline">
              판정 규칙 보기 →
            </Link>
          </div>
        </SectionCard>

        <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
      </div>
    </Container>
    </main>
  );
}
