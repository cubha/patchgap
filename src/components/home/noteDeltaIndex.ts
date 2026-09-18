// src/components/home/noteDeltaIndex.ts
// 노트 id → 대표 델타 행 역색인(2026-09-18, 채점 라운드3 G1). 순수 함수.
//
// **왜 last-wins가 결함이었나**: 한 노트 항목(예: "바드 기본 능력치")에는 픽률·밴률·승률·포지션별
// 행이 여러 개 짝지어진다. `page.tsx`가 `matchedNoteIds`를 돌며 마지막 행으로 덮어쓰면, 유의하고
// 바닥을 넘는 행이 앞에 있어도 뒤의 비유의 행이 남는다. 카드는 그 하나만 보므로 "관측 변화 없음"을
// 말했고, 3티어 정렬도 같은 사전을 쓰니 관측 보유 엔티티가 1/20에 그쳤다(best-row면 7/20 —
// 라운드2 실측 시뮬레이션). 홈 카드·티어·스킬 행이 **같은 사전**을 봐야 하므로 선택 규칙을 여기
// 한 곳에 둔다.
//
// 선택 규칙: ①보고 가능(유의 + 효과크기 바닥 통과) 우선 → ②상태 우선순위(STATUS_SORT_PRIORITY,
// 불일치가 일치보다 앞) → ③|Δ| 큰 쪽. 통과 행이 하나도 없으면 아무 행이라도 남겨 노트가 짝을
// 잃지 않게 한다(짝의 존재 자체는 판정 엔진의 사실이고, 여기서는 대표만 고른다).
import type { DeltaMetric, DeltaRecord } from "@/pipeline/types";
import { meetsEffectFloor } from "@/pipeline/aggregate/stats";
import { isSignificantDelta } from "@/pipeline/shared/significance";
import { STATUS_SORT_PRIORITY } from "@/pipeline/shared/status-order";

function reportable(record: DeltaRecord, qAlpha?: number): boolean {
  return (
    record.delta !== null &&
    isSignificantDelta(record, qAlpha) &&
    meetsEffectFloor(record.metric as DeltaMetric, record.delta, record.before)
  );
}

/** a가 b보다 대표로 더 적합하면 true. */
function better(a: DeltaRecord, b: DeltaRecord, qAlpha?: number): boolean {
  const ra = reportable(a, qAlpha);
  const rb = reportable(b, qAlpha);
  if (ra !== rb) return ra;
  const rank = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
  if (rank !== 0) return rank < 0;
  return Math.abs(a.delta ?? 0) > Math.abs(b.delta ?? 0);
}

export function indexNoteDeltas(
  rows: readonly DeltaRecord[],
  qAlpha?: number
): Record<string, DeltaRecord> {
  const index: Record<string, DeltaRecord> = {};
  for (const row of rows) {
    for (const noteId of row.matchedNoteIds) {
      const current = index[noteId];
      if (!current || better(row, current, qAlpha)) index[noteId] = row;
    }
  }
  return index;
}
