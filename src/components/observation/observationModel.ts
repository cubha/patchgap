// src/components/observation/observationModel.ts
// 상세 공통 관측 섹션의 **입력 모델** — 「지표[] → 구간[] → 행」(2026-10-06 사용자 확정,
// PLAN-detail-observation-section-2026-10-06.md D2·D6).
//
// 게임은 행 타입이 다르다(LoL·TFT `DeltaRecord` · PUBG 무기 판정 행 · PUBG 맵 기술통계). 묶는 규칙은 하나라
// `groupObservations`가 제네릭으로 받고, 각 상세가 「무엇이 지표이고 무엇이 구간인가」만 알려 준다.
//
// **자격 필터는 호출부가 아니라 여기서 건다**(LoL). 2026-10-06 실측 결함: LoL 상세가 이 술어를 거치지 않아 아트록스
// 한 화면에 카드 13장(포지션별 승률 n=1~316 「표본 부족」, 원딜 픽률 0.01%→0% 포함)을 그렸다 — 걸러내면 1건이다.
// 술어는 대조표·홈과 같은 `isReportableRecord` 하나다(새 규칙을 만들지 않는다).
//
// 순수 모듈 — 클라이언트 번들에도 실릴 수 있다(Node 전용 의존 금지).
import { positionLabel } from "@/lib/format";
import { parseLaneAxis } from "@/lib/lane";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import type { DeltaRecord } from "@/pipeline/types";
import { displayMetricLabel } from "@/components/item/metricFormat";

export interface ObservationSegment<T> {
  key: string;
  label: string;
  item: T;
}

export interface ObservationMetric<T> {
  key: string;
  label: string;
  segments: ObservationSegment<T>[];
}

export interface ObservationModel<T> {
  metrics: ObservationMetric<T>[];
  /** 조합(탭 × 구간) 수 — 섹션 머리의 「보고할 관측 N건」. */
  count: number;
}

export interface ObservationSelection {
  metric: string;
  segment: string;
}

/** 구간 축이 없는 행이 쓰는 구간 키. LoL scope=all 행의 키와 같다(`parseLaneAxis`가 「all」을 돌려준다). */
export const ALL_SEGMENT = "all";

export interface ObservationAxes<T> {
  metricOf(item: T): string;
  segmentOf(item: T): string;
  metricLabel(key: string, item: T): string;
  segmentLabel(key: string): string;
  /** 탭 순서. 목록에 없는 지표는 뒤로, 처음 나온 순서대로. */
  metricOrder: readonly string[];
  /** 선택지 순서. 목록에 없는 구간은 뒤로. */
  segmentOrder: readonly string[];
}

const rankIn = (order: readonly string[], key: string): number => {
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
};

/**
 * 행들을 지표 → 구간으로 묶는다. 같은 (지표, 구간)이 두 번 오면 **먼저 온 행**이 남는다 — 호출부가 원하는 대표를
 * 앞에 두면 된다(지금 데이터에는 그런 중복이 없다: 행 id가 지표·구간을 품는다).
 */
export function groupObservations<T>(items: readonly T[], axes: ObservationAxes<T>): ObservationModel<T> {
  const byMetric = new Map<string, ObservationMetric<T>>();
  for (const item of items) {
    const metricKey = axes.metricOf(item);
    const segmentKey = axes.segmentOf(item);
    let metric = byMetric.get(metricKey);
    if (!metric) {
      metric = { key: metricKey, label: axes.metricLabel(metricKey, item), segments: [] };
      byMetric.set(metricKey, metric);
    }
    if (metric.segments.some((s) => s.key === segmentKey)) continue;
    metric.segments.push({ key: segmentKey, label: axes.segmentLabel(segmentKey), item });
  }

  const firstSeen = [...byMetric.keys()];
  const metrics = [...byMetric.values()].sort(
    (a, b) =>
      rankIn(axes.metricOrder, a.key) - rankIn(axes.metricOrder, b.key) ||
      firstSeen.indexOf(a.key) - firstSeen.indexOf(b.key)
  );
  for (const metric of metrics) {
    metric.segments.sort((a, b) => rankIn(axes.segmentOrder, a.key) - rankIn(axes.segmentOrder, b.key));
  }
  return { metrics, count: metrics.reduce((sum, m) => sum + m.segments.length, 0) };
}

/** LoL 탭 순서 — 시안(승률 · 픽률 · 밴률)이 앞이고, 아이템·라인·오브젝트 지표는 그 뒤다. */
export const LOL_METRIC_ORDER: readonly string[] = [
  "winRate",
  "pickRate",
  "banRate",
  "adoptionRate",
  "goldAt10",
  "goldAt14",
  "firstSec",
  "avgDurationSec",
];

/** 라인 선택지 순서 — 전체가 먼저, 그다음 맵 위에서 아래로(라인 필터 6종과 같은 순서). */
export const LANE_SEGMENT_ORDER: readonly string[] = [ALL_SEGMENT, "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

export const laneSegmentLabel = (key: string): string => (key === ALL_SEGMENT ? "전체" : positionLabel(key));

/**
 * LoL 상세의 관측 모델 — **보고 자격 행만**. 라인 축은 챔피언 id에만 있다(`parseLaneAxis`가 아이템·라인·
 * 오브젝트 id에 null을 돌려준다) — 그 행은 구간 하나(전체)다.
 */
export function lolObservationModel(rows: readonly DeltaRecord[], qAlpha?: number): ObservationModel<DeltaRecord> {
  const reportable = rows.filter((row) => isReportableRecord(row, qAlpha));
  return groupObservations(reportable, {
    metricOf: (row) => row.metric,
    segmentOf: (row) => parseLaneAxis(row.id) ?? ALL_SEGMENT,
    metricLabel: (_key, row) => displayMetricLabel(row),
    segmentLabel: laneSegmentLabel,
    metricOrder: LOL_METRIC_ORDER,
    segmentOrder: LANE_SEGMENT_ORDER,
  });
}

/**
 * 구 지표 별칭 id → 열 탭·구간. 별칭은 이미 디스코드로 나간 링크라(`detailRouteSlugs`) 그 링크가 가리키던 관측을
 * 처음에 보여 준다. 정준(대상) id는 지표를 말하지 않으므로 null — 기본 조합으로 연다.
 *
 * id 포맷(types.ts `DeltaRecord`): `champion:{key}:{metric}` · `champion:{key}:{pos}:{metric}` · `item:{id}:{metric}` ·
 * `lane:{pos}:{metric}` · `objective:{name}`(지표는 늘 firstSec이지만 id에 없다 → 2세그먼트라 정준과 같다).
 */
export function lolSelectionFromId(rawId: string): ObservationSelection | null {
  const segments = rawId.split(":");
  if (segments.length === 3) return { metric: segments[2], segment: ALL_SEGMENT };
  if (segments.length === 4) return { metric: segments[3], segment: parseLaneAxis(rawId) ?? ALL_SEGMENT };
  return null;
}

/**
 * 초기 선택을 정한다. 원하는 조합이 자격 조합이면 그것, 지표만 있으면 그 지표의 첫 구간, 아니면 첫 탭·첫 구간.
 * **자격 없는 조합을 가리키는 별칭은 그 행을 그리지 않는다** — 별칭 라우트는 상태만 보고 만들어지므로
 * (`detailRouteIds`) 비유의 공지 행(`champion~Aatrox~MIDDLE~pickRate`)도 URL이 있다.
 */
export function resolveSelection<T>(
  model: ObservationModel<T>,
  wanted: Partial<ObservationSelection> | null | undefined
): ObservationSelection | null {
  const first = model.metrics[0];
  if (!first) return null;
  const metric = model.metrics.find((m) => m.key === wanted?.metric);
  if (!metric) return { metric: first.key, segment: first.segments[0].key };
  const segment = metric.segments.find((s) => s.key === wanted?.segment) ?? metric.segments[0];
  return { metric: metric.key, segment: segment.key };
}
