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
// ② 라인 축: 특정 라인은 그 라인의 position 행(4세그먼트)만. "전체"는 scope=all 행(3세그먼트)을 우선하되,
//    그 지표의 all 행이 보고 가능하지 않으면 **보고 가능한 position 행 중 |Δ| 최대**를 대표로 쓰고 셀에
//    라인을 표기한다(실측 26.18: 에코의 유일한 이상 관측은 미드 승률이라 all 행만 보면 표에서 사라지고,
//    좌 내비 배지 "공지 · 이상 관측"과 표가 서로를 반박했다). 밴은 라인 무관이라 라인 선택 시 셀이 비고,
//    아이템은 라인 축이 없어 "전체"에서만 나온다(HANDOFF §6 "라인별 밴률 컬럼을 만들지 말 것").
// ③ 셀 = **보고 가능** 지표만: 노이즈 상태가 아니고(`isNoiseStatus`) 유의하며(`isSignificantDelta`)
//    효과크기 바닥을 넘는(`meetsEffectFloor`) 행. 홈 카드 대표 관측(`selectReportableObservation`)과
//    같은 잣대라 두 화면이 서로를 반박하지 않는다.
// ④ 보고 가능 셀이 0인 엔티티는 행이 없다 — 사용자 C1 "아예 보여주지 않도록". 판정 파일은 그대로다.
// ⑤ 대표 상태 = 셀 중 `DISPLAY_SORT_PRIORITY` 최우선. ⑥ 정렬 = 상태 우선순위 → |Δ| 내림차순.
import type { DeltaEntityType, DeltaRecord } from "@/pipeline/types";
import { type LaneAxis, parseLaneAxis } from "@/lib/lane";
import { DISPLAY_SORT_PRIORITY, displayStatus, type DisplayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";

// 술어는 shared에 있다(홈과 같은 잣대) — 기존 호출부·테스트를 위해 여기서 재export한다.
export { isReportableRecord };

/** 표의 지표 열 — 이 순서로 렌더한다. */
export const ENTITY_METRICS = ["banRate", "winRate", "pickRate", "adoptionRate"] as const;
export type EntityMetric = (typeof ENTITY_METRICS)[number];

/** 셀 1개 — 어느 라인 축의 행인지 함께 든다("all"이 아니면 셀에 라인 태그를 그린다). */
export interface EntityCell {
  record: DeltaRecord;
  lane: LaneAxis;
}

export interface EntityCompareRow {
  /** `${entityType}:${entityKey}` — React key·스크롤 포커스 대상. */
  key: string;
  entityType: Extract<DeltaEntityType, "champion" | "item">;
  entityKey: string;
  entityName: string;
  /** 선택한 라인 축("all" = 전체 보기). */
  lane: LaneAxis;
  /** 보고 가능한 지표만 든다. 없는 지표는 키 자체가 없다(빈 셀 `—`). */
  cells: Partial<Record<EntityMetric, EntityCell>>;
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

/** 이 행의 라인 축 — 아이템은 라인이 없어 "all"로 본다. 파싱 불가(비챔피언 id 형태)는 null. */
function laneOf(record: DeltaRecord): LaneAxis | null {
  if (record.entityType === "item") return "all";
  return parseLaneAxis(record.id);
}

/** 같은 지표에 후보가 둘일 때 어느 쪽이 셀을 차지하는가 — all 행 우선, 그다음 |Δ|. */
function betterCell(candidate: EntityCell, current: EntityCell): boolean {
  if (candidate.lane === "all" && current.lane !== "all") return true;
  if (candidate.lane !== "all" && current.lane === "all") return false;
  return Math.abs(candidate.record.delta ?? 0) > Math.abs(current.record.delta ?? 0);
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
    const recordLane = laneOf(record);
    if (recordLane === null) continue;
    // 특정 라인: 그 라인의 행만. 전체: 모든 라인의 행이 후보(all 우선은 betterCell이 정한다).
    if (lane !== "all" && recordLane !== lane) continue;
    if (!isReportableRecord(record, qAlpha)) continue;

    const key = `${record.entityType}:${record.entityKey}`;
    const cell: EntityCell = { record, lane: recordLane };
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        key,
        entityType: record.entityType,
        entityKey: record.entityKey,
        entityName: record.entityName,
        lane,
        cells: { [record.metric]: cell },
        status: displayStatus(record, qAlpha),
        representative: record,
        matchedNoteIds: [...record.matchedNoteIds],
        maxAbsDelta: Math.abs(record.delta ?? 0),
      });
      order.push(key);
    } else {
      const current = existing.cells[record.metric];
      if (!current || betterCell(cell, current)) existing.cells[record.metric] = cell;
      for (const id of record.matchedNoteIds) {
        if (!existing.matchedNoteIds.includes(id)) existing.matchedNoteIds.push(id);
      }
    }
  }

  // 대표 상태·대표 델타·|Δ|는 **셀로 확정된 행**에서 계산한다(후보였다가 밀린 행이 상태를 올리면 안 된다).
  const out = order.map((key) => byKey.get(key)!);
  for (const row of out) {
    const cells = Object.values(row.cells) as EntityCell[];
    let status: DisplayStatus = displayStatus(cells[0].record, qAlpha);
    let representative = cells[0].record;
    let maxAbs = Math.abs(representative.delta ?? 0);
    for (const cell of cells) {
      const shown = displayStatus(cell.record, qAlpha);
      if (DISPLAY_SORT_PRIORITY[shown] < DISPLAY_SORT_PRIORITY[status]) status = shown;
      const abs = Math.abs(cell.record.delta ?? 0);
      if (abs > maxAbs) {
        maxAbs = abs;
        representative = cell.record;
      }
    }
    row.status = status;
    row.representative = representative;
    row.maxAbsDelta = maxAbs;
  }

  return out.sort(
    (a, b) =>
      DISPLAY_SORT_PRIORITY[a.status] - DISPLAY_SORT_PRIORITY[b.status] || b.maxAbsDelta - a.maxAbsDelta
  );
}
