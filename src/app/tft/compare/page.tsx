// src/app/tft/compare/page.tsx
// TFT 대조표 — **엔티티 행 × 지표 열**. LoL 대조표와 같은 구조이고, 같은 이유다:
// 지표가 각자 열을 가지면 단위가 다른 지표끼리 순위를 다투지 않는다
// (`components/tft/entityRows.ts` 헤더에 실측 근거).
//
// 2026-09-23 §8-3 정렬: 화면 머리(이동 경로 + h1)·도구모음(칩·검색·정렬)·좌 「패치노트 항목」
// 내비·2컬럼 골격을 전부 공용 컴포넌트로 세웠다. 전에는 이 화면에 그 넷이 **하나도 없었다**.
// 인터랙션은 `TftCompareExplorer`('use client')가 소유하고, 이 서버 컴포넌트는 로드만 한다.
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import TftCompareExplorer from "@/components/tft/TftCompareExplorer";
import { tftEntityRows } from "@/components/tft/entityRows";
import { loadGameDataDiff } from "@/lib/gamedata";
import { TftFooter, TftSampleNotice, TftUnavailable } from "@/components/tft/shared";
import { compareCrumbs } from "@/lib/breadcrumbs";
import { loadTft, loadTftAssets } from "@/lib/tftData";
import type { MatchStatus } from "@/pipeline/types";

export const metadata = {
  title: "전략적 팀 전투 대조표 · patchgap",
  description: "TFT 패치노트가 말한 것과 실제 관측을 대상 단위로 견줍니다.",
};

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
  // 수치 축(F9) — 지표 축 게이트를 못 넘긴 잠수함도 행으로 올린다. 상세 라우트
  // (`tft/unit/[key]`)와 **같은 진입점**을 써야 링크와 경로가 갈라지지 않는다(2026-09-21 실측 404).
  const rows = tftEntityRows(deltas, loadGameDataDiff("tft", deltas.meta.from, deltas.meta.to)?.changes ?? []);
  // 자산 실재 여부는 매니페스트가 정한다 — 없는 파일을 요청하지 않는다.
  const manifest = loadTftAssets();
  const assetKeys = manifest
    ? (["unit", "trait", "item"] as const).flatMap((kind) =>
        manifest.assets[kind].map((key) => `${kind}:${key}`)
      )
    : [];
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
          <PageHeader
            crumbs={compareCrumbs("tft")}
            title={
              <>
                <span className="text-accent">
                  {deltas.meta.from} → {deltas.meta.to}
                </span>{" "}
                대조표
              </>
            }
            lead={
              <>
                대상 <strong className="text-fg">{rows.length}</strong>종 · 보고 자격을 얻은 관측{" "}
                <strong className="text-fg">{shownDeltas}</strong>건(전체 델타 {deltas.rows.length}건 중).
                왼쪽에서 패치노트 항목을 고르면 오른쪽 표의 그 대상으로 이동합니다.
              </>
            }
          />

          <TftCompareExplorer
            rows={rows}
            notes={notes.items}
            assetKeys={assetKeys}
          />

          {/* 커버리지 — **뺀 것을 밝힌다.** 세 게임이 같은 자리(표 아래)에 둔다(§8-7 #16). */}
          <section className="rounded-lg border border-border-soft bg-surface p-5">
            <h2 className="font-body text-xs font-bold text-muted">
              표에 올리지 않은 관측 — {excluded.toLocaleString()}건
            </h2>
            <p className="mt-3 text-sm text-muted">
              노트 <strong className="font-bold text-fg">{noteEntities}</strong>대상(
              <strong className="font-bold text-fg">{notes.items.length}</strong>항목) 중 관측 짝{" "}
              <strong className="font-bold text-fg">{matchedEntities}</strong> · 미공지{" "}
              <strong className="font-bold text-fg">{gapEntities}</strong>
            </p>
            <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-fg-2 sm:grid-cols-2">
              <li>
                <strong className="font-mono text-muted">{bucket("no-change").toLocaleString()}</strong> · 통계적으로
                유의한 변화가 없습니다
              </li>
              <li>
                <strong className="font-mono text-muted">{bucket("below-threshold").toLocaleString()}</strong> · 유의하나
                효과크기 바닥 미달 — 실재하지만 실무상 무시 가능한 규모입니다
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              표본이 모자란 대상(등장 보드 200 미만)은 순방률·평균 등수 행 자체를 만들지 않습니다 — 좁은 신뢰구간을
              지어내 유의한 것처럼 보이게 하지 않기 위해서입니다. 등장률은 그대로 남습니다. 패치노트 변경 줄{" "}
              {notes.stats.lines}건 중 {notes.items.length}건(
              {((notes.items.length / Math.max(1, notes.stats.lines)) * 100).toFixed(1)}%)에서 대상을 특정했고,
              나머지 {notes.stats.unresolved}건은 대상이 없는 체계 변경이거나 사전에 없는 소환수입니다.
            </p>
          </section>

          <TftSampleNotice boards={before.boards + after.boards} matches={before.matches + after.matches} />
        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.rows.length} />
    </main>
  );
}
