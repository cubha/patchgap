// src/app/tft/unit/[key]/page.tsx
// TFT 엔티티 상세 — LoL `/lol/item/*`·PUBG `/pubg/weapon/*`와 같은 자리다.
// 유닛뿐 아니라 특성·아이템도 여기로 들어온다(라우트 이름은 `unit`이지만 키에 종류가 들어 있다).
//
// `output:'export'`라 `generateStaticParams`가 필수이고, 집계가 없으면 `_placeholder` 1건을
// 남긴다 — 빈 배열을 반환하면 `next build`가 즉시 실패한다(PUBG 상세와 같은 실측 근거).
import type { Metadata } from "next";
import Link from "next/link";

import CausesPanel from "@/components/causes/CausesPanel";
import Container from "@/components/Container";
import ExternalLink from "@/components/ExternalLink";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import SubmarineDetailBlock from "@/components/gamedata/SubmarineDetailBlock";
import { TFT_METRICS, effectStrength, tftEntityRows } from "@/components/tft/entityRows";
import { TftFooter, TftUnavailable, deltaDisplay, formatMetricValue } from "@/components/tft/shared";
import { entityTypeLabel, isLowerBetter, metricLabel, statusLabel } from "@/lib/format";
import { loadGameDataDiff } from "@/lib/gamedata";
import { loadTft, type TftBundle } from "@/lib/tftData";
import type { DeltaMetric, DeltaRecord } from "@/pipeline/types";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";

/** `unit:DA_18_Rakan` → `unit~DA_18_Rakan`. 경로에 `:`을 그대로 쓰지 않는다. */
export function entitySlug(key: string): string {
  return key.replace(/:/g, "~");
}

function unslug(slug: string): string {
  return slug.replace(/~/g, ":");
}

/**
 * 이 라우트가 보는 행 집합 — **대조표와 같은 것**이어야 한다.
 *
 * 2026-09-21 실측 결함: 대조표는 잠수함 전용 엔티티까지 행으로 만들어 이름에 링크를 걸었는데
 * 여기 `generateStaticParams`는 수치 축 없이 행을 만들어 그 링크가 전부 404였다
 * (`unit~DA_18_ElderDragon`·`item~DA_18_BackrowStar`·`unit~DA_18_Sentry`, TFT 21건).
 * 호출부가 셋이라 인자를 하나씩 채우면 다음에 또 갈라진다 — 한 함수로 묶는다.
 */
function rowsOf(bundle: TftBundle) {
  const changes = loadGameDataDiff("tft", bundle.deltas.meta.from, bundle.deltas.meta.to)?.changes ?? [];
  return tftEntityRows(bundle.deltas, changes);
}

export function generateStaticParams(): Array<{ key: string }> {
  const bundle = loadTft();
  if (!bundle) return [{ key: "_placeholder" }];
  const rows = rowsOf(bundle);
  if (rows.length === 0) return [{ key: "_placeholder" }];
  return rows.map((r) => ({ key: entitySlug(r.key) }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const bundle = loadTft();
  const row = bundle ? rowsOf(bundle).find((r) => r.key === unslug(key)) : undefined;
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
  // 출처 줄("대조 원본: Community Dragon 18.1 → 18.2")의 재료 — 행 조립과 달리 meta가 필요하다.
  const gameData = loadGameDataDiff("tft", deltas.meta.from, deltas.meta.to);
  const rows = rowsOf(bundle);
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

  // 추정 원인은 **지표마다** 따로 물었다(LLM 2단은 델타 단위로 호출된다) — 등장률이 움직인
  // 이유와 평균 등수가 움직인 이유가 같으리라는 보장이 없으므로 합치지 않고 지표별로 보인다.
  // `llm`이 없는 지표는 애초에 2단 대상이 아니었다(1단에서 노트와 짝지어졌거나 미공지·
  // 공지-불일치가 아니었다) — 그 사실을 빈칸이 아니라 문장으로 말한다.
  const notesById = new Map(notes.items.map((n) => [n.id, n] as const));
  const causeBlocks = TFT_METRICS.map((metric) => ({ metric, record: row.cells[metric] })).filter(
    (entry): entry is { metric: DeltaMetric; record: DeltaRecord } =>
      entry.record !== undefined && entry.record.llm !== undefined
  );

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
                이 엔티티를 언급한 패치노트 항목이 없다. 위 관측은 <strong className="text-fg">미공지 변화</strong>다.
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
              source={gameData?.meta.source ?? null}
              notePatch={deltas.meta.to}
            />
          </SectionCard>

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

          {/* 이 사이트의 목적이 여기 있다 — 수치만 나열하지 않고 **왜 그랬는지**를 말한다.
              2026-09-20 이전 TFT 상세에는 이 카드가 아예 없었다(파이프라인이 2단을 돌지 않아
              causes가 전부 비어 있었고, 화면은 "무근거는 회색" 규칙대로 조용히 생략했다). */}
          <SectionCard
            eyebrow="원인"
            title="추정 원인(LLM)"
            variant="glass"
            action={<span className="font-mono text-xs text-muted">{causeBlocks.length}개 지표</span>}
          >
            {causeBlocks.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">
                이 엔티티의 관측은 LLM 2단 대상이 아니었다 — 패치노트와 짝지어졌거나(공지-일치),
                판정이 미공지·공지-불일치가 아니다. 없는 원인을 지어내지 않는다.
              </p>
            ) : (
              <div className={`flex flex-col ${PANEL_SCROLL_BODY}`}>
                {causeBlocks.map(({ metric, record }) => (
                  <div key={metric} className="border-t border-border-soft first:border-t-0">
                    <div className="px-5 pt-4 font-mono text-xs font-bold tracking-wider text-muted uppercase">
                      {metricLabel(metric)}
                    </div>
                    <CausesPanel
                      causes={record.causes}
                      llm={record.llm}
                      notesById={notesById}
                      generatedAt={deltas.meta.generatedAt}
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.rows.length} />
    </main>
  );
}
