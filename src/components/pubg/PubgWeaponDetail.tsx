// src/components/pubg/PubgWeaponDetail.tsx — 2026-10-06 `app/pubg/weapon/[key]/page.tsx`에서 본문 이관(LoL `LolItemDetail`·
// TFT `TftUnitDetail`과 같은 자리). 페이지는 로드·정적 경로만 맡는다. 이하 원 헤더:
// PUBG 무기 상세 — 승인 아티팩트 §4 "항목상세 스플래시"의 `무기` 탭. 사용자 지시
// ("총기류, 맵류의 상세화면 전환 및 스플레시아트 디자인이 누락됨. 보완진행", 2026-09-17).
//
// output:'export'라 generateStaticParams가 필수다. 집계가 없으면 `_placeholder` 1건을 남긴다 —
// 빈 배열을 반환하면 `next build`가 즉시 실패한다(2026-09-05 실측, `/item/[id]`와 동일).
//
// **2026-10-06 상세 공통 관측 섹션**(사용자 확정 — PLAN-detail-observation-section-2026-10-06.md): 「추정 원인(LLM)」
// 카드와 「이렇게 판정했습니다」 카드를 LoL 기준의 공통 섹션(`ObservationSection`) 패널 하나로 흡수했다. 판정 문장
// (2026-09-19 사용자 지시 「자연어로 근거」)은 패널의 첫 줄에 서고, 원천(집계 경로·표본 매치)은 그 아래 원천 칸이다.
// **판정이 서지 않은 무기는 관측을 그리지 않는다** — 9/18 라운드6 C1(「직접 연 상세에서는 관측값과 판정 보류 사유를
// 말한다」)은 사용자 재확인(2026-10-06 「표본부족, 바닥미달은 분명히 보여주지 말라고 했는데?」)으로 대체됐다.
// 머리 문장도 사유(표본 부족·바닥 미달)를 꺼내지 않고, 스플래시는 렌더 이미지만 든다(수치는 관측 섹션의 몫이다).
import { buildPubgEvidenceProse } from "@/components/pubg/evidenceProse";
import Link from "next/link";
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import { detailCrumbs } from "@/lib/breadcrumbs";
import SectionCard from "@/components/SectionCard";
import ItemChart from "@/components/item/ItemChart";
import SourceMatchesPanel from "@/components/item/SourceMatchesPanel";
import { valuesChartData } from "@/components/item/chartData";
import ObservationCauses from "@/components/observation/ObservationCauses";
import ObservationPanel from "@/components/observation/ObservationPanel";
import ObservationSection from "@/components/observation/ObservationSection";
import { ALL_SEGMENT } from "@/components/observation/observationModel";
import { ANNOUNCED_RATIO_BAND, PICKUP_MIN_N, pubgNotesAsPatchNotes, type PubgDeltaRow } from "@/pipeline/match/pubg-delta";
import StatusBadge from "@/components/StatusBadge";
import SubmarineDetailBlock from "@/components/gamedata/SubmarineDetailBlock";
import { delayedChangesFor, loadGameDataDiff, noteMismatchChangesFor, submarineChangesFor } from "@/lib/gamedata";
import PubgDetailSplash from "@/components/pubg/PubgDetailSplash";
import { PubgFooter, PubgUnavailable, pct, signedPct } from "@/components/pubg/shared";
import { isReportable, loadPubgAssets, type PubgBundle, type PubgDeclaration } from "@/lib/pubgData";
import { displayStatusOf } from "@/pipeline/shared/display-status";
import { weaponKeyFromSlug } from "@/lib/pubgRoutes";
import { publicWeaponPath } from "@/pipeline/pubg/asset-path";
import { weaponCategoryLabel } from "@/pipeline/aggregate/pubg-weapon-key";
import ExternalLink from "@/components/ExternalLink";
import { pubgVerdictCount } from "@/pipeline/shared/headline";

/** PUBG 통계 게이트 행 — 이 게임 판정이 실제로 쓰는 것(획득 표본 하한 · 상대 변화 로그비 CI · 공지 밴드/자체 바닥).
 * BH-FDR을 쓰지 않으므로 q를 말하지 않는다(#74에서 바로잡은 「판정 엔진 게임 무관」 과장과 같은 이유). */
function pubgGateRows(row: PubgDeltaRow, noteMatched: boolean, effectFloor: number | undefined): { label: string; value: string }[] {
  const gate = [
    { label: "n(전) 획득", value: row.n.before.toLocaleString() },
    { label: "n(후) 획득", value: row.n.after.toLocaleString() },
    { label: "획득 최소 표본", value: `n≥${PICKUP_MIN_N} · 통과` },
    { label: "상대 변화 95% CI", value: `[${signedPct(row.relCi[0])}, ${signedPct(row.relCi[1])}]` },
  ];
  if (noteMatched) {
    gate.push({ label: "공지 일치 밴드", value: `기대 변화의 ${ANNOUNCED_RATIO_BAND[0]}~${ANNOUNCED_RATIO_BAND[1]}배` });
  } else if (effectFloor !== undefined) {
    gate.push({ label: "효과크기 바닥", value: `±${pct(effectFloor, 1)}` });
  }
  return gate;
}

export default function PubgWeaponDetail({
  slug,
  bundle,
  declaration,
}: {
  slug: string;
  bundle: PubgBundle | null;
  declaration: PubgDeclaration | null;
}) {
  if (!bundle) {
    return (
      <main>
      <Container>
        <PubgUnavailable failure={declaration?.failure} />
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
  // 이 무기를 말한 조항 전부 — 대조표 좌 내비와 같은 집합(`matchedNoteIds`). 대표(`note`)는 머리 문장에만 쓴다.
  const mentionedNotes = row ? notes.filter((n) => row.matchedNoteIds.includes(n.id)) : [];
  // 원인 문장이 인용한 노트 — 엔진과 **같은 변환**을 써야 id가 맞는다(사본 금지).
  const notesById = new Map(
    pubgNotesAsPatchNotes(notes, (key) => deltas.rows.find((r) => r.weaponKey === key)?.weaponName ?? null).map(
      (n) => [n.id, n] as const
    )
  );

  // 수치 축(F9) — PUBG는 게임사가 수치 파일을 배포하지 않아 텔레메트리 피해 격자를 대조한다.
  const gameData = loadGameDataDiff("pubg", deltas.meta.from, deltas.meta.to);
  const submarineChanges = submarineChangesFor(gameData, "weapon", weaponKey);
  // PUBG 어댑터는 직전 노트를 보지 않아 지금은 비어 있다 — 공용 블록의 계약을 그대로 따른다.
  const delayedChanges = delayedChangesFor(gameData, "weapon", weaponKey);
  const mismatchChanges = noteMismatchChangesFor(gameData, "weapon", weaponKey);

  // 자산 유무를 **빌드 타임에** 판정한다 — 없는 무기가 실제로 9종 있다(RPD 포함).
  const assets = loadPubgAssets();
  const hasRender = assets?.weapons.includes(weaponKey) ?? false;

  // 보고 자격은 PUBG 판정 경로의 같은 자리 술어(`isReportable`)가 정한다 — PUBG 판정기는 바닥·CI를 이미 상태에
  // 접어 넣는다(classify). 자격이 없으면 관측 섹션은 탭을 만들지 않는다.
  const judged = row !== null && isReportable(row.status);
  const noteMatched = row?.matchedNoteId != null;
  const metrics =
    row && judged
      ? [
          {
            key: "pickupShare",
            label: "획득 점유율",
            segments: [
              {
                key: ALL_SEGMENT,
                label: "전체",
                panel: (
                  <ObservationPanel
                    badge={<StatusBadge status={displayStatusOf(row.status)} />}
                    before={pct(statBefore?.share ?? 0, 2)}
                    after={pct(statAfter.share, 2)}
                    delta={
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          (row.relChange ?? 0) > 0 ? "text-success" : (row.relChange ?? 0) < 0 ? "text-danger" : "text-muted"
                        }`}
                      >
                        {signedPct(row.relChange ?? 0)} (상대)
                      </span>
                    }
                    chart={
                      <ItemChart
                        data={valuesChartData(
                          statBefore?.share ?? null,
                          statAfter.share,
                          [pct(statBefore?.share ?? 0, 2), pct(statAfter.share, 2)],
                          deltas.meta.from,
                          deltas.meta.to
                        )}
                      />
                    }
                    chartCaption={`상대 변화 95% CI [${signedPct(row.relCi[0])}, ${signedPct(row.relCi[1])}]`}
                    prose={buildPubgEvidenceProse({
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
                    })}
                    gate={pubgGateRows(row, noteMatched, deltas.meta.effectFloor)}
                    gateLink={{ href: "/pubg/methodology/#gates", label: "판정 규칙 보기 →" }}
                    source={
                      <SourceMatchesPanel matchIds={row.evidence.matchIds} aggregatePath={row.evidence.aggregatePath} />
                    }
                    causes={
                      <ObservationCauses
                        causes={row.causes ?? []}
                        llm={row.llm}
                        notesById={notesById}
                        generatedAt={deltas.meta.generatedAt}
                        noteMatched={noteMatched}
                      />
                    }
                  />
                ),
              },
            ],
          },
        ]
      : [];

  return (
    <main>
      <Container>
      <div className="flex flex-col gap-6 pt-12 pb-8">

        {/* 이동 경로 + h1은 `PageHeader`가 소유한다(§8-7 #1·#8): 전에는 이 화면에 h1이 없고
            이동 경로 구분자도 `/`라 다른 두 게임과 달랐다. 스플래시 카드는 그 아래 시각 블록이다.
            **유형 라벨과 판정 뱃지도 머리에 있어야 한다**(§8-1) — 전에는 둘 다 히어로 아래 카드로
            밀려 있어 같은 자리를 세 게임에서 열면 PUBG만 머리가 비어 보였다(2026-09-23 화면 대조 V3).
            판정이 서지 않은 무기는 뱃지 대신 그 사유를 한 줄로 말한다. */}
        <PageHeader
          crumbs={detailCrumbs("pubg", statAfter.weaponName)}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {hasRender ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={publicWeaponPath(weaponKey)}
                  alt=""
                  aria-hidden="true"
                  className="h-12 w-24 object-contain"
                />
              ) : null}
              {statAfter.weaponName}
            </span>
          }
          titleAside={
            <span className="flex items-center gap-2">
              {`무기 · ${weaponCategoryLabel(weaponKey)}`}
              {row && judged ? <StatusBadge status={displayStatusOf(row.status)} /> : null}
            </span>
          }
          lead={
            row && judged ? (
              <>
                {deltas.meta.from} → {deltas.meta.to} 획득 점유율{" "}
                <strong className="text-fg">{pct(row.before ?? 0, 2)}</strong> →{" "}
                <strong className="text-fg">{pct(row.after ?? 0, 2)}</strong> (
                {signedPct(row.relChange ?? 0)})
                {note ? ` · 공지 “${note.summary}” 대조` : ` · ${deltas.meta.to} 패치노트에 이 무기 항목 없음`}
              </>
            ) : (
              // 판정이 서지 않은 사유(표본 부족·바닥 미달·변화 없음)를 꺼내지 않는다 — 9/18 확정 규칙(2026-10-06 재확인).
              `${deltas.meta.from} → ${deltas.meta.to} 보고할 획득 점유율 변화가 없습니다.`
            )
          }
          // 액션 줄 없음(2026-10-08 사용자 결정, LolItemDetail 주석 참고) — §7-1 바인딩 상세 = 없음(열람).
        />

        {/* 유형·이름·판정은 위 머리가 소유한다(§8-1) — 여기 다시 그리면 한 화면에서
            이름이 세 번 반복된다. 이 카드는 렌더 이미지와 수치만 든다. */}
        <PubgDetailSplash
          imageSrc={hasRender ? publicWeaponPath(weaponKey) : null}
          fit="contain"
          fallbackMark={statAfter.weaponName}
          stats={[]}
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
              말한 것 {mentionedNotes.length} · 말하지 않은 것 {submarineChanges.length}
              {mismatchChanges.length > 0 ? ` · 값이 다른 것 ${mismatchChanges.length}` : ""}
            </span>
          }
        >
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <span className="h-1.5 w-1.5 rounded-pill bg-muted" aria-hidden="true" />
            <h3 className="font-body text-xs font-bold tracking-wide text-muted">패치노트가 말한 것</h3>
          </div>
          {mentionedNotes.length > 0 ? (
            // **이 무기를 말한 조항 전부**(ST-21, site-review pubg-S3) — 전에는 대표 노트 1줄만 실어 대조표(RPD 4줄)와 어긋났다.
            // 기대값이 없는 조항(조준 전환·반동·차량 피해)은 이 데이터로 측정할 수 없어 회색으로, 사유와 함께.
            <ul className="flex flex-col gap-2 px-5 pb-4">
              {mentionedNotes.map((n) => {
                const measurable = n.expectedRelChange !== null;
                return (
                  <li key={n.id} className="flex flex-col gap-0.5">
                    <span className={`text-sm ${measurable ? "text-fg-2" : "text-muted"}`}>
                      {n.summary}
                      {measurable ? null : <span className="ml-2 font-mono text-xs text-muted">이 데이터로 측정 불가</span>}
                    </span>
                    <ExternalLink href={n.anchorUrl} className="w-fit font-mono text-xs text-accent hover:underline">
                      원문 ↗
                    </ExternalLink>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 pb-4 text-sm text-muted">
              {deltas.meta.to} 패치노트에 이 무기를 언급한 항목이 없습니다.
            </p>
          )}

          <div className="border-t border-border-soft" />

          <SubmarineDetailBlock
            changes={submarineChanges}
            mismatchChanges={mismatchChanges}
            delayedChanges={delayedChanges}
            source={gameData?.meta.source ?? null}
            notePatch={deltas.meta.to}
            patch={gameData ? { from: gameData.meta.from, to: gameData.meta.to } : null}
          />
        </SectionCard>

        <ObservationSection
          metrics={metrics}
          initial={metrics.length > 0 ? { metric: "pickupShare", segment: ALL_SEGMENT } : null}
          segmentLabel={null}
          noSegmentNote="구간 축 없음 — 맵별 판정은 내지 않습니다"
          emptyText="보고할 관측이 없습니다."
        />

        <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={pubgVerdictCount(deltas.rows)} />
      </div>
    </Container>
    </main>
  );
}
