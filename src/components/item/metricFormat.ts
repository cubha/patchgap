// src/components/item/metricFormat.ts
// 항목 상세(ST-12) 전용 지표 표시 헬퍼 — 값 분류·표기는 src/lib/format.ts가 소유하고 여기선
// 재노출만 한다. 이 파일 고유의 것은 lib/format.ts가 커버하지 못하는 "firstSec"(오브젝트 첫
// 획득 시각, src/pipeline/match/delta.ts 확정 metric 이름 — entityName에 이미 "용"/"전령"/"바론"/"포탑"이 들어있고 metricLabel엔 이 키가 없다)
// 표시와, DeltaRecord.metric → DeltaValue/차트가 쓰는 단위 종류(kind) 매핑을 이 파일에 모은다.
// 순수 함수만 — 부수효과 없음(테스트 대상).

import type { Interval } from "@/pipeline/types";
import { displayMetricKind, formatDisplayValue, metricLabel, type DisplayMetricKind } from "@/lib/format";

/** DeltaValue/차트가 구분하는 값의 단위 종류 — 분류·표기는 `lib/format.ts`가 소유한다(2026-10-06 단일화).
 * 알려지지 않은 metric은 "gold"(원시 정수)로 떨어진다. */
export type MetricKind = DisplayMetricKind;
export const metricKind: (metric: string) => MetricKind = displayMetricKind;
export const formatMetricValue: (value: number | null, kind: MetricKind) => string = formatDisplayValue;

/**
 * 델타의 사람이 읽는 지표 라벨. "firstSec"만 `entityName`(오브젝트 한글명)과 조합해
 * "첫 {entityName} 시각"으로 만든다(format.ts의 `metricLabel("firstSec")`은 엔티티 비의존
 * 일반 라벨 "첫 처치 시각"을 반환 — 이 페이지는 entityName을 이미 갖고 있어 더 구체적으로
 * 표시한다) — 그 외 metric은 그대로 위임한다. 파라미터 타입은 `Pick<DeltaRecord,...>` 대신
 * 명시적 필드로 느슨하게 둔다 — `DeltaRecord.metric`이 `DeltaMetric` 유니온으로 좁혀진 뒤에도
 * (2026-09-05 리팩토링) 이 함수 자체는 알려지지 않은 metric 문자열까지 안전하게 받는 계약을
 * 유지해야 하기 때문(아래 테스트 "알려지지 않은 metric은 원본 문자열 그대로" 참고).
 */
export function displayMetricLabel(delta: { metric: string; entityName: string }): string {
  if (delta.metric === "firstSec") {
    return `첫 ${delta.entityName} 시각`;
  }
  return metricLabel(delta.metric);
}

/** 범례 CI 실측값 병기용 — `chartData.ts`의 `barCi`(항상 kind="pp"인 저장 CI, 비율 0~1)를
 * 시안 표기(`[46.3, 48.2]`, 소수 1자리 퍼센트)로 포맷한다. */
export function formatCiRange([lo, hi]: Interval): string {
  return `[${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`;
}
