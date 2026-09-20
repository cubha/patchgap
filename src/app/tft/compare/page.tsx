// src/app/tft/compare/page.tsx
// TFT 대조표 — **엔티티 행 × 지표 열**. LoL 대조표와 같은 구조이고, 같은 이유다:
// 지표가 각자 열을 가지면 단위가 다른 지표끼리 순위를 다투지 않는다
// (`components/tft/entityRows.ts` 헤더에 실측 근거).
//
// 표에 올릴 자격은 `isReportableRecord` 하나가 정한다 — 표본부족·바닥 미달·무변화는 올라오지
// 않고, 그 개수를 아래 커버리지 줄이 밝힌다. 숨기지 않되 섞지도 않는다.
import Link from "next/link";

import Container from "@/components/Container";
import ExternalLink from "@/components/ExternalLink";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import { TFT_METRICS, buildTftEntityRows, type TftEntityRow } from "@/components/tft/entityRows";
import { TftFooter, TftSampleNotice, TftUnavailable, deltaDisplay, formatMetricValue } from "@/components/tft/shared";
import { entityTypeLabel, isLowerBetter, metricLabel } from "@/lib/format";
import { entitySlug } from "@/app/tft/unit/[key]/page";
import { loadTft } from "@/lib/tftData";
import type { DeltaMetric, MatchStatus } from "@/pipeline/types";

export const metadata = { title: "TFT 대조표 — patchgap" };

function MetricCell({ row, metric }: { row: TftEntityRow; metric: DeltaMetric }) {
  const record = row.cells[metric];
  if (!record) {
    // 관측이 없는 것과 0인 것은 다르다 — 빈 칸으로 그 사실을 말한다.
    return <span className="px-1 font-mono text-xs text-muted">—</span>;
  }
  const d = deltaDisplay(metric, record.delta ?? 0);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-fg-2">
        {formatMetricValue(metric, record.before ?? 0)} → {formatMetricValue(metric, record.after ?? 0)}
      </span>
      <span
        className={`whitespace-nowrap font-mono text-xs font-bold tabular-nums ${
          d.improved ? "text-success" : "text-danger"
        }`}
      >
        {d.text}
      </span>
    </div>
  );
}

export default function TftComparePage() {
  const bundle = loadTft();
  if (!bundle) {
    return (
      <main>
        <Container>
          <TftUnavailable />
        </Container>
      </main>
    );
  }

  const { deltas, before, after, notes } = bundle;
  const rows = buildTftEntityRows(deltas.rows, deltas.meta.qAlpha);
  const counts = deltas.meta.counts;
  const bucket = (status: MatchStatus): number => counts[status] ?? 0;
  const shownDeltas = rows.reduce((sum, r) => sum + Object.keys(r.cells).length, 0);
  // 커버리지 단위는 **엔티티**다 — 표의 행 수와 같은 수가 나와야 화면이 스스로를 반박하지 않는다.
  const noteEntities = new Set(notes.items.map((n) => n.entity)).size;
  const matchedEntities = rows.filter((r) => r.noteAnchor !== null).length;
  const gapEntities = rows.filter((r) => r.status === "unannounced").length;
  const excluded = deltas.rows.length - shownDeltas;

  return (
    <main>
      <Container>
        <div className="flex flex-col gap-6 pt-40 pb-8">
          <header className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
              <span className="text-accent">
                {deltas.meta.from} ⇒ {deltas.meta.to}
              </span>{" "}
              대조표
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-fg-2">
              엔티티 <strong className="text-fg">{rows.length}</strong>종 · 보고 자격을 얻은 관측{" "}
              <strong className="text-fg">{shownDeltas}</strong>건(전체 델타 {deltas.rows.length}건 중). 정렬은 판정
              우선순위 → 효과크기 순으로, LoL·배틀그라운드 대조표와 같은 규칙을 쓴다.
            </p>
          </header>

          <SectionCard
            eyebrow="전수"
            title="선언 ↔ 관측"
            variant="glass"
            action={<span className="font-mono text-xs text-muted">{rows.length}종</span>}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-body text-xs font-bold text-muted shadow-[inset_0_-1px_0_var(--border-soft)]">
                      엔티티
                    </th>
                    {TFT_METRICS.map((m) => (
                      <th
                        key={m}
                        className="whitespace-nowrap px-4 py-3 text-left font-body text-xs font-bold text-muted shadow-[inset_0_-1px_0_var(--border-soft)]"
                      >
                        {metricLabel(m)}
                        {isLowerBetter(m) ? <span className="ml-1 font-normal">(낮을수록 좋음)</span> : null}
                      </th>
                    ))}
                    {["판정", "근거"].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left font-body text-xs font-bold text-muted shadow-[inset_0_-1px_0_var(--border-soft)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-border-soft align-top">
                      <td className="px-4 py-3">
                        {/* 상세 진입점 — 없으면 상세 화면이 존재하지 않는 것과 같다. */}
                        <Link href={`/tft/unit/${entitySlug(row.key)}/`} className="flex flex-col gap-0.5 group">
                          <span className="font-bold text-fg group-hover:text-accent">{row.name}</span>
                          <span className="font-mono text-xs uppercase tracking-wider text-muted">
                            {entityTypeLabel(row.entityType)}
                          </span>
                        </Link>
                      </td>
                      {TFT_METRICS.map((m) => (
                        <td key={m} className="px-4 py-3">
                          <MetricCell row={row} metric={m} />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        {row.noteAnchor ? (
                          <ExternalLink
                            href={row.noteAnchor}
                            className="font-mono text-xs text-accent hover:underline"
                          >
                            원문 ↗
                          </ExternalLink>
                        ) : (
                          // 무근거 회색 — 지어낸 근거를 만들지 않는다.
                          <span className="font-mono text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 커버리지 바 — LoL 대조표(`components/compare/CoverageBar.tsx`)와 같은 자리·같은
                어휘다. 파서가 놓친 줄까지 함께 밝힌다 — 노트 쪽 커버리지를 안 보여주면
                "패치노트 전부를 봤다"는 인상을 준다. */}
            <div className="border-t border-border-soft px-5 py-4 text-sm text-muted">
              노트 <strong className="font-bold text-fg">{noteEntities}</strong>엔티티(
              <strong className="font-bold text-fg">{notes.items.length}</strong>항목) 중 관측 짝{" "}
              <strong className="font-bold text-fg">{matchedEntities}</strong> · 미공지{" "}
              <strong className="font-bold text-fg">{gapEntities}</strong>
              <span className="mt-1 block text-xs">
                패치노트 변경 줄 {notes.stats.lines}건 중 {notes.items.length}건(
                {((notes.items.length / Math.max(1, notes.stats.lines)) * 100).toFixed(1)}%)에서 엔티티를 특정했다 —
                나머지 {notes.stats.unresolved}건은 엔티티가 없는 체계 변경이거나 사전에 없는 소환수다.
              </span>
            </div>
          </SectionCard>

          {/* 커버리지 — **뺀 것을 밝힌다.** 숫자를 안 보여주면 "전부 다"라는 인상을 준다. */}
          <section className="rounded-lg border border-border-soft bg-surface p-5">
            <h2 className="font-body text-xs font-bold text-muted">
              표에 올리지 않은 관측 — {excluded.toLocaleString()}건
            </h2>
            <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-fg-2 sm:grid-cols-2">
              <li>
                <strong className="font-mono text-muted">{bucket("no-change").toLocaleString()}</strong> · 통계적으로
                유의한 변화가 없다
              </li>
              <li>
                <strong className="font-mono text-muted">{bucket("below-threshold").toLocaleString()}</strong> · 유의하나
                효과크기 바닥 미달 — 실재하지만 실무상 무시 가능한 규모다
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              표본이 모자란 엔티티(등장 보드 200 미만)는 순방률·평균 등수 행 자체를 만들지 않는다 — 좁은 신뢰구간을
              지어내 유의한 것처럼 보이게 하지 않기 위해서다. 등장률은 그대로 남는다.
            </p>
          </section>

          <TftSampleNotice boards={before.boards + after.boards} matches={before.matches + after.matches} />
        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.rows.length} />
    </main>
  );
}
