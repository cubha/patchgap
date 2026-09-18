// src/app/item/[id]/page.tsx
// 항목 상세(ST-12) — 판정 헤더·델타 차트·통계 게이트·패치노트 대조·LLM 추정 원인·원천 매치
// (UX-BRIEF §3 "03 항목 상세", 프로토타입 `docs/design/prototype/03-item-detail.html`).
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
import { displayStatus } from "@/pipeline/shared/display-status";
import { listPatchPairs, loadChampions, loadDeltas, loadItems, loadNotes, type PatchPair } from "@/lib/data";
import { entityTypeLabel, fmtInt, itemIdFromSlug, itemSlug } from "@/lib/format";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { loadDdragonSafe } from "@/pipeline/match/ddragon";
import AmbientDetailSplash from "@/components/item/AmbientDetailSplash";
import CausesPanel from "@/components/item/CausesPanel";
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

interface ItemPageProps {
  params: Promise<{ id: string }>;
}

interface FoundDelta {
  pair: PatchPair;
  delta: DeltaRecord;
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

function findDeltaForId(rawId: string): FoundDelta | null {
  for (const pair of listPatchPairs()) {
    const deltas = loadDeltas(pair.from, pair.to);
    if (!deltas) continue;
    const delta = deltas.rows.find((row) => row.id === rawId);
    if (delta) return { pair, delta, generatedAt: deltas.meta.generatedAt, qAlpha: deltas.meta.qAlpha };
  }
  return null;
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
  const pairs = listPatchPairs();
  const ids = new Set<string>();
  for (const pair of pairs) {
    const deltas = loadDeltas(pair.from, pair.to);
    if (!deltas) continue;
    for (const row of deltas.rows) ids.add(row.id);
  }
  if (ids.size === 0) return [{ id: "_placeholder" }];
  return Array.from(ids).map((id) => ({ id: itemSlug(id) }));
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

export default async function ItemDetailPage({ params }: ItemPageProps) {
  const { id } = await params;
  const rawId = id === "_placeholder" ? null : decodeIdParam(id);
  const found = rawId ? findDeltaForId(rawId) : null;

  if (!found) {
    return <EmptyState />;
  }

  const { pair, delta, generatedAt, qAlpha } = found;
  const notes = loadNotes(pair.to);
  const notesById = new Map<string, PatchNoteItem>((notes?.items ?? []).map((item) => [item.id, item]));
  const kind = metricKind(delta.metric);
  // UX-BRIEF §1 불변 원칙: "승률은 n 게이트 미달 시 '표본 부족' 라벨(델타 미제시)" — 실측
  // (LeeSin TOP winRate, n=8)으로 표본이 극히 작을 때 ci가 [-0.398,0.398]까지 벌어져 62.5%
  // 막대에 ±39.8pp 오차 막대가 붙는 왜곡을 발견했다. `insufficient-sample`이면 헤드라인의
  // 델타·CI 문구와 차트 오차 막대를 모두 생략한다(원시 전/후 관측값 자체는 계속 보여준다 —
  // "델타 미제시"이지 "값 미제시"가 아니다).
  const suppressDelta = delta.status === "insufficient-sample";
  const ddragon = loadDdragonSafe();
  const storedCi = resolveStoredCi(
    delta,
    ddragon,
    loadChampions(pair.from)?.rows ?? null,
    loadChampions(pair.to)?.rows ?? null,
    loadItems(pair.from)?.rows ?? null,
    loadItems(pair.to)?.rows ?? null
  );
  const chartData = buildChartData(delta, pair.from, pair.to, suppressDelta, storedCi);
  const noteContrast = resolveNoteContrast(delta, notes, pair.to);
  const rawDeltas = readDeltasRaw(pair);
  const hash = rawDeltas ? snapshotHash(rawDeltas) : null;
  const splashUrl = championSplashUrl(delta);

  return (
    <div className="flex flex-1 flex-col">
      <AmbientDetailSplash url={splashUrl} />
      <main>
        {/* width="narrow"(1040px, 2026-09-12·3차 Q3 "안 L1") — 전역 Container(1320px)는
            그대로 두고 이 페이지만 좁힌다. 1440px에서 우측 여백이 60→200px로 넓어져
            .ambient-duo(상세 스플래시) 가시 면적이 실제로 늘어난다. */}
        <Container width="narrow" className="flex flex-col gap-6 py-8">
          {/* 2026-09-12(3차) Q4: 판정 헤더를 불투명 bg-surface 카드에서 벗겨 홈 히어로와 같은
              방식으로 배경(상세 스플래시) 위 텍스트로 뺐다(HeroSummary.tsx 전례). text-shadow는
              .ambient-detail-headline/-sub(src/styles/ambient.css) — 히어로보다 강한 값을 쓴다,
              duo 스플래시가 brightness(1.55)+screen이라 히어로 배경보다 밝기 때문이다. */}
          {/* 브레드크럼 — 원시안 2종(배경 테마 v5 `.detail .crumb`, 방향 제안 항목상세 목업)이
              모두 그렸는데 구현에만 없던 것을 2026-09-12 /verify-impl 화면 대조로 잡아 보완했다.
              진입 경로가 대조표 행 클릭이므로(UX-BRIEF §2 화면 흐름) 첫 마디는 대조표 링크다. */}
          <nav aria-label="위치" className="ambient-detail-sub pt-1 font-mono text-xs text-fg-2">
            <Link href="/compare/" className="hover:text-fg">
              대조표
            </Link>
            <span className="px-1.5 text-muted" aria-hidden="true">
              ›
            </span>
            {entityTypeLabel(delta.entityType)}
            <span className="px-1.5 text-muted" aria-hidden="true">
              ›
            </span>
            {delta.entityName}
          </nav>
          <div className="flex flex-wrap items-center gap-4">
            <EntityIcon
              entityType={delta.entityType}
              entityKey={delta.entityKey}
              name={delta.entityName}
              size={72}
              className="rounded-md text-lg"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="ambient-detail-headline font-display text-xl font-bold text-fg">
                  {delta.entityName} — {displayMetricLabel(delta)}
                </h1>
                {/* 2026-09-18(ST-4, scope-critic 지적): 대조표와 같은 표시 키 — 비유의 "불일치"는
                    여기서도 회색 "관측 미확인"이어야 두 화면이 서로를 반박하지 않는다. */}
                <StatusBadge status={displayStatus(delta, qAlpha)} />
              </div>
              <p className="ambient-detail-sub mt-2 text-lg text-fg-2">
                {pair.from}→{pair.to} {displayMetricLabel(delta)}{" "}
                <span className="num font-bold text-fg">
                  {formatMetricValue(delta.before, kind)}
                </span>{" "}
                →{" "}
                <span className="num font-bold text-fg">
                  {formatMetricValue(delta.after, kind)}
                </span>{" "}
                {suppressDelta ? (
                  <span className="text-sm font-bold text-muted">
                    (표본 부족 — 델타 미제시, n({fmtInt(delta.n.before)}/{fmtInt(delta.n.after)}))
                  </span>
                ) : (
                  <>(<DeltaValue delta={delta.delta} ci={delta.ci} kind={kind} />)</>
                )}
              </p>
            </div>
            <div className="ml-auto">
              <Link
                href="/methodology/#discord"
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-accent-on hover:opacity-90"
              >
                디스코드로 전송
              </Link>
            </div>
          </div>

          {/* 2026-09-18 라운드6(사용자 L5) 배치: 1행 [패치노트 대조 | 추정 원인(LLM)] · 2행 [전/후 관측값] ·
              3행 [통계 게이트 | 원천 매치]. 추정 원인을 패치노트 대조와 같은 최상단에 두고, 통계 게이트·원천
              매치(중요도 낮음)를 맨 아래로 내렸다. 1·3행 카드는 **고정 높이**(h-80 / h-64, Tailwind 표준
              스케일) + 내부 스크롤이라 원천 매치 ID 수나 원인 개수에 따라 옆 카드가 늘어나지 않는다(이전엔
              grid stretch + flex-1로 서로 높이를 맞추느라 매 항목 레이아웃이 달랐다). */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard eyebrow="선언 대조" title="패치노트 대조" className="flex h-80 flex-col">
              <NoteContrastPanel result={noteContrast} />
            </SectionCard>
            <SectionCard eyebrow="간접 영향" title="추정 원인(LLM)" className="flex h-80 flex-col">
              <CausesPanel causes={delta.causes} llm={delta.llm} notesById={notesById} generatedAt={generatedAt} />
            </SectionCard>
          </div>

          <SectionCard eyebrow="관측" title="전/후 관측값">
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
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title="통계 게이트" className="flex h-64 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <StatsGatePanel delta={delta} kind={kind} />
              </div>
            </SectionCard>
            <SectionCard title="원천 매치" className="flex h-64 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <SourceMatchesPanel
                  matchIds={delta.evidence.matchIds}
                  aggregatePath={delta.evidence.aggregatePath}
                  snapshotHash={hash ?? "unknown"}
                />
              </div>
            </SectionCard>
          </div>
        </Container>
      </main>
    </div>
  );
}
