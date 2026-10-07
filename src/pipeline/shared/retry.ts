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

export interface FetchRetryOptions {
  /** 총 시도 횟수(첫 시도 포함). */
  attempts?: number;
  baseMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

/**
 * 공개 CDN(DDragon·CDragon) 받기 — 5xx와 네트워크 오류만 재시도한다.
 *
 * 2026-10-07 실측: CDragon이 Cloudflare 522를 한 번 내자 `collect-tft`가 18.4 첫 실행에서 통째로
 * 죽었고, 몇 시간 뒤 같은 URL은 200이었다. 4xx는 기다려도 바뀌지 않으므로(없는 버전) 그대로
 * 돌려준다. 상한을 넘은 5xx도 응답으로 돌려준다 — 실패 문구(status 포함)는 호출부가 이미 말한다.
 */
export async function fetchWithRetry(url: string, options: FetchRetryOptions = {}): Promise<Response> {
  const attempts = options.attempts ?? 4;
  const baseMs = options.baseMs ?? 2000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  for (let attempt = 0; ; attempt += 1) {
    const last = attempt + 1 >= attempts;
    try {
      const res = await fetchImpl(url);
      if (res.status < 500 || last) return res;
    } catch (error) {
      if (last) throw error;
    }
    await sleepImpl(exponentialBackoffMs(baseMs, attempt));
  }
}
