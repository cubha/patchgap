// src/components/DeltaValue.tsx
// 델타 값 표시 — 상승 text-success ▲ / 하락 text-danger ▼ / 변화 없음 text-muted + CI 반폭 캡션.
// 구현 결정(ST-10): 프로토타입 01의 `.delta-row` 안 델타 값은 실제로는 화살표 glyph 없이
// 색상+부호만 쓰지만(사이드바 `.side-metric-row`만 화살표 사용), 이 태스크 명세가 명시적으로
// "▲/▼"를 요구하므로 명세를 따라 kind 3종 모두에 화살표를 통일 적용한다 — 프로토타입과의
// 의도적 편차.
//
// kind별 단위:
// - "pp"  : delta·ci는 분수 단위(0.025 = 2.5%p) — fmtPp/CI는 *100 스케일링 후 표기
// - "sec" : delta·ci는 초 단위 그대로 — fmtDeltaSec
// - "gold": delta·ci는 정수(골드) 단위 그대로 — fmtDeltaInt

import type { Interval } from "@/pipeline/types";
import { fmtCiHalf, fmtDeltaInt, fmtDeltaSec, fmtDisplayDelta, fmtPp } from "@/lib/format";

export type DeltaKind = "pp" | "sec" | "gold";

export interface DeltaValueProps {
  delta: number | null;
  ci?: Interval | null;
  kind: DeltaKind;
  className?: string;
  /**
   * 화면에 **함께 보이는** 전·후 값(ST-09). 주면 델타 글자를 원시 `delta`가 아니라 표시된 두 끝값의 차로 만든다 —
   * 「10.5% → 15.3%」 옆에 +4.7이 서면 읽는 사람의 검산과 어긋난다. 방향·색도 그 차를 따른다(표시값이 같으면 중립).
   * 끝값이 화면에 없는 자리(CI 캡션만 있는 곳)는 주지 않는다.
   */
  endpoints?: { before: number | null; after: number | null } | null;
}

function scaleInterval(ci: Interval, factor: number): Interval {
  return [ci[0] * factor, ci[1] * factor];
}

export default function DeltaValue({ delta, ci = null, kind, className = "", endpoints = null }: DeltaValueProps) {
  if (delta === null) {
    return <span className={`text-sm font-bold text-muted ${className}`}>—</span>;
  }

  // 끝값이 있으면 글자·방향 모두 표시된 끝값의 차를 따른다(ST-09). 없으면 원시 델타.
  const displayText =
    endpoints && endpoints.before !== null && endpoints.after !== null
      ? fmtDisplayDelta(endpoints.before, endpoints.after, kind)
      : null;
  const effective = displayText === null ? delta : displayText.startsWith("+") ? 1 : displayText.startsWith("−") ? -1 : 0;
  const direction = effective > 0 ? "up" : effective < 0 ? "down" : "flat";
  const colorClass =
    direction === "up" ? "text-success" : direction === "down" ? "text-danger" : "text-muted";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "";

  let valueText: string;
  let ciText: string | null = null;

  if (kind === "pp") {
    valueText = displayText ?? fmtPp(delta);
    if (ci) ciText = `CI ${fmtCiHalf(scaleInterval(ci, 100), 1)}`;
  } else if (kind === "sec") {
    valueText = displayText ?? fmtDeltaSec(delta);
    if (ci) ciText = `CI ${fmtCiHalf(ci, 0)}s`;
  } else {
    valueText = displayText ?? fmtDeltaInt(delta);
    if (ci) ciText = `CI ${fmtCiHalf(ci, 0)}`;
  }

  return (
    <span className={`inline-flex items-baseline gap-2 text-sm font-bold ${colorClass} ${className}`}>
      <span>
        {arrow ? `${arrow} ` : ""}
        {valueText}
      </span>
      {ciText ? <span className="text-xs font-normal text-muted">{ciText}</span> : null}
    </span>
  );
}
