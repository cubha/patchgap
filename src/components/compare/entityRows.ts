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
// ② 라인 축(2026-09-20 개정): 특정 라인은 그 라인의 position 행(4세그먼트)만. **"전체"에서는 scope=all
//    행과 position 행이 경쟁하지 않고 셀에 나란히 실린다** — 전체가 1급이고, 그 지표의 라인 행이
//    보고 가능할 때만 라인이 추가된다(사용자: "전체가 default, 유의미한 라인별지표가있을때만 추가로").
//    옛 규칙은 "all 우선, all이 보고 가능하지 않으면 position 중 |Δ| 최대가 대표"였는데 두 곳에서 깨졌다:
//    전체가 이기면 라인 수치가 사라지고(실측 16칸), 라인이 이기면 축 표시가 작은 글리프뿐이라 전체
//    수치처럼 읽혔다. 에코·아트록스 사례(유일한 이상 관측이 한 라인에만 있다)는 이제 `전체 —` + 라인
//    관측으로 그려진다. 밴은 라인 무관이라 라인 선택 시 셀이 비고, 아이템은 라인 축이 없어 "전체"에서만
//    나온다(HANDOFF §6 "라인별 밴률 컬럼을 만들지 말 것").
// ③ 셀 = **보고 가능** 지표만: 노이즈 상태가 아니고(`isNoiseStatus`) 유의하며(`isSignificantDelta`)
//    효과크기 바닥을 넘는(`meetsEffectFloor`) 행. 홈 카드 대표 관측(`selectReportableObservation`)과
//    같은 잣대라 두 화면이 서로를 반박하지 않는다.
// ④ 보고 가능 셀이 0인 엔티티는 행이 없다 — 사용자 C1 "아예 보여주지 않도록". 판정 파일은 그대로다.
// ⑤ 대표 상태 = 셀 중 `DISPLAY_SORT_PRIORITY` 최우선. ⑥ 정렬 = 상태 우선순위 → |Δ| 내림차순.
import type { DeltaEntityType, DeltaRecord } from "@/pipeline/types";
import { type LaneAxis, parseLaneAxis } from "@/lib/lane";
import { DISPLAY_SORT_PRIORITY, displayStatus, type DisplayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { submarineOnlyEntities, type SubmarineIndex } from "@/pipeline/gamedata/submarine";
import type { GameDataChange } from "@/pipeline/gamedata/types";

// 술어는 shared에 있다(홈과 같은 잣대) — 기존 호출부·테스트를 위해 여기서 재export한다.
export { isReportableRecord };

/** 표의 지표 열 — 이 순서로 렌더한다. */
export const ENTITY_METRICS = ["banRate", "winRate", "pickRate", "adoptionRate"] as const;
export type EntityMetric = (typeof ENTITY_METRICS)[number];

/** 라인 한정 관측 1건 — 어느 라인의 행인지 함께 든다. */
export interface LaneObservation {
  record: DeltaRecord;
  lane: Exclude<LaneAxis, "all">;
}

/**
 * 셀 1개 — **축을 접지 않는다**(2026-09-20 사용자 지적).
 *
 * 이전엔 지표당 행 하나만 남겨서 `전체` 행과 `라인` 행이 같은 자리를 놓고 경쟁했고, 이긴 쪽만
 * 그렸다. 두 부작용이 있었다: ① 전체 행이 이기면 라인 수치가 **사라진다**(26.17→26.18 실측
 * 16칸) ② 라인 행이 이기면 전체 수치처럼 **보인다** — 축 표시가 작은 글리프 하나뿐이라
 * "오공 승률 ▼10.8%p"(전체)와 "아트록스 승률 ▼10.0%p ㅜ탑"(탑 한정)이 같은 종류의 숫자로
 * 읽혔다. 둘은 모집단이 다른 별개 관측이다.
 *
 * 이제 둘을 나란히 든다. 한 지표에 라인 행이 둘 이상 보고 가능한 경우는 실측 0건이라(26.17→26.18)
 * 칸이 세로로 길어질 일은 없고, 둘 이상이면 |Δ| 최대 하나만 대표로 든다.
 */
export interface EntityCell {
  /** scope=all 행 — 보고 가능할 때만. 라인 필터가 걸려 있으면 항상 null(그 라인만 본다). */
  overall: DeltaRecord | null;
  /** 라인 한정 행 — 보고 가능한 것 중 |Δ| 최대. */
  lane: LaneObservation | null;
  /** 상세 링크·|Δ| 정렬이 쓰는 대표 — 전체 우선, 없으면 라인. */
  representative: DeltaRecord;
}

/** 셀이 든 관측 전부 — 상태·|Δ| 계산은 그린 것만 본다(후보였다 밀린 행이 상태를 올리면 안 된다). */
function cellRecords(cell: EntityCell): DeltaRecord[] {
  const out: DeltaRecord[] = [];
  if (cell.overall) out.push(cell.overall);
  if (cell.lane) out.push(cell.lane.record);
  return out;
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
  /**
   * |Δ| 최대 보고 셀 — 상세 링크·강조에 쓴다.
   *
   * **`null`일 수 있다**(2026-09-21): 잠수함 전용 행은 관측이 하나도 없다. 그런 행은 상세로
   * 갈 자리가 없으므로 이름을 링크 없이 그린다 — 없는 링크를 만들지 않는다.
   */
  representative: DeltaRecord | null;
  /**
   * 이 엔티티의 **원본 수치 변경 중 패치노트에 없는 것**(2026-09-21). 비어 있으면 수치 축에서는
   * 할 말이 없다는 뜻이다.
   *
   * 지표 축(`status`)과 직교한다 — 승률이 안 움직였어도 여기 값이 있으면 잠수함 패치다. 다만
   * **이 표는 "지표가 움직인 것들의 표"**라서, 델타가 아예 없는 엔티티는 여기 행이 생기지 않는다.
   * 그런 건은 홈의 잠수함 섹션이 맡는다(`SubmarineSection`) — 표의 의미를 지키기 위한 경계다.
   */
  submarineChanges: readonly GameDataChange[];
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

/** 셀에 관측 1건을 축에 맞는 자리로 넣는다. 라인 자리가 이미 찼으면 |Δ| 큰 쪽이 남는다. */
function placeInCell(cell: EntityCell, record: DeltaRecord, lane: LaneAxis): void {
  if (lane === "all") {
    cell.overall = record;
  } else {
    const current = cell.lane;
    if (!current || Math.abs(record.delta ?? 0) > Math.abs(current.record.delta ?? 0)) {
      cell.lane = { record, lane };
    }
  }
  cell.representative = cell.overall ?? cell.lane!.record;
}

function newCell(record: DeltaRecord, lane: LaneAxis): EntityCell {
  const cell: EntityCell = { overall: null, lane: null, representative: record };
  placeInCell(cell, record, lane);
  return cell;
}

export function buildEntityRows(
  rows: readonly DeltaRecord[],
  lane: LaneAxis,
  qAlpha?: number,
  /** 수치 축 색인. 주면 해당 엔티티의 상태를 `submarine`으로 덮는다(증거 등급이 더 높다). */
  submarine?: SubmarineIndex
): EntityCompareRow[] {
  const order: string[] = [];
  const byKey = new Map<string, EntityCompareRow>();

  for (const record of rows) {
    if (record.entityType !== "champion" && record.entityType !== "item") continue;
    if (!isEntityMetric(record.metric)) continue;
    const recordLane = laneOf(record);
    if (recordLane === null) continue;
    // 특정 라인: 그 라인의 행만. 전체: 전체 행과 라인 행이 둘 다 후보이고 경쟁하지 않는다
    // (각자 제 축 자리로 간다 — placeInCell).
    if (lane !== "all" && recordLane !== lane) continue;
    if (!isReportableRecord(record, qAlpha)) continue;

    const key = `${record.entityType}:${record.entityKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        key,
        entityType: record.entityType,
        entityKey: record.entityKey,
        entityName: record.entityName,
        lane,
        cells: { [record.metric]: newCell(record, recordLane) },
        status: displayStatus(record, qAlpha),
        representative: record,
        submarineChanges: [],
        matchedNoteIds: [...record.matchedNoteIds],
        maxAbsDelta: Math.abs(record.delta ?? 0),
      });
      order.push(key);
    } else {
      const current = existing.cells[record.metric];
      if (current) placeInCell(current, record, recordLane);
      else existing.cells[record.metric] = newCell(record, recordLane);
      for (const id of record.matchedNoteIds) {
        if (!existing.matchedNoteIds.includes(id)) existing.matchedNoteIds.push(id);
      }
    }
  }

  // 대표 상태·대표 델타·|Δ|는 **셀로 확정된 행**에서 계산한다(후보였다가 밀린 행이 상태를 올리면 안 된다).
  const out = order.map((key) => byKey.get(key)!);
  for (const row of out) {
    const records = (Object.values(row.cells) as EntityCell[]).flatMap(cellRecords);
    let status: DisplayStatus = displayStatus(records[0], qAlpha);
    let representative = records[0];
    let maxAbs = Math.abs(representative.delta ?? 0);
    for (const record of records) {
      const shown = displayStatus(record, qAlpha);
      if (DISPLAY_SORT_PRIORITY[shown] < DISPLAY_SORT_PRIORITY[status]) status = shown;
      const abs = Math.abs(record.delta ?? 0);
      if (abs > maxAbs) {
        maxAbs = abs;
        representative = record;
      }
    }
    // 수치 축이 지표 축을 덮는다 — 통계가 "움직였다"고 말하는 것과 게임사 데이터가 "바꿨다"고
    // 말하는 것은 증거 등급이 다르다(display-status.ts DISPLAY_SORT_PRIORITY 헤더 참고).
    const changes = submarine?.changesOf(row.entityType, row.entityKey) ?? [];
    row.submarineChanges = changes;
    row.status = changes.length > 0 ? "submarine" : status;
    row.representative = representative;
    row.maxAbsDelta = maxAbs;
  }

  // 지표 축 게이트를 **통과하지 못한** 잠수함 엔티티도 행을 만든다(2026-09-21 사용자 지시).
  // 표본 부족·바닥 미달·무변화는 지표 축의 규율이지 수치 축의 규율이 아니다 — 패치노트에 없는
  // 수치 변경은 그 자체로 발견이고, 지표가 안 움직였다는 사실이 그것을 약화시키지 않는다.
  if (submarine) {
    for (const entity of submarineOnlyEntities(submarine, new Set(out.map((r) => r.key)))) {
      if (entity.entityType !== "champion" && entity.entityType !== "item") continue;
      out.push({
        key: `${entity.entityType}:${entity.entityKey}`,
        entityType: entity.entityType,
        entityKey: entity.entityKey,
        entityName: entity.entityName,
        lane,
        cells: {},
        status: "submarine",
        representative: null,
        submarineChanges: entity.changes,
        matchedNoteIds: [],
        maxAbsDelta: 0,
      });
    }
  }

  return out.sort(
    (a, b) =>
      DISPLAY_SORT_PRIORITY[a.status] - DISPLAY_SORT_PRIORITY[b.status] || b.maxAbsDelta - a.maxAbsDelta
  );
}
