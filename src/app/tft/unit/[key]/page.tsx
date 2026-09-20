// src/app/tft/unit/[key]/page.tsx
// TFT 엔티티 상세 — LoL `/lol/item/*`·PUBG `/pubg/weapon/*`와 같은 자리다.
// 유닛뿐 아니라 특성·아이템도 여기로 들어온다(라우트 이름은 `unit`이지만 키에 종류가 들어 있다).
//
// `output:'export'`라 `generateStaticParams`가 필수이고, 집계가 없으면 `_placeholder` 1건을
// 남긴다 — 빈 배열을 반환하면 `next build`가 즉시 실패한다(PUBG 상세와 같은 실측 근거).
import type { Metadata } from "next";
import Link from "next/link";

import Container from "@/components/Container";
import ExternalLink from "@/components/ExternalLink";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import { TFT_METRICS, buildTftEntityRows, effectStrength } from "@/components/tft/entityRows";
import { TftFooter, TftUnavailable, deltaDisplay, formatMetricValue } from "@/components/tft/shared";
import { entityTypeLabel, isLowerBetter, metricLabel, statusLabel } from "@/lib/format";
import { loadTft } from "@/lib/tftData";
import type { DeltaRecord } from "@/pipeline/types";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";

/** `unit:DA_18_Rakan` → `unit~DA_18_Rakan`. 경로에 `:`을 그대로 쓰지 않는다. */
export function entitySlug(key: string): string {
  return key.replace(/:/g, "~");
}

function unslug(slug: string): string {
  return slug.replace(/~/g, ":");
}

export function generateStaticParams(): Array<{ key: string }> {
  const bundle = loadTft();
  if (!bundle) return [{ key: "_placeholder" }];
  const rows = buildTftEntityRows(bundle.deltas.rows, bundle.deltas.meta.qAlpha);
  if (rows.length === 0) return [{ key: "_placeholder" }];
  return rows.map((r) => ({ key: entitySlug(r.key) }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const bundle = loadTft();
  const row = bundle
    ? buildTftEntityRows(bundle.deltas.rows, bundle.deltas.meta.qAlpha).find((r) => r.key === unslug(key))
    : undefined;
  return { title: row ? `${row.name} — TFT · patchgap` : "TFT 상세 — patchgap" };
}

function MetricBlock({ record }: { record: DeltaRecord }) {
  const d = deltaDisplay(record.metric, record.delta ?? 0);
  const [low, high] = record.ci;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-soft bg-surface p-4">
      <span className="font-body text-xs font-bold text-muted">
        {metricLabel(record.metric)}
        {isLowerBetter(record.metric) ? <span className="ml-1 font-normal">(낮을수록 좋음)</span> : null}
      </span>
      <span className="font-mono text-sm tabular-nums text-fg-2">
        {formatMetricValue(record.metric, record.before ?? 0)} → {formatMetricValue(record.metric, record.after ?? 0)}
      </span>
      <span className={`font-mono text-lg font-bold tabular-nums ${d.improved ? "text-success" : "text-danger"}`}>
        {d.text}
      </span>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs tabular-nums text-muted">
        <dt>95% CI</dt>
        <dd>
          {low === null || high === null ? "—" : `${low.toFixed(4)} ~ ${high.toFixed(4)}`}
        </dd>
        <dt>q</dt>
        <dd>{record.q === null ? "—" : record.q.toExponential(2)}</dd>
        <dt>표본</dt>
        <dd>
          {record.n.before.toLocaleString()} → {record.n.after.toLocaleString()}
        </dd>
        <dt>바닥 대비</dt>
        <dd>{effectStrength(record).toFixed(2)}배</dd>
      </dl>
      <span className="mt-1 font-mono text-xs leading-relaxed break-all text-muted">
        {record.evidence.aggregatePath}
      </span>
    </div>
  );
}

export default async function TftUnitPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
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

  const { deltas, notes } = bundle;
  const rows = buildTftEntityRows(deltas.rows, deltas.meta.qAlpha);
  const row = rows.find((r) => r.key === unslug(key));

  if (!row) {
    return (
      <main>
        <Container>
          <div className="flex flex-col gap-3 pt-40 pb-8">
            <h1 className="font-display text-3xl font-bold text-fg">보고할 관측이 없는 엔티티다</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-fg-2">
              이 키에는 통계 게이트와 효과크기 바닥을 통과한 관측이 없다. 없는 것을 지어내지 않는다.
            </p>
            <Link href="/tft/compare/" className="w-fit text-sm text-accent hover:underline">
              ← 대조표로
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  // 이 엔티티에 걸린 패치노트 — 이름 정확일치(판정과 같은 규칙).
  const matchedNotes = notes.items.filter((n) => n.entity === row.name);

  return (
    <main>
      <Container>
        <div className="flex flex-col gap-6 pt-40 pb-8">
          <header className="flex flex-col gap-3">
            <Link href="/tft/compare/" className="w-fit font-mono text-xs text-muted hover:text-fg">
              ← 대조표 · {entityTypeLabel(row.entityType)}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">{row.name}</h1>
              <StatusBadge status={row.status} />
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-fg-2">
              {deltas.meta.from} ⇒ {deltas.meta.to} · 판정 <strong className="text-fg">{statusLabel(row.status)}</strong>
              {matchedNotes.length === 0 ? " · 패치노트에 이 엔티티를 언급한 항목이 없다" : null}
            </p>
          </header>

          <SectionCard eyebrow="관측" title="지표별 변화" variant="glass">
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              {TFT_METRICS.map((m) => {
                const record = row.cells[m];
                return record ? (
                  <MetricBlock key={m} record={record} />
                ) : (
                  <div
                    key={m}
                    className="flex flex-col gap-1 rounded-md border border-border-soft bg-surface p-4 opacity-60"
                  >
                    <span className="font-body text-xs font-bold text-muted">{metricLabel(m)}</span>
                    {/* 관측이 없는 것과 0인 것은 다르다. */}
                    <span className="font-mono text-sm text-muted">보고 자격을 얻은 관측 없음</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="선언"
            title="패치노트가 말한 것"
            variant="glass"
            action={<span className="font-mono text-xs text-muted">{matchedNotes.length}건</span>}
          >
            {matchedNotes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">
                이 엔티티를 언급한 패치노트 항목이 없다. 위 관측은 <strong className="text-fg">미공지 변화</strong>다.
              </p>
            ) : (
              <ul className={`flex flex-col ${PANEL_SCROLL_BODY}`}>
                {matchedNotes.map((n) => (
                  <li key={n.id} className="flex flex-col gap-1 border-t border-border-soft px-5 py-3">
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
          </SectionCard>
        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.rows.length} />
    </main>
  );
}
