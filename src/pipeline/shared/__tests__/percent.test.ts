// 특성화 테스트(2026-10-06): 다섯 사본을 한 함수로 모으면서 **각 호출부의 기존 출력이 그대로인지**를 원래 식(오라클)과
// 대조한다. 오라클은 단일화 전 각 파일의 본문을 그대로 옮긴 것이다.
import { describe, expect, it } from "vitest";
import { formatPercent, formatSignedPercent, SIGNED_PERCENT, SIGNED_PERCENT_PROSE, SIGNED_POINT } from "../percent";

const SAMPLES = [0, -0, 0.5231, -0.5231, 0.0231, -0.0231, 0.00004, -0.00004, 0.00049, -0.00049, 1, -1, 0.12345, -0.98765];

// components/tft/shared.tsx signedPct
const tftOracle = (value: number, digits = 1) => {
  const p = value * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(digits)}%p`;
};
// components/pubg/shared.tsx · discord/pubg-briefing.ts signedPct
const pubgOracle = (value: number, digits = 1) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
// components/pubg/evidenceProse.ts signedPct
const proseOracle = (value: number, digits = 1) => {
  const formatted = `${(Math.abs(value) * 100).toFixed(digits)}%`;
  return value >= 0 ? `+${formatted}` : `−${formatted}`;
};
// tft·pubg shared pct / evidenceProse pct(2) / StatusDefinitionTable pct(0)
const pctOracle = (value: number, digits: number) => `${(value * 100).toFixed(digits)}%`;

describe("formatSignedPercent — 단일화 전 출력 보존", () => {
  for (const digits of [0, 1, 2]) {
    for (const v of SAMPLES) {
      it(`digits=${digits} v=${Object.is(v, -0) ? "-0" : v}`, () => {
        expect(formatSignedPercent(v, digits, SIGNED_POINT)).toBe(tftOracle(v, digits));
        expect(formatSignedPercent(v, digits, SIGNED_PERCENT)).toBe(pubgOracle(v, digits));
        expect(formatSignedPercent(v, digits, SIGNED_PERCENT_PROSE)).toBe(proseOracle(v, digits));
        expect(formatPercent(v, digits)).toBe(pctOracle(v, digits));
      });
    }
  }
});
