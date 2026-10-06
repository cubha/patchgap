// src/components/item/chartData.ts
// 항목 상세 델타 차트(ST-12) 데이터 변환 — 순수 함수, 부수효과 없음(테스트 대상). fs 등 I/O는
// 이 파일에서 절대 하지 않는다 — champions.json/items.json에서 패치별 저장 CI를 찾는 것은
// 호출부(ST-K가 배선할 page.tsx 등) 책임이고, 이 함수는 이미 조회된 `Interval | null`만 받는다.
//
// 편차(ST-12 지시 반영): 프로토타입 03의 주 차트는 "일별 시계열"이지만 집계는 패치 단위라
// 일별 값이 데이터에 없다 — 그래서 이 함수는 "전/후 2점 + CI 오차 막대" 데이터만 만든다.
//
// 오차 막대 전략은 두 갈래다(ST-E, 2026-09-10):
// 1) **저장 CI 우선**: `storedCi`(before/after 각 패치 자신의 Wilson CI)가 주어지고 둘 다
//    non-null이며 kind==="pp"(챔피언 pick/ban/win, 아이템 adoptionRate — types.ts상 저장 CI가
//    존재하는 지표와 정확히 일치)이면, before/after 각 막대에 **자기 패치·자기 값** 기준 오프셋을
//    싣는다. 한쪽만 CI가 없으면(예: winRate n게이트 미달로 ci.win===null) 서로 다른 종류의
//    구간을 한 차트에 섞지 않도록 **양쪽 다** 아래 2)로 폴백한다.
// 2) **델타 CI 폴백(기존, ST-12 원안)**: storedCi가 없거나 위 조건 미충족이면(goldAt10/goldAt14/
//    firstSec/avgDurationSec는 저장 CI 자체가 없어 항상 이 경로), DeltaRecord의 "차이(delta)"
//    CI(`ci`) 하나만 있으므로 오차 막대는 "전(before)"이 아니라 "후(after)" 막대에 (delta의 CI
//    반영한) 폭으로 붙인다 — before+ci[0] ~ before+ci[1] 구간을 after 막대 기준
//    offset [errLow, errHigh]로 환산한다(self-pair 실측: delta=0, ci=[-0.014,0.014] →
//    errLow=errHigh=0.014, 대칭 확인).

import type { DeltaRecord, Interval } from "@/pipeline/types";
import { type MetricKind, metricKind } from "./metricFormat";

/** before/after 각 패치 자신의 저장 CI(챔피언 pick/ban/win, 아이템 adoptionRate) — 호출부가
 * champions.json/items.json에서 미리 조회해 넘긴다. 조회 실패(파일 없음·행 없음·게이트 미달로
 * null)는 그대로 `null`로 넘기면 buildChartData가 조용히 델타-CI 폴백으로 떨어진다. */
export interface StoredCi {
  before: Interval | null;
  after: Interval | null;
}

/** 차트 막대 1개(전 또는 후) — recharts에 그대로 넘기는 행. */
export interface ChartBarDatum {
  key: "before" | "after";
  label: string;
  /** 원시 단위(비율 0~1 / 초 / 골드) — 라벨 텍스트 포맷팅용. */
  rawValue: number | null;
  /** 차트에 실제로 그릴 값 — kind="pp"는 ×100(퍼센트 스케일), 그 외는 원시값 그대로. */
  chartValue: number | null;
  /** recharts ErrorBar dataKey용 [하한 오프셋, 상한 오프셋](chartValue와 동일 스케일). */
  error: [number, number];
}

export interface ItemChartData {
  kind: MetricKind;
  /** before/after 둘 다 null이 아니어야 true — false면 차트 대신 빈 상태 문구를 렌더한다. */
  hasData: boolean;
  /** true면 오차 막대를 일부러 생략했다는 뜻(표본 부족 — 아래 참고). 차트가 hasData=true로
   * 값 막대는 그리되 CI를 신뢰할 수 없어 숨겼음을 호출부가 캡션으로 알릴 수 있게 한다. */
  errorSuppressed: boolean;
  bars: [ChartBarDatum, ChartBarDatum];
  /** before/after 각 패치 자신의 저장 CI(storedCi 경로가 실제로 적용된 경우만) — 범례의
   * CI 실측값 병기(`[46.3, 48.2] · [33.3, 35.2]`, HANDOFF §4-3)용 원본 Interval. 델타-CI
   * 폴백(after 막대만 CI)이거나 errorSuppressed면 null — before의 "자기 CI"가 없는데
   * 값을 지어내지 않는다(무근거 문장 금지). */
  barCi: { before: Interval; after: Interval } | null;
  /**
   * 막대 아래 값 표기를 호출부가 정한다(2026-10-06 상세 공통 관측 섹션 — 네 상세가 같은 차트를 쓴다). 없으면
   * `kind`로 포맷한다. TFT 평균 등수(「4.35등」)·PUBG 맵 평균 매치 시간(「29:29」)처럼 세 단위 밖의 값이 이 길로 온다.
   */
  valueText?: [string, string];
}

function scaleFor(kind: MetricKind): number {
  return kind === "pp" ? 100 : 1;
}

/** value(원시 단위) 기준 [lo,hi] 구간을 scale 적용한 [errLow, errHigh] 오프셋으로 환산.
 * 음수 오프셋은 방지(Math.max(0, …)) — value가 구간 밖(방어적 케이스)이어도 차트가 깨지지 않게. */
function offsetFor(value: number, [lo, hi]: Interval, scale: number): [number, number] {
  return [Math.max(0, (value - lo) * scale), Math.max(0, (hi - value) * scale)];
}

/** storedCi가 실제로 쓸 수 있는 상태인지 판정 — kind가 "pp"(저장 CI 존재 지표와 정확히
 * 일치)이고 before/after 둘 다 non-null일 때만 사용한다(한쪽만 있으면 전부 폴백 — 서로 다른
 * 종류의 구간을 한 차트에 섞지 않기 위함). */
function resolveUsableStoredCi(
  kind: MetricKind,
  storedCi: StoredCi | undefined
): { before: Interval; after: Interval } | null {
  if (kind !== "pp" || !storedCi) return null;
  if (storedCi.before === null || storedCi.after === null) return null;
  return { before: storedCi.before, after: storedCi.after };
}

/**
 * DeltaRecord → 전/후 막대 차트 데이터. beforeLabel/afterLabel은 보통 패치 번호("26.16"/
 * "26.17")를 넘기고, 미지정 시 "전"/"후"로 표시한다.
 *
 * `suppressError`(기본 false): true면 오차 막대를 강제로 [0,0]으로 만든다 — UX-BRIEF §1
 * 불변 원칙 "승률은 n 게이트 미달 시 '표본 부족' 라벨(델타 미제시)"에 따라 `status ===
 * "insufficient-sample"`인 델타는 표본이 너무 작아(예: n=8) CI가 무의미하게 넓어지는 문제가
 * 실측 있었다(LeeSin TOP winRate: ci=[-0.398,0.398] → 62.5% 막대에 ±39.8pp 오차 막대) — 그런
 * 경우 호출부가 이 플래그를 넘겨 오차 막대를 숨긴다. storedCi가 있어도 suppressError가 항상
 * 우선한다.
 *
 * `storedCi`(옵션, ST-E 신규): 파일 상단 주석의 전략 1)을 활성화한다. 미지정(undefined) 시
 * 기존 델타-CI 폴백만 동작 — 이 함수를 아직 storedCi 없이 호출하는 기존 호출부(예: 현재
 * page.tsx)는 동작이 전혀 바뀌지 않는다.
 */
export function buildChartData(
  delta: DeltaRecord,
  beforeLabel = "전",
  afterLabel = "후",
  suppressError = false,
  storedCi?: StoredCi
): ItemChartData {
  const kind = metricKind(delta.metric);
  const scale = scaleFor(kind);
  const hasData = delta.before !== null && delta.after !== null;

  const bars: [ChartBarDatum, ChartBarDatum] = [
    {
      key: "before",
      label: beforeLabel,
      rawValue: delta.before,
      chartValue: delta.before === null ? null : delta.before * scale,
      error: [0, 0],
    },
    {
      key: "after",
      label: afterLabel,
      rawValue: delta.after,
      chartValue: delta.after === null ? null : delta.after * scale,
      error: [0, 0],
    },
  ];

  let errorSuppressed = false;
  let barCi: { before: Interval; after: Interval } | null = null;
  if (hasData && delta.delta !== null) {
    const usableStoredCi = resolveUsableStoredCi(kind, storedCi);
    if (suppressError) {
      errorSuppressed = true;
    } else if (usableStoredCi && delta.before !== null && delta.after !== null) {
      bars[0] = { ...bars[0], error: offsetFor(delta.before, usableStoredCi.before, scale) };
      bars[1] = { ...bars[1], error: offsetFor(delta.after, usableStoredCi.after, scale) };
      barCi = usableStoredCi;
    } else {
      const [lo, hi]: Interval = delta.ci;
      const errLow = Math.max(0, (delta.delta - lo) * scale);
      const errHigh = Math.max(0, (hi - delta.delta) * scale);
      bars[1] = { ...bars[1], error: [errLow, errHigh] };
    }
  }

  return { kind, hasData, errorSuppressed, bars, barCi };
}

/**
 * 판정 행이 아닌 값 두 개로 차트 데이터를 만든다(2026-10-06 상세 공통 관측 섹션 — PUBG 무기·맵).
 * 오차 막대는 그리지 않는다: PUBG 무기의 CI는 **상대 변화**의 구간이라 막대 높이와 같은 축이 아니고, 맵은
 * 판정을 만들지 않아 CI가 없다. `chartValue`는 원시값 그대로이며 표기는 `valueText`가 소유한다.
 */
export function valuesChartData(
  before: number | null,
  after: number | null,
  valueText: [string, string],
  beforeLabel = "전",
  afterLabel = "후"
): ItemChartData {
  return {
    kind: "gold",
    hasData: before !== null && after !== null,
    errorSuppressed: false,
    bars: [
      { key: "before", label: beforeLabel, rawValue: before, chartValue: before, error: [0, 0] },
      { key: "after", label: afterLabel, rawValue: after, chartValue: after, error: [0, 0] },
    ],
    barCi: null,
    valueText,
  };
}
