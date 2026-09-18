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
import type { DeltaRecord } from "@/pipeline/types";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { STATUS_SORT_PRIORITY } from "@/pipeline/shared/status-order";

// 자격 술어는 shared/reportable.ts 한 곳(라운드6 scope-critic ST2 — 세 곳 중복 제거).
const reportable = isReportableRecord;

/** a가 b보다 대표로 더 적합하면 true. */
function better(a: DeltaRecord, b: DeltaRecord, qAlpha?: number): boolean {
  const ra = reportable(a, qAlpha);
  const rb = reportable(b, qAlpha);
  if (ra !== rb) return ra;
  const rank = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
  if (rank !== 0) return rank < 0;
  return Math.abs(a.delta ?? 0) > Math.abs(b.delta ?? 0);
}

/**
 * note.id → 그 노트에 짝지어진 **모든** 델타 행(2026-09-18 채점 라운드4 S4 후속).
 *
 * **왜 대표 하나로는 부족한가**: `indexNoteDeltas`는 화면에 *보여줄* 한 행을 고르는 함수라,
 * 보고 가능한 행이 없으면 `|Δ|`가 큰 쪽을 남긴다. 그런데 그 규칙은 **비유의·큰 변화**를
 * **유의·작은 변화**보다 앞세운다(실측 자헨: 대표는 winRate +5.20%p q=0.51(비유의)이고,
 * 유의한 pickRate +1.58%p q=0 세 행은 전부 밀렸다). 대표만 보고 "왜 관측이 없나"를 답하면
 * "유의차 없음"이라고 단정하게 되는데 그 엔티티엔 유의한 행이 실재하므로 **거짓**이다 —
 * 이 라운드가 고치려던 바로 그 결함의 축소판이다.
 *
 * 그래서 **대표 선택은 그대로 두고**(G1 규칙 불변), 사유 계산에만 전수를 준다.
 */
export function indexNoteDeltaRows(
  rows: readonly DeltaRecord[]
): Record<string, DeltaRecord[]> {
  const index: Record<string, DeltaRecord[]> = {};
  for (const row of rows) {
    for (const noteId of row.matchedNoteIds) {
      (index[noteId] ??= []).push(row);
    }
  }
  return index;
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
