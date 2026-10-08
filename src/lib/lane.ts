// src/lib/lane.ts
// 델타 레코드 id에서 라인(포지션) 축을 파싱하는 순수 함수. `champion:{key}:{metric}`(3세그먼트,
// scope="all") | `champion:{key}:{pos}:{metric}`(4세그먼트, scope="position") id 네임스페이스
// 규약은 pipeline/types.ts `DeltaRecord.id` 주석 확정본(ST-08)을 그대로 전제한다 —
// components/home/logic.ts의 `isAllScopeChampionRow`(세그먼트 수로 all/position만 구분)와 동일한
// 전제를 공유하되, 이 함수는 한 단계 더 나아가 실제 포지션 문자열까지 추출한다.

import type { DeltaRecord, LanePosition } from "@/pipeline/types";
import { isReportableRecord } from "@/pipeline/shared/reportable";

/** 델타 id에서 도출 가능한 "라인 축" 값 — 5개 명명 포지션 + 전체(scope=all) 행. */
export type LaneAxis = LanePosition | "all";

const LANE_POSITIONS: readonly LanePosition[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

function isLanePosition(value: string): value is LanePosition {
  return (LANE_POSITIONS as readonly string[]).includes(value);
}

/**
 * 챔피언 델타 id에서 라인 축을 파싱한다.
 * - 3세그먼트(`champion:{key}:{metric}`) → `"all"`(scope=all 행).
 * - 4세그먼트(`champion:{key}:{pos}:{metric}`)이고 3번째 세그먼트가 유효한 `LanePosition`이면
 *   그 포지션 값.
 * - 그 외(entityType이 `"champion"`이 아님 / 세그먼트 수가 3·4가 아님 / 4세그먼트인데 포지션
 *   세그먼트가 유효하지 않음)는 전부 `null`(조용히 폴백하지 않고 파싱 실패를 명시한다).
 */
export function parseLaneAxis(id: string): LaneAxis | null {
  const segments = id.split(":");
  if (segments[0] !== "champion") return null;
  if (segments.length === 3) return "all";
  if (segments.length === 4) {
    const pos = segments[2];
    return isLanePosition(pos) ? pos : null;
  }
  return null;
}

/**
 * 챔피언 **전체(scope=all)** 행인가 — 3세그먼트 id. 다른 entityType은 이 구분이 없어 항상 true(동점 처리).
 * 2026-10-08 `components/home/logic.ts`에서 이관(ST-08) — 카드 대표 선택(`noteDeltaIndex`)과 미리보기(`logic.ts`)가
 * 같은 술어를 보게 하려고. 전체 행을 라인 행보다 앞세우는 이유: 상세의 기본 보기가 전체 행이라, 카드가 라인 값을
 * 라벨 없이 보여 주면 상세 도착 값과 어긋난다(카직스 3.0→8.5 vs 3.3→8.6 실측).
 */
export function isAllScopeChampionRow(record: Pick<DeltaRecord, "id" | "entityType">): boolean {
  if (record.entityType !== "champion") return true;
  return record.id.split(":").length === 3;
}

/**
 * 주어진 `entityKey`가 가진 라인별(scope=position) 델타 행에서 실제 라인 집합을 도출한다 —
 * 홈 릴리즈노트 스트림의 라인 필터(HANDOFF-redesign-2026-09-10.md §4-1 "라인 필터 6종")가
 * 쓴다. 노트 항목 자체에는 라인 정보가 없으므로(ST-B releaseStream.ts는 entity 한글명만
 * 안다) 그 엔티티의 position-scope 델타 행에서 라인을 역산한다.
 * - scope=all 행(`parseLaneAxis`가 `"all"`을 반환)은 라인 정보가 아니므로 결과에 포함하지 않는다.
 * - 이 엔티티에 position-scope 델타 행이 하나도 없으면 빈 배열 — 호출부는 이를 "라인 필터 중
 *   '전체'에서만 노출"로 취급한다(라인을 추측해 채우지 않는다).
 */
export function lanesForEntityKey(
  records: readonly DeltaRecord[],
  entityKey: string,
  qAlpha?: number
): LanePosition[] {
  const lanes = new Set<LanePosition>();
  for (const record of records) {
    if (record.entityKey !== entityKey) continue;
    const lane = parseLaneAxis(record.id);
    if (lane === null || lane === "all") continue;
    // 그 라인에서 **보고 자격**을 얻은 행이 있을 때만 소속이다(ST-19, site-review lol-S6). 행이 있기만 하면 소속으로 치면
    // 26.19처럼 TOP 302행·BOTTOM 224행이 있는 데이터에서 거의 모든 챔피언이 모든 라인에 속해 칩이 아무것도 거르지 않는다.
    if (!isReportableRecord(record, qAlpha)) continue;
    lanes.add(lane);
  }
  return LANE_POSITIONS.filter((lane) => lanes.has(lane));
}
