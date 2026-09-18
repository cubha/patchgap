// src/components/compare/DeltaTable.tsx
// 우 델타 테이블(2/3) — 프로토타입 `table.delta-table` 1:1(docs/design/prototype/02-comparison-table.html).
// 순수 프레젠테이션 — 정렬 상태·선택 하이라이트는 부모 CompareExplorer가 소유.
//
// 2026-09-12(4차, R5): 본문을 640px 내부 스크롤(NoteNavigator.tsx의 `.note-item-list` 규약과
// 동일값)로 감쌌다 — 이전엔 rows(최대 PAGE_SIZE=200행)가 전부 펼쳐져 페이지 전체가 13,000px
// 넘게 길어졌다(사용자 실측 지적). `더 보기`/CoverageBar는 CompareExplorer.tsx에서 이 스크롤러
// 밖(패널 푸터)에 그대로 둔다.

import Link from "next/link";
import type { DeltaRecord, LanePosition } from "@/pipeline/types";
import { itemHref, metricLabel, positionLabel } from "@/lib/format";
import { parseLaneAxis } from "@/lib/lane";
import EntityIcon from "@/components/EntityIcon";
import IconBox from "@/components/IconBox";
import LaneGlyph from "@/components/LaneGlyph";
import StatusBadge from "@/components/StatusBadge";
import { displayStatus } from "@/pipeline/shared/display-status";
import { entityFallbackLabel, formatMetricValue } from "@/components/home/logic";
import { directionSymbol, formatCiCell, formatDeltaCell, formatNCell, shortNoteId, type SortKey } from "./logic";

/** 행의 엔티티 열 아이콘 — entityType==="lane"(라인 골드 지표, 챔피언 자산 없음)은 라인 글리프로,
 * 그 외는 기존 EntityIcon(champion/item은 ddragon 이미지, objective/summary는 폴백 글자)로.
 * HANDOFF-redesign-2026-09-10.md §4-2 "라인 행(바텀·미드 등)은 챔피언 자산이 없다 → '골' 텍스트
 * 박스를 라인 글리프 박스로 교체". */
function RowIcon({ row, size }: { row: DeltaRecord; size: number }) {
  if (row.entityType === "lane") {
    // 2026-09-12(6차, /verify-impl 재검증): IconBox 공용 컴포넌트 — ReleaseNoteRow.tsx의 동형
    // 라인 글리프 박스와 함께 각자 손으로 재구현되던 것을 정리(src/components/IconBox.tsx 참고).
    return (
      <IconBox size={size}>
        <LaneGlyph lane={row.entityKey as LanePosition} size={Math.round(size * 0.6)} labelled />
      </IconBox>
    );
  }
  return (
    <EntityIcon
      entityType={row.entityType}
      entityKey={row.entityKey}
      name={row.entityName}
      fallbackLabel={entityFallbackLabel(row)}
      size={size}
    />
  );
}

/** 챔피언 position-scope 행(4세그먼트 id)의 라인 태그 — "엔티티 열 하위에 라인 태그(글리프 +
 * '탑 · 승률')"(HANDOFF §4-2). scope=all·라인 파싱 불가(non-champion)면 렌더하지 않는다. */
function LaneTag({ row }: { row: DeltaRecord }) {
  if (row.entityType !== "champion") return null;
  const lane = parseLaneAxis(row.id);
  if (lane === null || lane === "all") return null;
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
      <LaneGlyph lane={lane} size={12} labelled />
      {positionLabel(lane)} · {metricLabel(row.metric)}
    </span>
  );
}

export interface DeltaTableProps {
  pair: { from: string; to: string } | null;
  rows: DeltaRecord[];
  highlightNoteId: string | null;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  /** deltas.meta.qAlpha — 행 배지 표시 키(ST-4). */
  qAlpha?: number;
}

function sortIndicator(key: SortKey, activeKey: SortKey, dir: "asc" | "desc"): string {
  if (key !== activeKey) return "↕";
  return dir === "desc" ? "▼" : "▲";
}

export default function DeltaTable({ pair, rows, highlightNoteId, sortKey, sortDir, onSort, qAlpha }: DeltaTableProps) {
  const fromLabel = pair?.from ?? "이전";
  const toLabel = pair?.to ?? "이후";

  // sticky 헤더(2026-09-12·4차, R5) — 640px 내부 스크롤(아래 컨테이너)에서 헤더가 스크롤을 따라
  // 사라지면 표를 읽을 수 없다. `border-collapse`(아래 <table>)와 `position:sticky`를 같이 쓰면
  // th의 하단 border가 사라지는 알려진 상호작용이 있어(테두리가 collapse 규칙을 따라 sticky
  // 레이어링 밖으로 밀림), `border-b`를 `shadow-[inset_0_-1px_0_var(--border-soft)]`로 대체한다
  // — 색은 여전히 토큰 참조라 verify.sh Spec 하드코딩 검사에 걸리지 않는다. 헤더 배경은
  // bg-surface(불투명 단색)로 — panel-surface의 그라디언트 채움을 그대로 쓰면 스크롤 시
  // 헤더 영역만 평평한 띠로 끊겨 보인다.
  const thBase =
    "sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-3 text-left shadow-[inset_0_-1px_0_var(--border-soft)]";
  return (
    <div className="max-h-[640px] overflow-auto"> {/* design-lint-ignore: 프로토타입 .note-item-list{max-height:640px}와 동일 규약(NoteNavigator.tsx 참고), 대응 토큰 없음 */}
      <table className="w-full border-collapse font-mono text-sm tabular-nums">
        <thead>
          <tr>
            <th scope="col" className={thBase} />
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              엔티티
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              지표
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              {fromLabel}
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              {toLabel}
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              <button type="button" onClick={() => onSort("absDelta")} className="inline-flex items-center gap-1">
                Δ <span aria-hidden="true">{sortIndicator("absDelta", sortKey, sortDir)}</span>
              </button>
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              <button type="button" onClick={() => onSort("q")} className="inline-flex items-center gap-1">
                95% CI <span aria-hidden="true">{sortIndicator("q", sortKey, sortDir)}</span>
              </button>
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              <button type="button" onClick={() => onSort("n")} className="inline-flex items-center gap-1">
                n <span aria-hidden="true">{sortIndicator("n", sortKey, sortDir)}</span>
              </button>
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              상태
            </th>
            <th scope="col" className={`${thBase} font-body text-xs font-bold text-muted`}>
              짝
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center font-body text-sm text-muted">
                표시할 델타가 없습니다
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const dir = directionSymbol(row);
              const highlighted = highlightNoteId !== null && row.matchedNoteIds.includes(highlightNoteId);
              return (
                <tr
                  key={row.id}
                  // 2026-09-12(6차, /verify-impl 재검증): bg-[color-mix(...)](arbitrary bracket)
                  // → .row-highlight(src/styles/panel.css, --row-highlight-fill 토큰).
                  className={`border-b border-border-soft ${highlighted ? "row-highlight" : ""}`}
                >
                  <td className={`px-4 py-3 ${dir.colorClass}`}>{dir.symbol}</td>
                  <td className="px-4 py-3 font-body">
                    <div className="flex items-center gap-3">
                      <RowIcon row={row} size={40} />
                      <div className="flex flex-col">
                        <Link href={itemHref(row.id)} className="text-fg hover:text-accent hover:underline">
                          {row.entityName}
                        </Link>
                        <LaneTag row={row} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-body text-fg-2">{metricLabel(row.metric)}</td>
                  <td className="px-4 py-3">{formatMetricValue(row.before, row.metric)}</td>
                  <td className="px-4 py-3">{formatMetricValue(row.after, row.metric)}</td>
                  <td className={`px-4 py-3 ${dir.colorClass}`}>{formatDeltaCell(row)}</td>
                  <td className="px-4 py-3 text-fg-2">{formatCiCell(row)}</td>
                  <td className="px-4 py-3 text-fg-2">{formatNCell(row)}</td>
                  <td className="px-4 py-3 font-body">
                    <StatusBadge status={displayStatus(row, qAlpha)} />
                  </td>
                  <td className="px-4 py-3 text-fg-2">{shortNoteId(row.matchedNoteId)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
