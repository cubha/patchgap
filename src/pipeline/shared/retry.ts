// src/pipeline/shared/retry.ts
// 재시도 대기의 공용 조각 — Riot(LoL·TFT) 클라이언트와 Discord 웹훅이 같은 두 함수를 각자 들고 있었다
// (2026-10-06 단일화). 기준 대기(base)는 호출부마다 다르므로(Riot 1초 · Discord 0.5초) 인자로 받는다.

/** 실제 대기. 테스트는 각 클라이언트의 `sleepImpl` 주입으로 이것을 대체한다. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 지수 백오프 — `base × 2^attempt`(attempt는 0부터). */
export function exponentialBackoffMs(baseMs: number, attempt: number): number {
  return baseMs * 2 ** attempt;
}
