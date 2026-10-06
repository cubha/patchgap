// src/pipeline/shared/percent.ts
// 비율 → 퍼센트 문자열의 단일 소스(2026-10-06). 같은 이름의 `pct`/`signedPct`가 화면·디스코드에 다섯 벌 있었고,
// 이름은 같아도 **규칙이 달랐다** — 단위(`%`/`%p`), 0의 부호(`+`/무부호), 음수 기호(`-`/`−`). 출력을 하나로
// 합치면 화면 문구가 바뀌므로 규칙을 옵션으로 받고, 호출부는 지금 쓰는 규칙을 이름 붙은 스타일로 고른다.
// 파이프라인(디스코드)도 쓰므로 React·fs 의존 없이 여기 둔다.

/** 0.5231 → "52.3%". */
export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export interface SignedPercentStyle {
  /** 단위 — 비율 자체의 변화는 `%`, 확률의 차(퍼센트포인트)는 `%p`. */
  unit: "%" | "%p";
  /** 정확히 0일 때 붙일 부호. */
  zeroSign: "+" | "";
  /** 음수 기호 — 산문은 유니코드 마이너스(`−`)를 쓴다. */
  minus: "-" | "−";
}

/** TFT 화면 — 확률 차는 `%p`, 0은 `+0.0%p`. */
export const SIGNED_POINT: SignedPercentStyle = { unit: "%p", zeroSign: "+", minus: "-" };
/** PUBG 화면·디스코드 — `%`, 0은 무부호. 두 표면이 같은 출력을 내야 해서 같은 상수를 쓴다. */
export const SIGNED_PERCENT: SignedPercentStyle = { unit: "%", zeroSign: "", minus: "-" };
/** PUBG 근거 산문 — `%`, 0은 `+`, 음수는 `−`. */
export const SIGNED_PERCENT_PROSE: SignedPercentStyle = { unit: "%", zeroSign: "+", minus: "−" };

/** 부호 붙은 퍼센트. 크기는 절댓값으로 쓰고 부호는 스타일이 정한다. */
export function formatSignedPercent(ratio: number, digits: number, style: SignedPercentStyle): string {
  const sign = ratio > 0 ? "+" : ratio < 0 ? style.minus : style.zeroSign;
  return `${sign}${Math.abs(ratio * 100).toFixed(digits)}${style.unit}`;
}
