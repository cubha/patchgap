// src/components/home/laneDistribution.ts
// 라인(포지션)별 "미공지" 엔티티 분포 집계 — 순수 함수. 미공지 판정 자체(status==="unannounced"
// 필터링)는 별도 SubTask(ST-B) 책임이며, 이 함수는 이미 판정이 끝난 "노트 없는 델타 엔티티
// 집합"을 인자로 받아 라인별로 분포시키기만 한다(team-dev ST-C 프롬프트 — ST-B 완료를 기다리지
// 않고 DeltaRecord[] 계약만 맞춘 인터페이스).

import type { DeltaRecord } from "@/pipeline/types";
import { positionLabel } from "@/lib/format";
import { parseLaneAxis, type LaneAxis } from "@/lib/lane";

/** 라인별 분포 1행 — UI가 그대로 소비할 수 있도록 한글 라벨까지 포함한다. */
export interface LaneDistributionRow {
  lane: LaneAxis;
  /** `"all"`은 `lib/format.ts`의 `POSITION_LABELS`에 없는 축이라 이 파일에서 "전체"로 별도
   * 매핑하고, 5개 명명 포지션은 `positionLabel`(라인 라벨 SSOT)을 그대로 재사용한다. */
  label: string;
  count: number;
}

const LANE_ORDER: readonly LaneAxis[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "all"];

function laneLabel(lane: LaneAxis): string {
  return lane === "all" ? "전체" : positionLabel(lane);
}

/**
 * "미공지" 델타 엔티티 집합(호출부가 `status==="unannounced"` 등으로 이미 필터링한 레코드)을
 * 받아 라인별 엔티티 수로 분포시킨다.
 * - `banRate`는 엄격히 제외한다 — position-scope 행에서 `banRate`(`ci.ban`)는 항상 null이라
 *   라인 축 집계에 섞일 이유가 없다(HANDOFF §6 "라인별 밴률 컬럼 금지"와 동일 근거). pick/win
 *   계열 값만 라인 축 분포에 반영한다.
 * - id 파싱 실패(champion 이외 entityType, 잘못된 세그먼트 형식)인 행은 조용히 제외한다.
 * - 같은 엔티티가 같은 라인에서 여러 metric 행(예: pickRate+winRate)을 가질 수 있으므로
 *   `${lane}:${entityKey}`로 중복 제거한 뒤 개수를 센다 — "엔티티 수"이지 "행 수"가 아니다.
 */
export function computeLaneDistribution(records: readonly DeltaRecord[]): LaneDistributionRow[] {
  const seen = new Set<string>();
  const counts = new Map<LaneAxis, number>();

  for (const record of records) {
    if (record.metric === "banRate") continue;
    const lane = parseLaneAxis(record.id);
    if (lane === null) continue;

    const dedupeKey = `${lane}:${record.entityKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    counts.set(lane, (counts.get(lane) ?? 0) + 1);
  }

  return LANE_ORDER.map((lane) => ({
    lane,
    label: laneLabel(lane),
    count: counts.get(lane) ?? 0,
  }));
}

export function laneDistributionScope(records: readonly DeltaRecord[], gapTotal: number): { gapTotal: number; covered: number; other: number } {
  void records;
  void gapTotal;
  throw new Error("TODO(laneDistribution): laneDistributionScope");
}
