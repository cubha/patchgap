// src/components/detail/LolItemDetail.tsx
// **대상 상세** — 판정 헤더·패치노트 대조·LLM 추정 원인 + **지표마다 한 구획**(차트·통계
// 게이트·원천 매치). UX-BRIEF §3 "03 항목 상세", 프로토타입 `03-item-detail.html`.
//
// **2026-09-23 라우트 단위 변경**(§8-7 #10 · §8-5 「라우트 단위도 대상」): 전에는 이 화면이
// **지표 하나**였다 — `champion~MonkeyKing~JUNGLE~winRate`. 같은 챔피언을 보려면 지표마다 다른
// URL을 열어야 했고, TFT·PUBG는 이미 대상 단위여서 세 게임이 어긋났다. 이제 한 대상이 한 화면이고
// 지표는 그 안의 구획이다. 구 지표 경로는 **별칭으로 살아 있다**(`detailRouteSlugs` 주석 참고) —
// 이미 디스코드로 나간 링크를 죽이지 않기 위해서다.
//
// **2026-09-28 본문 이동(이월 R8)**: 이 본문은 `app/lol/item/[id]/page.tsx`에 있었다. 과거 쌍 상세
// (`/lol/history/[pair]/item/[id]/`)가 같은 화면을 그리려고 컴포넌트로 옮겼고, **어느 쌍들을 볼지**(`pairs`)와
// 이동 경로의 기준(`pairBase`)을 인자로 받는다 — 평소 상세는 전 쌍, 과거 쌍 상세는 그 쌍 하나만 본다(그래야
// 과거 쌍에서 누른 링크가 「판정이 선 첫 쌍」인 최신 쪽으로 튀지 않는다). 정적 파라미터는 각 라우트가 소유한다.
// 헤더는 ST-10부터 src/app/layout.tsx가 전역 렌더한다(여기서 다시 렌더하면 중복).
//
// id 포맷(types.ts DeltaRecord 주석)엔 ":"이 포함돼 URL 세그먼트로 그대로 쓰기 애매하다.
// **2026-09-05 근본 수정(오케스트레이터 지시)**: 처음엔 `encodeURIComponent`로 퍼센트
// 인코딩했으나, `out/`를 정적 파일 서버(Vercel과 동일한 "URL 1회 디코드 후 파일 매칭" 규칙)로
// 직접 서빙해 실측하니 단일 인코딩·원문 콜론 둘 다 404, 이중 인코딩만 200이 나와 — 즉
// 퍼센트 인코딩을 슬러그에 쓰는 한 배포 시 링크가 전부 깨지는 근본 문제였다. `src/lib/format.ts`의
// `itemSlug`/`itemIdFromSlug`(`:`↔`~` 문자 치환, 퍼센트 인코딩 자체를 쓰지 않음)로 교체했다.
//
// 같은 id가 여러 패치 쌍에 걸쳐 나타날 수 있다(엔티티+지표 조합은 패치 쌍을 포함하지 않는 id
// 포맷이라 원리적으로 충돌 가능) — `pairs`가 최신 우선 내림차순이므로 최신 쌍을 먼저
// 찾아 그 쌍의 레코드를 대표로 쓴다(구현 결정, ST-12.md 참고).
//
// **2026-10-06 상세 공통 관측 섹션**(사용자 확정 — PLAN-detail-observation-section-2026-10-06.md): 지표마다 카드 한
// 장씩 쌓던 구획을 **지표 탭 × 라인 선택 → 패널 하나**(`ObservationSection`)로 바꿨다. 세 게임 상세가 같은 섹션을
// 쓰고, 이 화면이 그 기준(LoL 기준 통일)이다. 바뀐 것 셋:
//   ① 탭·선택지는 **보고 자격 조합만**(`lolObservationModel` → `isReportableRecord`). 전에는 이 술어를 거치지 않아
//      아트록스 한 화면에 카드 13장(포지션별 승률 「표본 부족」 n=1~316 포함)을 그렸다 — 걸러내면 1건이다.
//   ② 대상 단위 「추정 원인」 카드를 없애고 원인을 **그 지표·구간 패널 안**으로 옮겼다(원인은 델타 단위로 물었다).
//   ③ 패치노트 대조가 좌우 2분할에서 **전체 폭**이 됐다(TFT·PUBG와 같은 한 줄).

import Link from "next/link";
import Container from "@/components/Container";
import DeltaValue from "@/components/DeltaValue";
import EntityIcon from "@/components/EntityIcon";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import SubmarineDetailBlock from "@/components/gamedata/SubmarineDetailBlock";
import { loadGameDataDiff, noteMismatchChangesFor, submarineChangesFor } from "@/lib/gamedata";
import { DISPLAY_SORT_PRIORITY, displayStatus, isNoiseStatus } from "@/pipeline/shared/display-status";
import { loadChampions, loadDeltas, loadDeltasRaw, loadItems, loadNotes, type PatchPair } from "@/lib/data";
import { entityTypeLabel, fmtCiHalf, fmtInt, itemIdFromSlug } from "@/lib/format";
import { WIN_RATE_MIN_N } from "@/pipeline/aggregate/stats";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { loadDdragonSafe } from "@/pipeline/match/ddragon";
import AmbientDetailSplash from "@/components/item/AmbientDetailSplash";
import ItemChart from "@/components/item/ItemChart";
import NoteContrastPanel from "@/components/item/NoteContrastPanel";
import SourceMatchesPanel from "@/components/item/SourceMatchesPanel";
import { buildChartData } from "@/components/item/chartData";
import { formatCiRange, formatMetricValue, metricKind } from "@/components/item/metricFormat";
import { resolveNoteContrast } from "@/components/item/noteContrast";
import { resolveStoredCi } from "@/components/item/storedCi";
import { snapshotHash } from "@/components/item/snapshotHash";
import { championSplashUrl } from "@/components/item/detailSplash";
import SiteFooter from "@/components/SiteFooter";
import PageHeader from "@/components/PageHeader";
import { detailCrumbs } from "@/lib/breadcrumbs";
import ObservationCauses from "@/components/observation/ObservationCauses";
import ObservationPanel from "@/components/observation/ObservationPanel";
import ObservationSection from "@/components/observation/ObservationSection";
import {
  ALL_SEGMENT,
  lolObservationModel,
  lolSelectionFromId,
  resolveSelection,
  type ObservationModel,
} from "@/components/observation/observationModel";

export interface LolItemDetailProps {
  /** 라우트 파라미터 그대로(정준 `champion~Ahri` · 구 지표 별칭 · `_placeholder`). */
  id: string;
  /** 이 화면이 볼 패치 쌍(최신 우선). 평소 상세는 전 쌍, 과거 쌍 상세는 그 쌍 하나. */
  pairs: readonly PatchPair[];
  /** 과거 쌍 화면이면 그 기준 경로(`/lol/history/{쌍}`) — 이동 경로가 그 쌍 안에 머문다. */
  pairBase?: string | null;
}

interface FoundEntity {
  pair: PatchPair;
  /** 이 대상의 행 전부(노이즈 포함) — 패치노트 대조·수치 축이 대상 단위로 읽는다. 관측 섹션은 `model`만 본다. */
  rows: DeltaRecord[];
  /** 보고 자격 조합만 묶은 관측 모델(탭 × 라인). */
  model: ObservationModel<DeltaRecord>;
  generatedAt: string;
  qAlpha?: number;
  /** 그 쌍의 판정 행 수 — 푸터 「판정 N건」. 브리핑·대조표·TFT·PUBG 상세와 같은 쌍 단위로 센다(전에는 이 화면만
   * 대상의 행 수를 넘겨 같은 푸터가 화면마다 다른 것을 셌다). */
  pairVerdicts: number;
}

/**
 * generateStaticParams가 넘긴 슬러그를 원래 DeltaRecord.id로 복원한다. 슬러그(`itemSlug`)는
 * `~` 문자 치환만 쓰고 퍼센트 인코딩을 전혀 안 하지만, Next.js가 라우트 파라미터를 내부적으로
 * `encodeURIComponent`할 가능성에 대비해 `decodeURIComponent`를 한 번 방어적으로 거친다 —
 * 슬러그 자체엔 `%`가 없으므로 이 호출은 대개 no-op이고, 안전을 위한 방어선일 뿐이다(이전의
 * "반복 디코딩" 루프는 애초에 퍼센트 인코딩을 썼을 때만 필요했던 우회였으므로 제거).
 */
function decodeIdParam(id: string): string {
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    decoded = id;
  }
  return itemIdFromSlug(decoded);
}

/**
 * 이 슬러그가 가리키는 **대상**과 그 대상의 관측 전부를 고른다.
 *
 * 슬러그는 두 형태를 받는다: 정준 `champion~MonkeyKing`과 구 지표 별칭
 * `champion~MonkeyKing~JUNGLE~winRate`. 둘 다 `champion:MonkeyKing`으로 접어 같은 화면을 그린다.
 *
 * 쌍 선택 우선순위(2026-10-06 갱신): **보고할 관측이 있는 쌍** → 판정이 선(노이즈 아닌) 쌍 → 아무 쌍.
 * 라우트 자격은 「어느 한 쌍에서라도 판정이 서면」 주는 합집합이다(2026-09-19 재판정 K2-4). 상태만 보고 고르면
 * 최신 쌍의 비유의 「공지」 행이 옛 쌍의 실제 관측을 이겨 섹션이 빈다 — 섹션이 그리는 기준(보고 자격)으로 고른다.
 */
function findEntity(rawId: string, pairs: readonly PatchPair[]): FoundEntity | null {
  // `champion:MonkeyKing:JUNGLE:winRate` → `champion:MonkeyKing`. 세그먼트 2개면 이미 대상 키다.
  const segments = rawId.split(":");
  const entityKey = segments.length <= 2 ? rawId : `${segments[0]}:${segments[1]}`;

  let judged: FoundEntity | null = null;
  let fallback: FoundEntity | null = null;
  for (const pair of pairs) {
    const deltas = loadDeltas(pair.from, pair.to);
    if (!deltas) continue;
    const rows = deltas.rows.filter((row) => `${row.entityType}:${row.entityKey}` === entityKey);
    if (rows.length === 0) continue;
    const found: FoundEntity = {
      pair,
      rows,
      model: lolObservationModel(rows, deltas.meta.qAlpha),
      generatedAt: deltas.meta.generatedAt,
      qAlpha: deltas.meta.qAlpha,
      pairVerdicts: deltas.rows.length,
    };
    if (found.model.count > 0) return found;
    if (rows.some((row) => !isNoiseStatus(row.status))) judged ??= found;
    fallback ??= found;
  }
  return judged ?? fallback;
}

/**
 * 머리 뱃지가 대표할 행 — 보고 자격 행 중 표시 우선순위 → |Δ| 순 첫 행. 자격 행이 없으면(공지됐지만 유의한
 * 변화가 없는 대상) 판정이 선 행 중에서 고른다 — 노이즈 상태를 뱃지로 올리지 않는다.
 */
function headRow(found: FoundEntity): DeltaRecord {
  const pool = found.model.count > 0
    ? found.model.metrics.flatMap((m) => m.segments.map((s) => s.item))
    : found.rows.filter((row) => !isNoiseStatus(row.status));
  const candidates = pool.length > 0 ? pool : found.rows;
  return [...candidates].sort(
    (a, b) =>
      DISPLAY_SORT_PRIORITY[displayStatus(a, found.qAlpha)] - DISPLAY_SORT_PRIORITY[displayStatus(b, found.qAlpha)] ||
      Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
  )[0];
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col">
      {/* 직전 페이지가 챔피언 상세였다면 배경에 남은 스플래시를 지운다. */}
      <AmbientDetailSplash url={null} />
      <main className="flex flex-1 items-center justify-center py-24 text-sm text-muted">
        표시할 항목 데이터가 없습니다.
      </main>
    </div>
  );
}

/** LoL 통계 게이트 행 — 이 게임 판정이 실제로 쓰는 것만(BH-FDR · 승률 최소 표본). */
function lolGateRows(row: DeltaRecord): { label: string; value: string }[] {
  const kind = metricKind(row.metric);
  const scale = kind === "pp" ? 100 : 1;
  const unit = kind === "pp" ? "%p" : kind === "sec" ? "s" : "";
  const gate = [
    { label: "n(전)", value: fmtInt(row.n.before) },
    { label: "n(후)", value: fmtInt(row.n.after) },
    {
      label: "관측 델타 CI(95%)",
      value: `${fmtCiHalf([row.ci[0] * scale, row.ci[1] * scale], kind === "pp" ? 1 : 0)}${unit}`,
    },
    { label: "BH-FDR q", value: row.q === null ? "—" : row.q.toFixed(3) },
  ];
  // 승률만 개체 표본 게이트가 걸린다(verdict.ts). 이 패널에 오는 행은 보고 자격을 통과했으므로 늘 통과다.
  if (row.metric === "winRate") gate.push({ label: "승률 최소 표본", value: `n≥${WIN_RATE_MIN_N} · 통과` });
  return gate;
}

export default function LolItemDetail({ id, pairs, pairBase = null }: LolItemDetailProps) {
  const rawId = id === "_placeholder" ? null : decodeIdParam(id);
  const found = rawId ? findEntity(rawId, pairs) : null;

  if (!rawId || !found) {
    return <EmptyState />;
  }

  const { pair, rows, model, generatedAt, qAlpha, pairVerdicts } = found;
  const head = headRow(found);
  const notes = loadNotes(pair.to);
  const notesById = new Map<string, PatchNoteItem>((notes?.items ?? []).map((item) => [item.id, item]));
  const ddragon = loadDdragonSafe();
  const championsFrom = loadChampions(pair.from)?.rows ?? null;
  const championsTo = loadChampions(pair.to)?.rows ?? null;
  const itemsFrom = loadItems(pair.from)?.rows ?? null;
  const itemsTo = loadItems(pair.to)?.rows ?? null;

  // 패치노트 대조는 **대상 단위**다 — 이 대상의 모든 관측이 짝지은 노트를 합쳐서 본다(선언 축이라 관측의 보고
  // 자격과 무관하다: 노트가 말한 것은 관측이 움직이지 않았어도 말한 것이다).
  const matchedNoteIds = Array.from(new Set(rows.flatMap((row) => row.matchedNoteIds)));
  const noteContrast = resolveNoteContrast(
    { matchedNoteIds, entityName: head.entityName },
    notes,
    pair.to
  );

  // 수치 축(F9) — 이 대상에서 **게임사가 바꿨는데 말하지 않은 것**. 지표 축(위 판정)과 직교한다.
  const gameData = loadGameDataDiff("lol", pair.from, pair.to);
  const submarineChanges = submarineChangesFor(gameData, head.entityType, head.entityKey);
  const mismatchChanges = noteMismatchChangesFor(gameData, head.entityType, head.entityKey);
  const rawDeltas = loadDeltasRaw(pair.from, pair.to);
  const hash = rawDeltas ? snapshotHash(rawDeltas) : undefined;
  const splashUrl = championSplashUrl(head);

  // 구간 축은 챔피언에만 있다(라인). 아이템·라인·오브젝트는 구간 없이 탭만.
  const hasLaneAxis = head.entityType === "champion";
  const panelFor = (row: DeltaRecord, segmentKey: string, segmentName: string) => {
    const kind = metricKind(row.metric);
    const storedCi = resolveStoredCi(row, ddragon, championsFrom, championsTo, itemsFrom, itemsTo);
    const chartData = buildChartData(row, pair.from, pair.to, false, storedCi);
    return (
      <ObservationPanel
        badge={<StatusBadge status={displayStatus(row, qAlpha)} />}
        before={formatMetricValue(row.before, kind)}
        after={formatMetricValue(row.after, kind)}
        delta={<DeltaValue delta={row.delta} ci={row.ci} kind={kind} />}
        segmentName={hasLaneAxis ? (segmentKey === ALL_SEGMENT ? "전체 라인" : segmentName) : undefined}
        chart={<ItemChart data={chartData} />}
        chartCaption={
          chartData.barCi
            ? `패치별 95% CI ${formatCiRange(chartData.barCi.before)} · ${formatCiRange(chartData.barCi.after)}`
            : `오차 막대: ${pair.to} 막대에 변화량의 95% CI`
        }
        gate={lolGateRows(row)}
        gateLink={{ href: "/lol/methodology/#gates", label: "판정 규칙 보기 →" }}
        source={
          <SourceMatchesPanel
            matchIds={row.evidence.matchIds}
            aggregatePath={row.evidence.aggregatePath}
            snapshotHash={hash}
          />
        }
        causes={
          <ObservationCauses
            causes={row.causes}
            llm={row.llm}
            notesById={notesById}
            generatedAt={generatedAt}
            noteMatched={row.matchedNoteIds.length > 0}
          />
        }
      />
    );
  };

  const metrics = model.metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    segments: metric.segments.map((segment) => ({
      key: segment.key,
      label: segment.label,
      panel: panelFor(segment.item, segment.key, segment.label),
    })),
  }));
  // 구 지표 별칭으로 들어왔으면 그 탭·라인으로 연다. 자격 없는 조합이면 기본 조합(숨긴 행을 그리지 않는다).
  const initial = resolveSelection(model, lolSelectionFromId(rawId));

  return (
    <div className="flex flex-1 flex-col">
      <AmbientDetailSplash url={splashUrl} />
      <main>
        {/* width="narrow"(1040px) — 전역 Container(1320px)는 그대로 두고 이 페이지만 좁힌다.
            1440px에서 우측 여백이 넓어져 .ambient-duo(상세 스플래시) 가시 면적이 실제로 늘어난다. */}
        <Container width="narrow" className="flex flex-col gap-6 py-8">
          {/* 제목은 **대상 이름**이다 — 지표를 붙이지 않는다(§8-5). 지표는 아래 관측 섹션의 탭이 말한다. */}
          <PageHeader
            crumbs={detailCrumbs("lol", head.entityName, pairBase)}
            title={
              <span className="flex flex-wrap items-center gap-4">
                <EntityIcon
                  entityType={head.entityType}
                  entityKey={head.entityKey}
                  name={head.entityName}
                  size={72}
                  className="rounded-md text-lg"
                />
                {head.entityName}
              </span>
            }
            titleAside={
              <span className="flex items-center gap-2">
                {entityTypeLabel(head.entityType)}
                {/* 대상의 행이 전부 노이즈인 쌍(과거 쌍 상세는 그 쌍 하나만 본다)이면 뱃지를 그리지 않는다 — 노이즈 상태를
                    뱃지로 올리지 않는다. */}
                {isNoiseStatus(head.status) ? null : <StatusBadge status={displayStatus(head, qAlpha)} />}
              </span>
            }
            lead={
              model.count > 0 ? (
                <>
                  {pair.from} → {pair.to} 보고할 관측 <strong className="text-fg">{model.count}</strong>건.
                  지표 탭{hasLaneAxis ? "과 라인 선택" : ""}으로 값·통계 게이트·원천 매치·추정 원인을 봅니다.
                </>
              ) : (
                // 숨긴 상태의 사유(표본 부족·바닥 미달·변화 없음)를 꺼내지 않는다 — 9/18 확정 규칙(10/6 재확인).
                <>
                  {pair.from} → {pair.to} 보고할 관측이 없습니다. 패치노트가 말한 것은 아래 대조에서 볼 수 있습니다.
                </>
              )
            }
            actions={
              // §8-7 #18: 이 액션 줄이 LoL 상세에만 있었다. 자리는 `PageHeader`가 소유하므로
              // 세 게임이 같은 위치에 둘 수 있다.
              <Link
                href="/lol/methodology/#discord"
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-accent-on hover:opacity-90"
              >
                방송 규칙 보기 →
              </Link>
            }
          />

          {/* 선언 대조 — 전체 폭(2026-10-06). 「추정 원인」 카드가 있던 오른쪽 칸은 관측 패널 안으로 옮겼다. */}
          <SectionCard eyebrow="선언 대조" title="패치노트 대조" variant="glass">
            <NoteContrastPanel result={noteContrast} />
            <div className="border-t border-border-soft" />
            <SubmarineDetailBlock
              changes={submarineChanges}
              mismatchChanges={mismatchChanges}
              source={gameData?.meta.source ?? null}
              notePatch={pair.to}
              patch={gameData ? { from: gameData.meta.from, to: gameData.meta.to } : null}
            />
          </SectionCard>

          <ObservationSection
            metrics={metrics}
            initial={initial}
            segmentLabel={hasLaneAxis ? "라인" : null}
            emptyText="보고할 관측이 없습니다."
          />
        </Container>
        <Container>
          <SiteFooter game="lol" generatedAt={generatedAt} nVerdicts={pairVerdicts} />
        </Container>
      </main>
    </div>
  );
}
