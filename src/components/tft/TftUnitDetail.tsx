// src/components/tft/TftUnitDetail.tsx
// TFT 엔티티 상세 본문(2026-09-28 이월 R8 — `app/tft/unit/[key]/page.tsx`에서 옮겼다: 최신 쌍과 과거 쌍
// `/tft/history/[pair]/unit/[key]/`가 같은 본문을 쓴다. 로드·정적 파라미터는 라우트가, 행 집합은 `lib/pairPages`의
// `tftDetailRows`가 소유한다 — 과거 쌍 상세는 **그 쌍의 번들**만 본다).
// TFT 엔티티 상세 — LoL `/lol/item/*`·PUBG `/pubg/weapon/*`와 같은 자리다.
// 유닛뿐 아니라 특성·아이템도 여기로 들어온다(라우트 이름은 `unit`이지만 키에 종류가 들어 있다).
//
// **2026-10-06 상세 공통 관측 섹션**(사용자 확정 — PLAN-detail-observation-section-2026-10-06.md): 「지표별 변화」 3칸
// 그리드와 「추정 원인(LLM)」 카드를 LoL 기준의 공통 섹션(`ObservationSection`) 하나로 바꿨다 — 지표 탭(등장률·
// 순방률·평균 등수) → 패널 하나, 원인은 그 지표 패널 안. 보드는 위치를 갖지 않아 구간 선택은 없다. 자격 없는 지표는
// 탭을 만들지 않는다(전에는 「보고 자격을 얻은 관측 없음」 회색 칸으로 자리를 채웠다).

import Container from "@/components/Container";
import type { ObservedPairLink } from "@/components/ObservationPendingNotice";
import PageHeader from "@/components/PageHeader";
import EntityIcon from "@/components/EntityIcon";
import AmbientDetailSplash from "@/components/item/AmbientDetailSplash";
import ItemChart from "@/components/item/ItemChart";
import SourceMatchesPanel from "@/components/item/SourceMatchesPanel";
import { buildChartData } from "@/components/item/chartData";
import { publicTftAssetPath } from "@/pipeline/tft/asset-path";
import { detailCrumbs } from "@/lib/breadcrumbs";
import ExternalLink from "@/components/ExternalLink";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import SubmarineDetailBlock from "@/components/gamedata/SubmarineDetailBlock";
import ObservationCauses from "@/components/observation/ObservationCauses";
import ObservationPanel from "@/components/observation/ObservationPanel";
import ObservationSection from "@/components/observation/ObservationSection";
import { ALL_SEGMENT, groupObservations, resolveSelection } from "@/components/observation/observationModel";
import { TFT_METRICS, effectStrength } from "@/lib/tftEntityRows";
import { TftFooter, TftUnavailable, deltaDisplay, formatMetricValue } from "@/components/tft/shared";
import { entityTypeLabel, fmtInt, fmtQ, isLowerBetter, metricLabel, statusLabel } from "@/lib/format";
import { delayedChangesFor, loadGameDataDiff } from "@/lib/gamedata";
import { loadTftAssets, tftDeclarationSchedule, type TftBundle, type TftDeclaration } from "@/lib/tftData";
import { tftDetailRows } from "@/lib/pairPages";
import { displayStatus } from "@/pipeline/shared/display-status";
import type { DeltaRecord } from "@/pipeline/types";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";
import { entityKeyFromSlug as unslug } from "@/lib/tftRoutes";
import { verdictCount } from "@/pipeline/shared/headline";

// 슬러그 규칙은 `@/lib/tftRoutes`가 소유한다 — 라우트 파일에 두면 클라이언트 컴포넌트가
// 페이지 모듈을 import해야 하고, prop으로 넘기면 빌드가 막는다(2026-09-23 실측).

export interface TftUnitDetailProps {
  /** 라우트 파라미터 그대로(`unit~DA_18_Rakan`). */
  slug: string;
  /** 그 쌍의 관측 번들. 없으면 `declaration`의 사유를 말한다. */
  bundle: TftBundle | null;
  declaration: TftDeclaration | null;
  /** 과거 쌍 화면이면 그 기준 경로(`/tft/history/{쌍}`) — 이동 경로가 그 쌍 안에 머문다. */
  pairBase?: string | null;
  /** 관측 전일 때 관측이 있는 최신 쌍으로 가는 링크(ST-16). */
  observed?: ObservedPairLink | null;
}

/**
 * 변화량 95% CI — LoL 캡션과 같은 서식(`[+3.2, +4.3]%p`, 2026-10-07 화면 대조 V2b). 평균 등수만 단위가 「등」이다
 * (`deltaDisplay`와 같은 구분).
 */
function tftCiRange(record: DeltaRecord): string {
  const placement = record.metric === "avgPlacement";
  const fmt = (v: number) => {
    const shown = placement ? Math.abs(v).toFixed(2) : Math.abs(v * 100).toFixed(1);
    return `${v >= 0 ? "+" : "−"}${shown}`;
  };
  return `[${fmt(record.ci[0])}, ${fmt(record.ci[1])}]${placement ? "등" : "%p"}`;
}

/** TFT 통계 게이트 행 — 이 게임 판정이 실제로 쓰는 것(보드 표본 · BH-FDR · 효과크기 바닥 대비 배수). */
function tftGateRows(record: DeltaRecord): { label: string; value: string }[] {
  const gate = [
    { label: "n(전) 보드", value: fmtInt(record.n.before) },
    { label: "n(후) 보드", value: fmtInt(record.n.after) },
    { label: "BH-FDR", value: fmtQ(record.q) ?? "—" },
    { label: "바닥 대비", value: `${effectStrength(record).toFixed(2)}배` },
  ];
  if (isLowerBetter(record.metric)) gate.push({ label: "방향", value: "낮을수록 좋음" });
  return gate;
}

export default function TftUnitDetail({ slug, bundle, declaration, pairBase = null, observed = null }: TftUnitDetailProps) {
  if (!bundle) {
    // 관측 전에도 골격(이동 경로·푸터)과 관측이 있는 쌍으로 가는 링크를 유지한다(ST-16).
    return (
      <main>
        <Container>
          <TftUnavailable failure={declaration?.failure} schedule={tftDeclarationSchedule(declaration ?? null)} crumbs={detailCrumbs("tft", "관측 전", pairBase)} observed={observed} />
        </Container>
        {declaration ? <TftFooter generatedAt={declaration.generatedAt} nVerdicts={0} /> : null}
      </main>
    );
  }

  const { deltas, notes } = bundle;
  // 출처 줄("대조 원본: Community Dragon 18.1 → 18.2")의 재료 — 행 조립과 달리 meta가 필요하다.
  const gameData = loadGameDataDiff("tft", deltas.meta.from, deltas.meta.to);
  const rows = tftDetailRows(bundle);
  const row = rows.find((r) => r.key === unslug(slug));

  if (!row) {
    return (
      <main>
        <Container>
          {/* 빈 상태에도 **같은 머리**를 쓴다 — 이동 경로가 여기서만 다른 형식이 되면 §8-5가 깨진다. */}
          <div className="flex flex-col gap-3 pt-40 pb-8">
            <PageHeader
              crumbs={detailCrumbs("tft", "보고할 관측 없음", pairBase)}
              title="보고할 관측이 없는 대상입니다"
              lead="이 키에는 통계 게이트와 효과크기 바닥을 통과한 관측이 없습니다. 없는 것을 지어내지 않습니다."
            />
          </div>
        </Container>
      </main>
    );
  }

  const assets = loadTftAssets();
  // `unit:DA_18_Rakan` → `DA_18_Rakan`. 자산 파일명은 키의 뒷조각이다.
  const entityKeyOnly = row.key.slice(row.key.indexOf(":") + 1);
  // 유닛만 스플래시가 있다(특성·아이템은 아이콘뿐) — 없는 자산을 배경으로 올리지 않는다.
  const splashUrl =
    row.entityType === "unit" && assets?.assets.unit.includes(entityKeyOnly)
      ? publicTftAssetPath("unit", entityKeyOnly)
      : null;

  // 이 엔티티에 걸린 패치노트 — 이름 정확일치(판정과 같은 규칙).
  const matchedNotes = notes.items.filter((n) => n.entity === row.name);

  // 관측 섹션 — 행의 칸(`cells`)은 이미 보고 자격을 통과한 관측만 담는다(`buildTftEntityRows`가 `isReportableRecord`로
  // 거른다). 추정 원인은 **지표마다** 따로 물었으므로(LLM 2단은 델타 단위) 그 지표 패널 안에 둔다.
  const notesById = new Map(notes.items.map((n) => [n.id, n] as const));
  const qAlpha = deltas.meta.qAlpha;
  const records = TFT_METRICS.flatMap((metric) => {
    const record = row.cells[metric];
    return record ? [record] : [];
  });
  const model = groupObservations(records, {
    metricOf: (record) => record.metric,
    segmentOf: () => ALL_SEGMENT,
    metricLabel: (key) => metricLabel(key),
    segmentLabel: () => "전체",
    metricOrder: TFT_METRICS,
    segmentOrder: [ALL_SEGMENT],
  });
  const panelFor = (record: DeltaRecord) => {
    const d = deltaDisplay(record.metric, record.delta ?? 0);
    const before = formatMetricValue(record.metric, record.before ?? 0);
    const after = formatMetricValue(record.metric, record.after ?? 0);
    return (
      <ObservationPanel
        badge={<StatusBadge status={displayStatus(record, qAlpha)} />}
        before={before}
        after={after}
        delta={<span className={`font-mono text-sm font-bold tabular-nums ${d.improved ? "text-success" : "text-danger"}`}>{d.text}</span>}
        chart={
          <ItemChart
            data={{ ...buildChartData(record, deltas.meta.from, deltas.meta.to), valueText: [before, after] }}
          />
        }
        // 변화량의 95% CI는 막대 아래 캡션이 말한다(시안 배치 — LoL과 같은 자리, 2026-10-07 화면 대조 V2).
        chartCaption={`Δ 95% CI ${tftCiRange(record)} · 오차 막대: 변화량 CI`}
        gate={tftGateRows(record)}
        gateLink={{ href: "/tft/methodology/#gates", label: "판정 규칙 보기 →" }}
        source={<SourceMatchesPanel matchIds={record.evidence.matchIds} aggregatePath={record.evidence.aggregatePath} />}
        causes={
          <ObservationCauses
            causes={record.causes}
            llm={record.llm}
            notesById={notesById}
            generatedAt={deltas.meta.generatedAt}
            noteMatched={record.matchedNoteIds.length > 0}
          />
        }
      />
    );
  };
  const metrics = model.metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    segments: metric.segments.map((segment) => ({ key: segment.key, label: segment.label, panel: panelFor(segment.item) })),
  }));

  return (
    <main>
      <Container>
        <div className="flex flex-col gap-6 pt-40 pb-8">
          {/* 제목은 **대상 이름**이고 유형은 옆 라벨이다(§8-5). 이동 경로·액션 줄의 자리는
              `PageHeader`가 소유한다 — 세 게임이 같은 위치에 둔다(§8-7 #1·#8·#18). */}
          {/* 상세 스플래시 — TFT 화면의 이미지는 **0건**이었다(§8-7 말미). 자산이 실재하는 지금
              LoL 상세와 같은 배경 레이어를 켠다. 없는 대상은 `null`이라 배경이 지형만 남는다. */}
          <AmbientDetailSplash url={splashUrl} />
          <PageHeader
            crumbs={detailCrumbs("tft", row.name, pairBase)}
            title={
              <span className="flex flex-wrap items-center gap-3">
                <EntityIcon
                  game="tft"
                  entityType={row.entityType}
                  entityKey={entityKeyOnly}
                  name={row.name}
                  size={72}
                  assetMissing={!assets?.assets[row.entityType as "unit" | "trait" | "item"]?.includes(entityKeyOnly)}
                  className="rounded-md text-lg"
                />
                {row.name}
              </span>
            }
            titleAside={
              <span className="flex items-center gap-2">
                {entityTypeLabel(row.entityType)}
                <StatusBadge status={row.status} />
              </span>
            }
            lead={
              <>
                {deltas.meta.from} → {deltas.meta.to} · 판정{" "}
                <strong className="text-fg">{statusLabel(row.status)}</strong>
                {matchedNotes.length === 0 ? " · 패치노트에 이 대상을 언급한 항목이 없습니다" : null}
              </>
            }
            // 액션 줄 없음(2026-10-08 사용자 결정, LolItemDetail 주석 참고) — §7-1 바인딩 상세 = 없음(열람).
          />

          {/* B안(2026-09-21 사용자 확정) — 선언 카드를 「패치노트 대조」로 바꾸고 두 구획을 둔다.
              잠수함은 선언과 **같은 축이고 방향만 반대**라서(바꿨는데 말하지 않았다) 옆자리가 맞다.
              카드를 하나 더 만드는 A안을 기각한 이유: 두 줄이 붙어 있어야 "말한 건 이건데 그럼
              잠수함은 뭐냐"가 질문이 되기 전에 닫힌다. LoL 아이템 상세가 이미 이 제목을 쓴다. */}
          <SectionCard
            eyebrow="선언 대조"
            title="패치노트 대조"
            variant="glass"
            action={
              <span className="font-mono text-xs text-muted">
                말한 것 {matchedNotes.length} · 말하지 않은 것 {row.submarineChanges.length}
                {row.mismatchChanges.length > 0 ? ` · 값이 다른 것 ${row.mismatchChanges.length}` : ""}
              </span>
            }
          >
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <span className="h-1.5 w-1.5 rounded-pill bg-muted" aria-hidden="true" />
              <h3 className="font-body text-xs font-bold tracking-wide text-muted">패치노트가 말한 것</h3>
              <span className="ml-auto font-mono text-xs text-muted">{matchedNotes.length}건</span>
            </div>
            {matchedNotes.length === 0 ? (
              <p className="px-5 pb-4 text-sm text-muted">
                이 엔티티를 언급한 패치노트 항목이 없습니다. 아래 관측은 <strong className="text-fg">미공지 변화</strong>입니다.
              </p>
            ) : (
              <ul className={`flex flex-col ${PANEL_SCROLL_BODY}`}>
                {matchedNotes.map((n) => (
                  <li key={n.id} className="flex flex-col gap-1 px-5 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted">{n.direction}</span>
                      <span className="text-sm font-bold text-fg">{n.stat ?? "—"}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-fg-2">
                      {n.before ?? "—"} ⇒ {n.after ?? "—"}
                    </span>
                    <ExternalLink href={n.anchorUrl} className="w-fit font-mono text-xs text-accent hover:underline">
                      원문 ↗
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-border-soft" />

            <SubmarineDetailBlock
              changes={row.submarineChanges}
              mismatchChanges={row.mismatchChanges}
              delayedChanges={delayedChangesFor(gameData, row.entityType, row.key.split(":")[1] ?? "")}
              source={gameData?.meta.source ?? null}
              notePatch={deltas.meta.to}
              patch={gameData ? { from: gameData.meta.from, to: gameData.meta.to } : null}
            />
          </SectionCard>

          <ObservationSection
            metrics={metrics}
            initial={resolveSelection(model, null)}
            segmentLabel={null}
            noSegmentNote="구간 축 없음 — 보드는 위치를 갖지 않습니다"
            // 네 상세가 같은 한 줄이다(UX-BRIEF §8-3-1). 수치 축만 있는 대상의 기록은 위 대조 카드가 이미 말한다.
            emptyText="보고할 관측이 없습니다."
          />
        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={verdictCount(deltas.rows, deltas.meta.qAlpha)} />
    </main>
  );
}
