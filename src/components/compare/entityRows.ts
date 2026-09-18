// src/components/compare/entityRows.ts
// 델타 테이블 **엔티티 1행** 조립(2026-09-18 라운드6, 사용자 L3·C1). 순수 함수 — 렌더는 DeltaTable.
//
// **왜 바꿨나**: 이전 표는 `DeltaRecord` 1건 = 1행이라 같은 챔피언이 픽률·밴률·승률·라인별 행으로
// 최대 13번 반복됐고, 라인 골드(`lane:*`)·오브젝트·매치 평균 행이 |Δ| 절대값이 커서 상단을 차지했다.
// 사용자: "동일한 챔피언이 별도의 행으로 표기 … 그리드 coldef의 문제 … 밴률/승률/픽률/채택률을 인라인
// 으로 표시. 상승 하락 기호까지 cell 데이터에 함께 표시 (탑,미드,바텀 등 골드내용은 분명히 빼라고)".
//
// **규칙**
// ① 챔피언·아이템만. 라인 골드·오브젝트·매치 평균은 홈 사이드(매치 평균)가 이미 말하고 이 표의
//    열(밴·승·픽·채택)에 들어갈 자리가 없다.
// ② 라인 축: "전체"는 scope=all 행(3세그먼트 id), 특정 라인은 그 라인의 position 행(4세그먼트)만.
//    밴은 라인 무관이라 라인 선택 시 셀이 비고, 아이템은 라인 축이 없어 "전체"에서만 나온다
//    (기존 `filterByLane`과 같은 결정 — HANDOFF §6 "라인별 밴률 컬럼을 만들지 말 것").
// ③ 셀 = **보고 가능** 지표만: 노이즈 상태가 아니고(`isNoiseStatus`) 유의하며(`isSignificantDelta`)
//    효과크기 바닥을 넘는(`meetsEffectFloor`) 행. 홈 카드 대표 관측(`selectReportableObservation`)과
//    같은 잣대라 두 화면이 서로를 반박하지 않는다.
// ④ 보고 가능 셀이 0인 엔티티는 행이 없다 — 사용자 C1 "아예 보여주지 않도록". 판정 파일은 그대로다.
// ⑤ 대표 상태 = 셀 중 `DISPLAY_SORT_PRIORITY` 최우선. ⑥ 정렬 = 상태 우선순위 → |Δ| 내림차순.
import type { DeltaEntityType, DeltaRecord } from "@/pipeline/types";
import { type LaneAxis, parseLaneAxis } from "@/lib/lane";
import { meetsEffectFloor } from "@/pipeline/aggregate/stats";
import { isSignificantDelta } from "@/pipeline/shared/significance";
import {
  DISPLAY_SORT_PRIORITY,
  displayStatus,
  isNoiseStatus,
  type DisplayStatus,
} from "@/pipeline/shared/display-status";

/** 표의 지표 열 — 이 순서로 렌더한다. */
export const ENTITY_METRICS = ["banRate", "winRate", "pickRate", "adoptionRate"] as const;
export type EntityMetric = (typeof ENTITY_METRICS)[number];

export interface EntityCompareRow {
  /** `${entityType}:${entityKey}` — React key·스크롤 포커스 대상. */
  key: string;
  entityType: Extract<DeltaEntityType, "champion" | "item">;
  entityKey: string;
  entityName: string;
  /** 셀이 어느 라인 축에서 왔는가("all" = scope all 행). */
  lane: LaneAxis;
  /** 보고 가능한 지표만 든다. 없는 지표는 키 자체가 없다(빈 셀 `—`). */
  cells: Partial<Record<EntityMetric, DeltaRecord>>;
  /** 셀 중 최우선 표시 키. */
  status: DisplayStatus;
  /** |Δ| 최대 보고 셀 — 상세 링크·강조에 쓴다. */
  representative: DeltaRecord;
  /** 셀들의 matchedNoteIds 합집합 — 좌 내비 선택과의 연결. */
  matchedNoteIds: string[];
  maxAbsDelta: number;
}

function isEntityMetric(metric: string): metric is EntityMetric {
  return (ENTITY_METRICS as readonly string[]).includes(metric);
}

/** 화면에 올릴 자격 — 노이즈 아님 ∧ 유의 ∧ 효과크기 바닥 통과. */
export function isReportableRecord(record: DeltaRecord, qAlpha?: number): boolean {
  if (isNoiseStatus(record.status)) return false;
  if (record.delta === null) return false;
  if (!isSignificantDelta(record, qAlpha)) return false;
  return meetsEffectFloor(record.metric, record.delta, record.before);
}

/** 이 행이 선택한 라인 축에 속하는가(규칙 ②). */
function belongsToLane(record: DeltaRecord, lane: LaneAxis): boolean {
  if (record.entityType === "item") return lane === "all";
  return parseLaneAxis(record.id) === lane;
}

export function buildEntityRows(
  rows: readonly DeltaRecord[],
  lane: LaneAxis,
  qAlpha?: number
): EntityCompareRow[] {
  const order: string[] = [];
  const byKey = new Map<string, EntityCompareRow>();

  for (const record of rows) {
    if (record.entityType !== "champion" && record.entityType !== "item") continue;
    if (!isEntityMetric(record.metric)) continue;
    if (!belongsToLane(record, lane)) continue;
    if (!isReportableRecord(record, qAlpha)) continue;

    const key = `${record.entityType}:${record.entityKey}`;
    const shown = displayStatus(record, qAlpha);
    const abs = Math.abs(record.delta ?? 0);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        key,
        entityType: record.entityType,
        entityKey: record.entityKey,
        entityName: record.entityName,
        lane,
        cells: { [record.metric]: record },
        status: shown,
        representative: record,
        matchedNoteIds: [...record.matchedNoteIds],
        maxAbsDelta: abs,
      });
      order.push(key);
      continue;
    }
    existing.cells[record.metric] = record;
    if (DISPLAY_SORT_PRIORITY[shown] < DISPLAY_SORT_PRIORITY[existing.status]) existing.status = shown;
    if (abs > existing.maxAbsDelta) {
      existing.maxAbsDelta = abs;
      existing.representative = record;
    }
    for (const id of record.matchedNoteIds) {
      if (!existing.matchedNoteIds.includes(id)) existing.matchedNoteIds.push(id);
    }
  }

  return order
    .map((key) => byKey.get(key)!)
    .sort(
      (a, b) =>
        DISPLAY_SORT_PRIORITY[a.status] - DISPLAY_SORT_PRIORITY[b.status] || b.maxAbsDelta - a.maxAbsDelta
    );
}
