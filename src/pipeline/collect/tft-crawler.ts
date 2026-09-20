// src/pipeline/collect/tft-crawler.ts
// TFT 원본 수집 — 래더 → puuid → 매치 ID → 매치 **원본 JSON**을 패치 창별 JSONL로 적재한다.
//
// **원본을 그대로 적재하는 이유**(2026-09-20): 이 프로젝트는 TFT 실응답을 아직 한 번도 못 봤다
// (키가 403). 수집 시점에 슬림 변환을 끼우면 문서에서 추정한 필드명이 파일 형식으로 굳고,
// 틀렸을 때 **재수집**해야 한다 — 수집은 리밋 때문에 시간이 가장 비싼 단계다. 원본을 두면
// 변환은 몇 초 만에 다시 돌릴 수 있다. (LoL은 실응답을 보고 나서 슬림을 정했다.)
//
// **패치 창은 시각으로 가른다.** TFT 응답의 `game_version`은 게임 클라이언트 버전(16.18.x)이고
// 패치노트는 세트 기준(18.2)이라 **두 축이 다르다**. 그래서 어느 패치에 속하는지는 노트 발행
// 시각 사이에 들어가는지로 판정하고, `game_version`은 교차 확인용으로 함께 기록한다.
import fs from "node:fs";
import path from "node:path";

import type { TftClient, TftTier } from "./tft-client";
import { normalizeGameVersion } from "./tft-client";

/** 패치 하나가 라이브였던 구간. `endMs`가 null이면 "지금까지". */
export interface TftPatchWindow {
  patch: string;
  startMs: number;
  endMs: number | null;
}

export interface TftCrawlOptions {
  client: TftClient;
  windows: readonly TftPatchWindow[];
  /** 패치 창 하나당 목표 매치 수. */
  targetPerPatch: number;
  tiers?: readonly TftTier[];
  /** 래더에서 꺼낼 플레이어 수 상한(티어 합산). */
  seedLimit?: number;
  /** 플레이어 1명당 조회할 매치 ID 수. TFT match-v1의 count 상한은 200이다. */
  idsPerPlayer?: number;
  /**
   * 적재할 큐. 기본 `[1100]`(랭크)뿐이다 — 실측 스모크에서 일반전(1090)이 섞여 들어왔고,
   * 큐마다 메타가 달라 한 표본에 섞으면 델타가 큐 구성 변화에 오염된다
   * (PUBG가 `trainingroom`을 거르는 것과 같은 이유).
   */
  queueIds?: readonly number[];
  outDir: string;
  onProgress?: (event: TftCrawlProgress) => void;
}

export interface TftCrawlProgress {
  phase: "seed" | "ids" | "match";
  /** 지금까지 적재한 매치 수(패치 창 합산). */
  stored: number;
  /** 조회했지만 어느 창에도 안 들어간 매치 수. */
  skipped: number;
  detail?: string;
}

export interface TftCrawlResult {
  /** 패치 → 적재된 매치 수. */
  storedByPatch: Record<string, number>;
  /** 어느 창에도 안 들어가 버린 매치 수. */
  skipped: number;
  /**
   * 관측된 `game_version` 문자열 → 건수. **못 읽은 값도 원문 그대로** 센다 — 실측에서 TFT는
   * `"TFT Unreal Version ?.?.?.?"`를 주고, 그 사실이 곧 「시각 기준 분류가 유일한 방법」이라는
   * 근거다. 빈 객체로 두면 그 근거가 사라진다.
   */
  versionHistogram: Record<string, number>;
  /** 큐가 맞지 않아 버린 매치 수. */
  offQueue: number;
  seeds: number;
  requested: number;
}

/** 시각이 어느 창에 속하나. 어디에도 안 속하면 null. */
export function windowOf(windows: readonly TftPatchWindow[], atMs: number): TftPatchWindow | null {
  for (const w of windows) {
    if (atMs < w.startMs) continue;
    if (w.endMs !== null && atMs >= w.endMs) continue;
    return w;
  }
  return null;
}

/** 창 전체를 덮는 [최소 시작, 최대 끝] — 매치 ID 조회 범위를 좁혀 헛조회를 줄인다. */
export function spanOf(windows: readonly TftPatchWindow[]): { startMs: number; endMs: number | null } {
  let start = Number.POSITIVE_INFINITY;
  let end: number | null = 0;
  for (const w of windows) {
    start = Math.min(start, w.startMs);
    if (end !== null) end = w.endMs === null ? null : Math.max(end, w.endMs);
  }
  return { startMs: Number.isFinite(start) ? start : 0, endMs: end };
}

export function rawTftFile(patch: string, outDir: string): string {
  return path.join(outDir, `matches-${patch.replace(/\./g, "-")}.jsonl`);
}

/**
 * **조회한** 매치 ID 전부(적재 여부 무관). 적재분만 기억하면 창 밖 매치를 재실행마다 다시
 * 받는다 — 리밋이 병목인 파이프라인에서 그건 그대로 예산 누수다.
 */
export function seenTftIdsFile(outDir: string): string {
  return path.join(outDir, "ids-seen.txt");
}

export async function crawlTft(options: TftCrawlOptions): Promise<TftCrawlResult> {
  const {
    client,
    windows,
    targetPerPatch,
    tiers = ["challenger", "grandmaster", "master"] as const,
    seedLimit = 400,
    idsPerPlayer = 200,
    queueIds = [1100],
    outDir,
    onProgress,
  } = options;

  fs.mkdirSync(outDir, { recursive: true });

  // 이미 적재한 매치는 다시 받지 않는다 — 중단 후 재개가 되어야 한다(수집은 시간이 가장 비싸다).
  const seen = new Set<string>();
  const storedByPatch: Record<string, number> = {};
  const handles = new Map<string, number>();
  for (const w of windows) {
    storedByPatch[w.patch] = 0;
    const file = rawTftFile(w.patch, outDir);
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (line.trim().length === 0) continue;
        try {
          const id = (JSON.parse(line) as { matchId?: string }).matchId;
          if (id) {
            seen.add(id);
            storedByPatch[w.patch] += 1;
          }
        } catch {
          // 잘린 줄(중단 시점) — 무시하고 이어 붙인다.
        }
      }
    }
    handles.set(w.patch, fs.openSync(file, "a"));
  }

  const seenIdsPath = seenTftIdsFile(outDir);
  if (fs.existsSync(seenIdsPath)) {
    for (const line of fs.readFileSync(seenIdsPath, "utf8").split("\n")) {
      const id = line.trim();
      if (id.length > 0) seen.add(id);
    }
  }
  const seenFd = fs.openSync(seenIdsPath, "a");

  const versionHistogram: Record<string, number> = {};
  let skipped = 0;
  let requested = 0;
  let seeds = 0;
  let offQueue = 0;
  const allowedQueues = new Set(queueIds);

  try {
    // ── 1. 시드 ──────────────────────────────────────────────────────────
    const puuids: string[] = [];
    for (const tier of tiers) {
      if (puuids.length >= seedLimit) break;
      const entries = await client.getLeagueEntries(tier);
      for (const e of entries) {
        if (puuids.length >= seedLimit) break;
        puuids.push(e.puuid);
      }
      seeds = puuids.length;
      onProgress?.({ phase: "seed", stored: 0, skipped: 0, detail: `${tier} → 누적 ${seeds}명` });
    }

    const span = spanOf(windows);
    const done = () => windows.every((w) => (storedByPatch[w.patch] ?? 0) >= targetPerPatch);

    // ── 2. 매치 ID ───────────────────────────────────────────────────────
    const ids: string[] = [];
    for (const puuid of puuids) {
      if (ids.length >= targetPerPatch * windows.length * 2) break;
      const page = await client.getMatchIdsByPuuid(puuid, {
        startTime: span.startMs,
        endTime: span.endMs ?? undefined,
        count: idsPerPlayer,
      });
      for (const id of page) if (!seen.has(id)) ids.push(id);
      onProgress?.({ phase: "ids", stored: 0, skipped: 0, detail: `ID 누적 ${ids.length}` });
    }

    // ── 3. 매치 원본 ─────────────────────────────────────────────────────
    const unique = [...new Set(ids)];
    for (const id of unique) {
      if (done()) break;
      requested += 1;
      fs.writeSync(seenFd, `${id}\n`);
      seen.add(id);
      const env = await client.getMatch(id);
      if (env === null) continue;

      const versionKey = normalizeGameVersion(env.gameVersion) ?? env.gameVersion;
      versionHistogram[versionKey] = (versionHistogram[versionKey] ?? 0) + 1;

      const queueId = readQueueId(env.raw);
      if (queueId !== null && !allowedQueues.has(queueId)) {
        offQueue += 1;
        skipped += 1;
        continue;
      }

      const w = Number.isFinite(env.gameDatetime) ? windowOf(windows, env.gameDatetime) : null;
      if (w === null || (storedByPatch[w.patch] ?? 0) >= targetPerPatch) {
        skipped += 1;
        continue;
      }
      const fd = handles.get(w.patch);
      if (fd === undefined) {
        skipped += 1;
        continue;
      }
      fs.writeSync(fd, `${JSON.stringify({ matchId: env.matchId, gameDatetime: env.gameDatetime, gameVersion: env.gameVersion, raw: env.raw })}\n`);
      seen.add(env.matchId);
      storedByPatch[w.patch] += 1;
      const total = Object.values(storedByPatch).reduce((a, b) => a + b, 0);
      if (total % 25 === 0) onProgress?.({ phase: "match", stored: total, skipped });
    }
  } finally {
    fs.closeSync(seenFd);
    for (const fd of handles.values()) fs.closeSync(fd);
  }

  return { storedByPatch, skipped, versionHistogram, seeds, requested, offQueue };
}

/** 응답은 `queue_id`와 `queueId`를 **둘 다** 준다(실측). 없으면 null — 거르지 않고 통과시킨다. */
function readQueueId(raw: unknown): number | null {
  const info = (raw as { info?: Record<string, unknown> } | null)?.info;
  const v = info?.queue_id ?? info?.queueId;
  return typeof v === "number" ? v : null;
}
