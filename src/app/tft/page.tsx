// src/app/tft/page.tsx
// TFT 브리핑 홈. LoL·PUBG 홈과 **같은 정보 우선순위**를 따른다:
//   1. 결과(판정 요약 3타일) 먼저 — 설명 카드는 아래로(라운드4 A3 지적과 같은 규칙)
//   2. 미공지가 강조 색(accent), 나머지는 중립
//   3. 표에 올릴 자격은 `isReportableRecord` 하나가 정한다 — 표본부족·바닥 미달은 안 올라간다
//   4. 모든 판정문은 원천 링크를 갖는다. 없으면 회색으로 떨어뜨리고 링크를 걸지 않는다
import Container from "@/components/Container";
import ExternalLink from "@/components/ExternalLink";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import {
  TftFooter,
  TftPageHeader,
  TftSampleNotice,
  TftUnavailable,
  deltaDisplay,
  formatMetricValue,
} from "@/components/tft/shared";
import { panelSurfaceClass } from "@/lib/panelSurface";
import { entityTypeLabel, metricLabel } from "@/lib/format";
import { loadTft } from "@/lib/tftData";
import { displayStatusOf } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { STATUS_SORT_PRIORITY } from "@/pipeline/shared/status-order";
import type { DeltaRecord } from "@/pipeline/types";

export const metadata = { title: "전략적 팀 전투 — patchgap" };

/** 상위 N건 — LoL 홈과 같은 정렬(상태 우선순위 → 효과크기). */
function topRows(rows: DeltaRecord[], limit: number): DeltaRecord[] {
  return [...rows]
    .sort(
      (a, z) =>
        STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[z.status] ||
        Math.abs(z.delta ?? 0) - Math.abs(a.delta ?? 0)
    )
    .slice(0, limit);
}

function DeltaRow({ row }: { row: DeltaRecord }) {
  const d = deltaDisplay(row.metric, row.delta ?? 0);
  return (
    <tr className="border-t border-border-soft">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-fg">{row.entityName}</span>
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            {entityTypeLabel(row.entityType)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted">{metricLabel(row.metric)}</td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-fg-2">
        {formatMetricValue(row.metric, row.before ?? 0)} → {formatMetricValue(row.metric, row.after ?? 0)}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-3 font-mono text-xs font-bold tabular-nums ${
          d.improved ? "text-success" : "text-danger"
        }`}
      >
        {d.text}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={displayStatusOf(row.status)} />
      </td>
      <td className="px-4 py-3">
        {row.evidence.noteAnchor ? (
          <ExternalLink href={row.evidence.noteAnchor} className="font-mono text-xs text-accent hover:underline">
            원문 ↗
          </ExternalLink>
        ) : (
          // 무근거 회색 — 링크를 걸지 않는다(지어낸 근거를 만들지 않는다).
          <span className="font-mono text-xs text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function DeltaTable({ rows, emptyText }: { rows: DeltaRecord[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface">
            {["엔티티", "지표", "변화", "Δ", "판정", "근거"].map((h) => (
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
            <DeltaRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TftPage() {
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
  const reportable = deltas.rows.filter((row) => isReportableRecord(row, deltas.meta.qAlpha));
  const unannounced = reportable.filter((row) => displayStatusOf(row.status) === "unannounced");
  const announced = reportable.filter((row) => displayStatusOf(row.status) !== "unannounced");
  const matches = before.matches + after.matches;
  // 시안 04-applied의 헤드라인 — 이 사이트가 무엇을 하는 곳인지 한 문장으로 말한다.
  // 숫자는 아래 3타일과 **같은 출처**를 쓴다(따로 세면 화면이 스스로를 반박한다).
  const noteEntities = new Set(notes.items.map((n) => n.entity)).size;

  return (
    <main>
      <Container>
        {/* pt-40 — 키아트 밴드 상단을 글자로 덮지 않는다(PUBG 홈과 같은 값). */}
        <div className="flex flex-col gap-6 pt-40 pb-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">
              패치노트가 말한 것 vs 통계가 말하는 것
            </span>
            <p className="max-w-3xl font-display text-2xl leading-snug font-bold text-fg sm:text-3xl">
              패치노트는 <span className="text-accent">{noteEntities}개 엔티티</span>를 말했고, 통계는{" "}
              <span className="text-accent">{reportable.length}개 변화</span>를 말합니다
            </p>
          </div>

          <TftPageHeader
            title={
              <>
                <span className="text-accent">
                  {deltas.meta.from} ⇒ {deltas.meta.to}
                </span>{" "}
                · 유닛 · 특성 · 아이템
              </>
            }
            lead={
              <>
                KR · Master+ <strong className="text-fg">{before.matches.toLocaleString()}</strong> →{" "}
                <strong className="text-fg">{after.matches.toLocaleString()}</strong>매치 · 엔티티{" "}
                <strong className="text-fg">{after.units.length + after.traits.length + after.items.length}</strong>종
              </>
            }
          />

          {/* 결과 먼저 — 설명은 방법론으로. LoL·PUBG 홈과 같은 3타일. */}
          <section className={`${panelSurfaceClass("glass")} grid grid-cols-3 overflow-hidden rounded-lg`}>
            <div className="border-r border-border-soft p-5">
              <strong className="block font-display text-3xl font-bold tabular-nums text-fg">
                {notes.items.length}
              </strong>
              <span className="mt-1 block text-xs text-muted">공지된 변화 ({deltas.meta.to} 패치노트)</span>
            </div>
            <div className="border-r border-border-soft p-5">
              <strong className="block font-display text-3xl font-bold tabular-nums text-fg">{reportable.length}</strong>
              <span className="mt-1 block text-xs text-muted">유의한 관측</span>
            </div>
            <div className="p-5">
              <strong className="block font-display text-3xl font-bold tabular-nums text-accent">
                {unannounced.length}
              </strong>
              <span className="mt-1 block text-xs text-muted">미공지</span>
            </div>
          </section>

          <SectionCard
            eyebrow="대조"
            title="공지된 변경은 실제로 그렇게 됐나"
            variant="glass"
            action={<span className="font-mono text-xs text-muted">{announced.length}건</span>}
          >
            <DeltaTable rows={topRows(announced, 15)} emptyText="공지와 짝지어진 유의한 관측이 없다." />
          </SectionCard>

          <SectionCard
            eyebrow="발견"
            title="패치노트에 없는데 움직인 것"
            variant="glass"
            action={<span className="font-mono text-xs text-muted">{unannounced.length}건</span>}
          >
            <DeltaTable rows={topRows(unannounced, 15)} emptyText="미공지 변화가 없다." />
          </SectionCard>

          <TftSampleNotice boards={before.boards + after.boards} matches={matches} />
        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.rows.length} />
    </main>
  );
}
