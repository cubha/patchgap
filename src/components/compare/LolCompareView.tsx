// src/components/compare/LolCompareView.tsx
// LoL 대조표 본문 — 프로토타입 02(docs/design/prototype/02-comparison-table.html) 구현. F5/ST-11.
// **쌍을 인자로 받는다**(2026-09-28, 이월 R8): 최신 쌍은 `/lol/compare/`가, 과거 쌍은 `/lol/history/[pair]/compare/`가
// 같은 본문을 그린다(브리핑의 `LolBriefing`과 같은 이유 — 과거 쌍 화면이 따로 자라 규칙이 갈라지지 않게).
// 데이터 로드는 이 서버 컴포넌트에서만 한다 — 칩·검색·정렬·선택 하이라이트 등 인터랙션은
// CompareExplorer('use client')로 위임한다.
//
// 2026-09-23 §8 정렬: 화면 머리(이동 경로 + h1 + 한 줄)를 공용 `PageHeader`로 세웠다 —
// 이 화면에는 **h1이 아예 없었다**(§8-7 #1).
import { loadDdragonSafe } from "@/pipeline/match/ddragon";
import { loadGameDataDiff } from "@/lib/gamedata";
import CompareExplorer from "@/components/compare/CompareExplorer";
import { computeCoverage } from "@/components/compare/logic";
import { resolveEntityIconBySection, type StreamEntityIcon } from "@/components/home/releaseStreamEntity";
import { loadDeltas, loadNotes, type PatchPair } from "@/lib/data";
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import SiteFooter from "@/components/SiteFooter";
import { PairBaseProvider } from "@/components/PairBaseContext";
import { compareCrumbs } from "@/lib/breadcrumbs";

export interface LolCompareViewProps {
  pair: PatchPair | null;
  /** 과거 쌍 화면이면 그 기준 경로(`/lol/history/{쌍}`) — 이동 경로와 표의 대상 링크가 그 쌍 안에 머문다. */
  pairBase?: string | null;
}

export default function LolCompareView({ pair, pairBase = null }: LolCompareViewProps) {
  const deltas = pair ? loadDeltas(pair.from, pair.to) : null;
  // 수치 축(F9) — 대조표 행에 잠수함 배지를 얹는다. 없으면 빈 배열이라 표는 그대로다.
  const gameDataChanges = pair
    ? (loadGameDataDiff("lol", pair.from, pair.to)?.changes ?? [])
    : [];
  const notes = pair ? loadNotes(pair.to) : null;
  const ddragon = loadDdragonSafe();

  const rows = deltas?.rows ?? [];
  const coverage = computeCoverage(rows, notes);

  const noteIcons: Record<string, StreamEntityIcon> = {};
  for (const item of notes?.items ?? []) {
    noteIcons[item.id] = resolveEntityIconBySection(item.entity, item.section, ddragon);
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1">
        <Container className="pt-40">
          <PageHeader
            crumbs={compareCrumbs("lol", pairBase)}
            title={
              pair ? (
                <>
                  <span className="text-accent">
                    {pair.from} → {pair.to}
                  </span>{" "}
                  대조표
                </>
              ) : (
                "대조표"
              )
            }
            lead="패치노트가 말한 항목과 실제로 움직인 지표를 대상 1개 = 행 1개로 견줍니다. 왼쪽에서 패치노트 항목을 고르면 오른쪽 표의 그 대상으로 이동합니다."
          />
        </Container>
        {/* 표의 대상 링크는 클라이언트 셀(`DeltaTable`)이 만든다 — 과거 쌍이면 컨텍스트로 기준 경로를 건넨다. */}
        <PairBaseProvider value={pairBase}>
          <CompareExplorer
            pair={pair}
            notes={notes?.items ?? []}
            rows={rows}
            coverage={coverage}
            noteIcons={noteIcons}
            qAlpha={deltas?.meta.qAlpha}
            gameDataChanges={gameDataChanges}
          />
        </PairBaseProvider>
        {/* SiteFooter가 자체 Container를 갖는다 — 한 번 더 감싸면 여백이 두 겹이 된다(2026-10-07, D-ALIGN-01). */}
        <SiteFooter game="lol" generatedAt={deltas?.meta.generatedAt ?? null} nVerdicts={rows.length} />
      </main>
    </div>
  );
}
