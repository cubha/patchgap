import { describe, it, expect } from "vitest";

import { deltaDisplay, formatMetricValue, pct, placement, signedPct } from "../shared";

describe("값 표기", () => {
  it("비율은 %, 등수는 등", () => {
    expect(pct(0.5231)).toBe("52.3%");
    expect(placement(4.3521)).toBe("4.35등");
    expect(signedPct(0.0231)).toBe("+2.3%p");
    expect(signedPct(-0.0231)).toBe("-2.3%p");
  });

  it("지표에 맞는 단위를 고른다 — 평균 등수만 다르다", () => {
    expect(formatMetricValue("playRate", 0.42)).toBe("42.0%");
    expect(formatMetricValue("top4Rate", 0.52)).toBe("52.0%");
    expect(formatMetricValue("avgPlacement", 4.35)).toBe("4.35등");
  });
});

describe("deltaDisplay — 개선 방향", () => {
  it("비율 지표는 늘어야 개선이다", () => {
    expect(deltaDisplay("top4Rate", 0.03)).toEqual({ text: "+3.0%p", improved: true });
    expect(deltaDisplay("top4Rate", -0.03)).toEqual({ text: "-3.0%p", improved: false });
    expect(deltaDisplay("playRate", 0.05).improved).toBe(true);
  });

  it("**평균 등수만 줄어야 개선이다** — 안 뒤집으면 하향 패치가 초록으로 칠해진다", () => {
    expect(deltaDisplay("avgPlacement", -0.3)).toEqual({ text: "-0.30등", improved: true });
    expect(deltaDisplay("avgPlacement", 0.3)).toEqual({ text: "+0.30등", improved: false });
  });
});
