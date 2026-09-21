// src/app/pubg/weapon/[key]/page.tsx
// PUBG 무기 상세 — 승인 아티팩트 §4 "항목상세 스플래시"의 `무기` 탭. 사용자 지시
// ("총기류, 맵류의 상세화면 전환 및 스플레시아트 디자인이 누락됨. 보완진행", 2026-09-17).
//
// output:'export'라 generateStaticParams가 필수다. 집계가 없으면 `_placeholder` 1건을 남긴다 —
// 빈 배열을 반환하면 `next build`가 즉시 실패한다(2026-09-05 실측, `/item/[id]`와 동일).
import type { Metadata } from "next";
import { buildPubgEvidenceProse } from "@/components/pubg/evidenceProse";
import Link from "next/link";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import SubmarineDetailBlock from "@/components/gamedata/SubmarineDetailBlock";
import { loadGameDataDiff, noteMismatchChangesFor, submarineChangesFor } from "@/lib/gamedata";
import PubgDetailSplash, { type PubgDetailStat } from "@/components/pubg/PubgDetailSplash";
import { PubgFooter, PubgUnavailable, pct, signedPct } from "@/components/pubg/shared";
import { isReportable, loadPubg, loadPubgAssets } from "@/lib/pubgData";
import { displayStatusOf } from "@/pipeline/shared/display-status";
import { weaponKeyFromSlug, weaponSlug } from "@/lib/pubgRoutes";
import { publicWeaponPath } from "@/pipeline/pubg/asset-path";
import { weaponCategoryLabel } from "@/pipeline/aggregate/pubg-weapon-key";
import ExternalLink from "@/components/ExternalLink";

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

  // 수치 축(F9) — PUBG는 게임사가 수치 파일을 배포하지 않아 텔레메트리 피해 격자를 대조한다.
  const gameData = loadGameDataDiff("pubg", deltas.meta.from, deltas.meta.to);
  const submarineChanges = submarineChangesFor(gameData, "weapon", weaponKey);
  const mismatchChanges = noteMismatchChangesFor(gameData, "weapon", weaponKey);

  // 자산 유무를 **빌드 타임에** 판정한다 — 없는 무기가 실제로 9종 있다(RPD 포함).
  const assets = loadPubgAssets();
  const hasRender = assets?.weapons.includes(weaponKey) ?? false;

  // 2026-09-18 라운드6(C1 + scope-critic ST9): 목록(브리핑·대조표·그리드)은 판정이 선 무기만 강조하지만,
  // 사용자가 **직접 연 상세**에서는 관측값(변화·CI)을 숨기지 않고 판정이 없는 이유를 사실대로 말한다 —
  // 표본 부족을 "유의한 관측 없음"이라 부르면 거짓이다. 배지는 판정이 선 행에만.
  // 2026-09-19 최종 채점 K4-4(R6): 같은 뜻을 LoL은 "유의한 관측 없음", PUBG는 "유의한 변화 없음"
  // 으로 부르고 있었다(17 라우트). 게임이 달라도 같은 판정이면 같은 말이어야 한다 — LoL 쪽 어휘로
  // 맞춘다(`NoteNavigator.tsx:137`·`ReleaseNoteRow.tsx:273`·`ReleaseNoteStream.tsx:216`).
  const judged = row !== null && isReportable(row.status);
  const rel = row?.relChange ?? null;
  const unjudgedReason =
    row === null
      ? "판정 대상 아님"
      : row.status === "insufficient-sample"
        ? "획득 표본이 부족해 판정하지 않음"
        : row.status === "below-threshold"
          ? "변화가 효과크기 바닥 미만이라 판정하지 않음"
          : "유의한 관측 없음";
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

        {/* B안(2026-09-21 사용자 확정) — 세 게임이 같은 자리에 같은 제목을 쓴다. PUBG 상세에는
            선언 카드가 없었고 노트가 판정 줄에만 있었다 — 두 구획을 가지려면 카드가 필요하다.
            근거 카드 **위**에 둔다: "무엇이 바뀌었나"가 "어떻게 판정했나"보다 먼저다. */}
        <SectionCard
          eyebrow="선언 대조"
          title="패치노트 대조"
          variant="glass"
          action={
            <span className="font-mono text-xs text-muted">
              말한 것 {note ? 1 : 0} · 말하지 않은 것 {submarineChanges.length}
              {mismatchChanges.length > 0 ? ` · 값이 다른 것 ${mismatchChanges.length}` : ""}
            </span>
          }
        >
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <span className="h-1.5 w-1.5 rounded-pill bg-muted" aria-hidden="true" />
            <h3 className="font-body text-xs font-bold tracking-wide text-muted">패치노트가 말한 것</h3>
          </div>
          {note ? (
            <div className="flex flex-col gap-1 px-5 pb-4">
              <span className="text-sm text-fg-2">{note.summary}</span>
              {row?.evidence.noteAnchor ? (
                <ExternalLink
                  href={row.evidence.noteAnchor}
                  className="w-fit font-mono text-xs text-accent hover:underline"
                >
                  원문 ↗
                </ExternalLink>
              ) : null}
            </div>
          ) : (
            <p className="px-5 pb-4 text-sm text-muted">
              {deltas.meta.to} 패치노트에 이 무기를 언급한 항목이 없습니다.
            </p>
          )}

          <div className="border-t border-border-soft" />

          <SubmarineDetailBlock
            changes={submarineChanges}
            mismatchChanges={mismatchChanges}
            source={gameData?.meta.source ?? null}
            notePatch={deltas.meta.to}
          />
        </SectionCard>

        <SectionCard eyebrow="근거" title="이렇게 판정했습니다" variant="glass">
          <div className="flex flex-col gap-4 p-5 text-sm">
            {/* 2026-09-19 사용자 지적("근거가 전혀 사용자가 알아볼 수 없게되어있어 … 자연어로
                근거를 제공받아야함"): 집계 파일 경로와 매치 UUID는 감사 흔적이지 사람이 읽는
                근거가 아니다. 문장이 먼저 오고 식별자는 접힌 영역으로 내린다 — 원천을 지우는
                것은 "모든 판정문은 원천 링크를 가진다"(CLAUDE.md) 위반이라 위계만 바꾼다. */}
            <div className="flex flex-col gap-2 leading-relaxed text-fg-2">
              {buildPubgEvidenceProse({
                subjectName: statAfter.weaponName,
                subjectKind: "무기",
                metricLabel: "획득 점유율",
                from: deltas.meta.from,
                to: deltas.meta.to,
                before: statBefore?.share ?? null,
                after: statAfter.share,
                row,
                noteSummary: note?.summary ?? null,
                effectFloor: deltas.meta.effectFloor,
              }).map((sentence) => (
                <p key={sentence}>{sentence}</p>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/pubg/methodology/" className="text-xs font-bold text-accent hover:underline">
                판정 규칙 보기 →
              </Link>
              {row?.evidence.noteAnchor ? (
                <ExternalLink
                  className="text-xs font-bold text-accent underline-offset-2 hover:underline"
                  href={row.evidence.noteAnchor}
                >
                  패치노트 원문 보기 ↗
                </ExternalLink>
              ) : null}
            </div>

            <details className="rounded-md border border-border-soft">
              <summary className="cursor-pointer list-none px-4 py-2 text-xs font-bold text-muted hover:text-fg-2 [&::-webkit-details-marker]:hidden">
                원천 데이터 보기
              </summary>
              <div className="flex flex-col gap-2 border-t border-border-soft px-4 py-3 text-muted">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-bold text-fg-2">집계 파일</span>
                  <span className="font-mono text-xs break-all">
                    {row?.evidence.aggregatePath ??
                      `data/aggregated/pubg/weapons-${deltas.meta.to}.json#weapons[weaponKey=${weaponKey}]`}
                  </span>
                </div>
                {row && row.evidence.matchIds.length > 0 ? (
                  <div>
                    <span className="font-bold text-fg-2">표본 매치</span>{" "}
                    <span className="font-mono text-xs break-all">
                      {row.evidence.matchIds.slice(0, 3).join(" · ")}
                      {row.evidence.matchIds.length > 3 ? ` 외 ${row.evidence.matchIds.length - 3}건` : ""}
                    </span>
                  </div>
                ) : null}
              </div>
            </details>
          </div>
        </SectionCard>

        <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
      </div>
    </Container>
    </main>
  );
}
