// src/app/lol/item/[id]/page.tsx
// **대상 상세** — 판정 헤더·패치노트 대조·LLM 추정 원인 + **지표마다 한 구획**(차트·통계
// 게이트·원천 매치). UX-BRIEF §3 "03 항목 상세", 프로토타입 `03-item-detail.html`.
//
// **2026-09-23 라우트 단위 변경**(§8-7 #10 · §8-5 「라우트 단위도 대상」): 전에는 이 화면이
// **지표 하나**였다 — `champion~MonkeyKing~JUNGLE~winRate`. 같은 챔피언을 보려면 지표마다 다른
// URL을 열어야 했고, TFT·PUBG는 이미 대상 단위여서 세 게임이 어긋났다. 이제 한 대상이 한 화면이고
// 지표는 그 안의 구획이다. 구 지표 경로는 **별칭으로 살아 있다**(`detailRouteSlugs` 주석 참고) —
// 이미 디스코드로 나간 링크를 죽이지 않기 위해서다.
// output:'export' 정적 배포이므로 generateStaticParams가 필수 — 모든 패치 쌍의 deltas rows에서
// id를 모은다(쌍이 0개면 `_placeholder` 1건 유지 — 실측(2026-09-05): output:'export'에서
// generateStaticParams가 빈 배열을 반환하면 `next build`가 즉시 실패한다).
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
// 포맷이라 원리적으로 충돌 가능) — listPatchPairs()가 최신 우선 내림차순이므로 최신 쌍을 먼저
// 찾아 그 쌍의 레코드를 대표로 쓴다(구현 결정, ST-12.md 참고).

import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Container from "@/components/Container";
import DeltaValue from "@/components/DeltaValue";
import EntityIcon from "@/components/EntityIcon";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import { detailRouteSlugs } from "@/lib/detailRoutes";
import SubmarineDetailBlock from "@/components/gamedata/SubmarineDetailBlock";
import { loadGameDataDiff, noteMismatchChangesFor, submarineChangesFor } from "@/lib/gamedata";
import { displayStatus, isNoiseStatus } from "@/pipeline/shared/display-status";
import { listPatchPairs, loadChampions, loadDeltas, loadItems, loadNotes, type PatchPair } from "@/lib/data";
import { entityTypeLabel, fmtInt, itemIdFromSlug } from "@/lib/format";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { loadDdragonSafe } from "@/pipeline/match/ddragon";
import AmbientDetailSplash from "@/components/item/AmbientDetailSplash";
import CausesPanel from "@/components/causes/CausesPanel";
import ItemChart from "@/components/item/ItemChart";
import NoteContrastPanel from "@/components/item/NoteContrastPanel";
import SourceMatchesPanel from "@/components/item/SourceMatchesPanel";
import StatsGatePanel from "@/components/item/StatsGatePanel";
import { buildChartData } from "@/components/item/chartData";
import {
  displayMetricLabel,
  formatCiRange,
  formatMetricValue,
  metricKind,
} from "@/components/item/metricFormat";
import { resolveNoteContrast } from "@/components/item/noteContrast";
import { resolveStoredCi } from "@/components/item/storedCi";
import { snapshotHash } from "@/components/item/snapshotHash";
import { championSplashUrl } from "@/components/item/detailSplash";
import SiteFooter from "@/components/SiteFooter";
import PageHeader from "@/components/PageHeader";
import { detailCrumbs } from "@/lib/breadcrumbs";
import { DISPLAY_SORT_PRIORITY } from "@/pipeline/shared/display-status";

interface ItemPageProps {
  params: Promise<{ id: string }>;
}

interface FoundEntity {
  pair: PatchPair;
  /** 이 대상의 관측 전부 — 표시 우선순위 → |Δ| 순. 구획 하나가 관측 하나다. */
  rows: DeltaRecord[];
  generatedAt: string;
  qAlpha?: number;
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
 * **판정이 선 쌍을 우선**한다(2026-09-19 재판정 K2-4). 라우트 자격은 「어느 한 쌍에서라도 판정이
 * 서면」 주는 합집합이라, 최신 쌍을 무조건 쓰면 옛 쌍에서 미공지였고 최신에서 노이즈가 된 대상이
 * 상세에서 "표본 부족"만 렌더한다 — 자격을 준 바로 그 쌍을 고르게 한다.
 */
function findEntity(rawId: string): FoundEntity | null {
  // `champion:MonkeyKing:JUNGLE:winRate` → `champion:MonkeyKing`. 세그먼트 2개면 이미 대상 키다.
  const segments = rawId.split(":");
  const entityKey = segments.length <= 2 ? rawId : `${segments[0]}:${segments[1]}`;

  let fallback: FoundEntity | null = null;
  for (const pair of listPatchPairs()) {
    const deltas = loadDeltas(pair.from, pair.to);
    if (!deltas) continue;
    const rows = deltas.rows.filter((row) => `${row.entityType}:${row.entityKey}` === entityKey);
    if (rows.length === 0) continue;
    // 표시 우선순위대로 — 첫 구획이 그 대상에서 가장 할 말이 많은 지표가 된다.
    const sorted = [...rows].sort(
      (a, b) =>
        DISPLAY_SORT_PRIORITY[displayStatus(a, deltas.meta.qAlpha)] -
          DISPLAY_SORT_PRIORITY[displayStatus(b, deltas.meta.qAlpha)] ||
        Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
    );
    const found: FoundEntity = {
      pair,
      rows: sorted,
      generatedAt: deltas.meta.generatedAt,
      qAlpha: deltas.meta.qAlpha,
    };
    if (sorted.some((row) => !isNoiseStatus(row.status))) return found;
    fallback ??= found;
  }
  return fallback;
}

/** deltas 파일 원문 텍스트(스냅샷 해시 계산용) — data.ts(loadDeltas)는 파싱된 객체만 반환하고
 * 원문 문자열은 버리므로, 해시 목적으로만 파일을 다시 읽는다(data.ts 미소유라 재구현). */
function readDeltasRaw(pair: PatchPair): string | null {
  const filePath = path.resolve(
    process.cwd(),
    "data",
    "aggregated",
    "deltas",
    `${pair.from}_${pair.to}.json`
  );
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
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

/**
 * 지표 하나 = 구획 하나. 전에는 이 내용이 **한 화면 전체**였다(라우트가 지표 단위였으므로).
 * 라우트가 대상 단위가 되면서 여기가 지표의 자리가 됐다 — 내용은 그대로다.
 */
function MetricSection({
  row,
  pair,
  qAlpha,
  ddragon,
  championsFrom,
  championsTo,
  itemsFrom,
  itemsTo,
  snapshot,
}: {
  row: DeltaRecord;
  pair: PatchPair;
  qAlpha?: number;
  ddragon: ReturnType<typeof loadDdragonSafe>;
  championsFrom: Parameters<typeof resolveStoredCi>[2];
  championsTo: Parameters<typeof resolveStoredCi>[3];
  itemsFrom: Parameters<typeof resolveStoredCi>[4];
  itemsTo: Parameters<typeof resolveStoredCi>[5];
  snapshot: string;
}) {
  const kind = metricKind(row.metric);
  // UX-BRIEF §1 불변 원칙: "승률은 n 게이트 미달 시 '표본 부족' 라벨(델타 미제시)" — 표본이 극히
  // 작으면 ci가 크게 벌어져 막대에 거대한 오차 막대가 붙는다. 값 자체는 계속 보여준다.
  const suppressDelta = row.status === "insufficient-sample";
  const storedCi = resolveStoredCi(row, ddragon, championsFrom, championsTo, itemsFrom, itemsTo);
  const chartData = buildChartData(row, pair.from, pair.to, suppressDelta, storedCi);

  return (
    <SectionCard eyebrow="관측" title={displayMetricLabel(row)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-soft px-5 py-4">
        <StatusBadge status={displayStatus(row, qAlpha)} />
        <span className="font-mono text-sm tabular-nums text-fg-2">
          {formatMetricValue(row.before, kind)} → {formatMetricValue(row.after, kind)}
        </span>
        {suppressDelta ? (
          <span className="text-xs font-bold text-muted">
            표본 부족 — 델타 미제시, n({fmtInt(row.n.before)}/{fmtInt(row.n.after)})
          </span>
        ) : (
          <DeltaValue delta={row.delta} ci={row.ci} kind={kind} />
        )}
      </div>

      {/* 이 지표에 대한 LLM 한 줄 — **지표 단위**라 여기가 제 자리다. 검증에 실패한 문장은
          회색이고, 실행되지 않았으면 그 사유를 말한다(무근거 회색 원칙). */}
      {row.llm ? (
        <p
          className={`border-b border-border-soft px-5 py-3 text-sm leading-relaxed ${
            row.llm.skipped || !row.llm.summaryVerified ? "text-muted" : "text-fg-2"
          }`}
        >
          {row.llm.skipped
            ? `LLM 미실행(${row.llm.reason ?? "사유 없음"})`
            : (row.llm.summary ?? "LLM이 이 변화를 설명할 조항을 찾지 못했습니다.")}
        </p>
      ) : null}

      <div className="max-w-xl">
        <ItemChart data={chartData} />
      </div>
      <div className="flex flex-wrap gap-4 border-t border-border-soft px-5 py-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-fg-2" aria-hidden="true" />
          전({pair.from})
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" />
          후({pair.to})
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--muted)" }} aria-hidden="true" />
          95% CI
          {chartData.barCi ? (
            <span className="font-mono">
              {formatCiRange(chartData.barCi.before)} · {formatCiRange(chartData.barCi.after)}
            </span>
          ) : null}
        </span>
      </div>

      {/* 통계 게이트·원천 매치는 **관측마다** 다르다 — 지표 구획 안에 둔다. 높이를 고정하고
          안에서 스크롤하는 규약은 그대로(원천 매치 ID 수에 따라 옆 카드가 늘어나지 않게). */}
      <div className="grid grid-cols-1 gap-px border-t border-border-soft bg-border-soft lg:grid-cols-2">
        <div className="flex h-64 flex-col bg-surface">
          <p className="px-5 pt-4 font-body text-xs font-bold text-muted">통계 게이트</p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <StatsGatePanel delta={row} kind={kind} />
          </div>
        </div>
        <div className="flex h-64 flex-col bg-surface">
          <p className="px-5 pt-4 font-body text-xs font-bold text-muted">원천 매치</p>
          <div className="flex min-h-0 flex-1 flex-col">
            <SourceMatchesPanel
              matchIds={row.evidence.matchIds}
              aggregatePath={row.evidence.aggregatePath}
              snapshotHash={snapshot}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default async function ItemDetailPage({ params }: ItemPageProps) {
  const { id } = await params;
  const rawId = id === "_placeholder" ? null : decodeIdParam(id);
  const found = rawId ? findEntity(rawId) : null;

  if (!found) {
    return <EmptyState />;
  }

  const { pair, rows, generatedAt, qAlpha } = found;
  const head = rows[0];
  const notes = loadNotes(pair.to);
  const notesById = new Map<string, PatchNoteItem>((notes?.items ?? []).map((item) => [item.id, item]));
  const ddragon = loadDdragonSafe();
  const championsFrom = loadChampions(pair.from)?.rows ?? null;
  const championsTo = loadChampions(pair.to)?.rows ?? null;
  const itemsFrom = loadItems(pair.from)?.rows ?? null;
  const itemsTo = loadItems(pair.to)?.rows ?? null;

  // 패치노트 대조는 **대상 단위**다 — 이 대상의 모든 관측이 짝지은 노트를 합쳐서 본다.
  const matchedNoteIds = Array.from(new Set(rows.flatMap((row) => row.matchedNoteIds)));
  const noteContrast = resolveNoteContrast(
    { matchedNoteIds, entityName: head.entityName },
    notes,
    pair.to
  );
  // 추정 원인도 대상 단위로 합친다. 같은 문장이 여러 지표에 붙을 수 있어 노트 id로 접는다.
  const causes = Array.from(
    new Map(
      rows.flatMap((row) => row.causes).map((cause) => [`${cause.candidateNoteId ?? ""}:${cause.text}`, cause])
    ).values()
  );
  /**
   * **대상 단위 요약은 만들지 않는다**(2026-09-23 scope-critic 지적).
   *
   * `llm.summary`는 **지표 하나**에 대한 브리핑 한 줄이다. 여러 지표를 묶은 이 패널에 그중
   * 하나를 올리면, 한 지표의 문장이 대상 전체를 대표하는 것처럼 읽힌다 — 더 나쁜 것은 그
   * 문장의 `summaryVerified`가 **다른 지표에서 온 원인들**의 신뢰도인 양 읽히는 것이다.
   * 그 문장은 **각 지표 구획**이 말한다(`MetricSection`). 여기 남기는 것은 검토 시각 캡션뿐이다.
   */
  const entityLlm = rows.some((row) => row.llm && !row.llm.skipped) ? { skipped: false } : undefined;

  // 수치 축(F9) — 이 대상에서 **게임사가 바꿨는데 말하지 않은 것**. 지표 축(위 판정)과 직교한다.
  const gameData = loadGameDataDiff("lol", pair.from, pair.to);
  const submarineChanges = submarineChangesFor(gameData, head.entityType, head.entityKey);
  const mismatchChanges = noteMismatchChangesFor(gameData, head.entityType, head.entityKey);
  const rawDeltas = readDeltasRaw(pair);
  const hash = rawDeltas ? snapshotHash(rawDeltas) : null;
  const splashUrl = championSplashUrl(head);

  return (
    <div className="flex flex-1 flex-col">
      <AmbientDetailSplash url={splashUrl} />
      <main>
        {/* width="narrow"(1040px) — 전역 Container(1320px)는 그대로 두고 이 페이지만 좁힌다.
            1440px에서 우측 여백이 넓어져 .ambient-duo(상세 스플래시) 가시 면적이 실제로 늘어난다. */}
        <Container width="narrow" className="flex flex-col gap-6 py-8">
          {/* 제목은 **대상 이름**이다 — 지표를 붙이지 않는다(§8-5). 지표는 아래 구획이 말한다. */}
          <PageHeader
            crumbs={detailCrumbs("lol", head.entityName)}
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
                <StatusBadge status={displayStatus(head, qAlpha)} />
              </span>
            }
            lead={
              <>
                {pair.from} → {pair.to} 관측 <strong className="text-fg">{rows.length}</strong>건.
                지표마다 전/후 값·통계 게이트·원천 매치를 아래에서 볼 수 있습니다.
              </>
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

          {/* 1행 [패치노트 대조 | 추정 원인(LLM)] — 대상 단위로 한 번만 그린다. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard eyebrow="선언 대조" title="패치노트 대조" className="flex min-h-80 flex-col">
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
            <SectionCard eyebrow="원인" title="추정 원인(LLM)" className="flex h-80 flex-col">
              <CausesPanel causes={causes} llm={entityLlm} notesById={notesById} generatedAt={generatedAt} />
            </SectionCard>
          </div>

          {/* 지표마다 한 구획 — 라우트가 대상 단위가 되면서 여기가 지표의 자리가 됐다. */}
          {rows.map((row) => (
            <MetricSection
              key={row.id}
              row={row}
              pair={pair}
              qAlpha={qAlpha}
              ddragon={ddragon}
              championsFrom={championsFrom}
              championsTo={championsTo}
              itemsFrom={itemsFrom}
              itemsTo={itemsTo}
              snapshot={hash ?? "unknown"}
            />
          ))}
        </Container>
        <Container>
          <SiteFooter game="lol" generatedAt={generatedAt} nVerdicts={rows.length} />
        </Container>
      </main>
    </div>
  );
}
