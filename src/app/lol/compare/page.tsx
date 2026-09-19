// src/app/compare/page.tsx
// 대조표 — 프로토타입 02(docs/design/prototype/02-comparison-table.html) 구현. F5/ST-11.
// 헤더는 ST-10부터 src/app/layout.tsx가 전역 렌더한다(여기서 다시 렌더하면 중복). 크롬(패치
// 쌍·고정 표본·n/집계 캡션)도 2026-09-12(3차)부터 그 헤더가 1줄로 통합해 그린다 — 이 페이지가
// 별도로 FilterBar를 렌더하지 않는다(구 FilterBar.tsx는 삭제됨).
// 데이터 로드는 이 서버 컴포넌트에서만 한다 — 상태 필터·검색·정렬·선택 하이라이트 등 인터랙션은
// CompareExplorer('use client')로 위임한다.

import { loadDdragonSafe } from "@/pipeline/match/ddragon";
import CompareExplorer from "@/components/compare/CompareExplorer";
import { computeCoverage } from "@/components/compare/logic";
import { resolveEntityIconBySection, type StreamEntityIcon } from "@/components/home/releaseStreamEntity";
import { getDefaultPair, loadDeltas, loadNotes } from "@/lib/data";

export default function ComparePage() {
  const pair = getDefaultPair();

  const deltas = pair ? loadDeltas(pair.from, pair.to) : null;
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
        <CompareExplorer
          pair={pair}
          notes={notes?.items ?? []}
          rows={rows}
          coverage={coverage}
          noteIcons={noteIcons}
          qAlpha={deltas?.meta.qAlpha}
        />
      </main>
    </div>
  );
}
