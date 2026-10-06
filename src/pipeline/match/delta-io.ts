// src/pipeline/match/delta-io.ts
// LoL 판정(`delta.ts`)의 파일 I/O — 집계 5종 로드와 원천 매치 ID 표본(2026-10-06 `delta.ts`에서 분리). 판정 계산은
// 순수 함수로 남기고, 디스크를 읽는 일은 여기서만 한다.
import fs from "node:fs";
import path from "node:path";
import type { ChampionStat, DataFile, ItemStat, LaneGoldStat, MatchSlim, ObjectiveStat, PatchId, PatchSummary, RowsFile } from "../types";
import { DATA_ROOT, aggregatedDir } from "../shared/paths";
import { readJsonRequired } from "../shared/json-file";
import type { AggregatedPatch } from "./delta";

function missingMessage(filePath: string, patch: PatchId): string {
  return `aggregated 파일이 없습니다: ${filePath} — 먼저 실행: npx tsx scripts/run-aggregate.ts --patch ${patch}`;
}

function readRowsFile<T>(filePath: string, patch: PatchId): T[] {
  return readJsonRequired<RowsFile<T>>(filePath, missingMessage(filePath, patch)).rows;
}

function readDataFile<T>(filePath: string, patch: PatchId): T {
  return readJsonRequired<DataFile<T>>(filePath, missingMessage(filePath, patch)).data;
}

/** `data/aggregated/{patch}/*.json` 5종을 읽어 AggregatedPatch로 만든다. 파일이 없으면(아직
 * run-aggregate를 안 돌린 패치) 정확한 복구 명령을 담은 에러로 즉시 실패한다(파이프라인 중간에서
 * 애매하게 죽지 않도록). */
export function loadAggregatedPatch(patch: PatchId, dataRoot: string = DATA_ROOT): AggregatedPatch {
  const dir = aggregatedDir(patch, dataRoot);
  return {
    patch,
    champions: readRowsFile<ChampionStat>(path.join(dir, "champions.json"), patch),
    items: readRowsFile<ItemStat>(path.join(dir, "items.json"), patch),
    lanes: readRowsFile<LaneGoldStat>(path.join(dir, "lanes.json"), patch),
    objectives: readDataFile<ObjectiveStat>(path.join(dir, "objectives.json"), patch),
    summary: readDataFile<PatchSummary>(path.join(dir, "summary.json"), patch),
  };
}

// ─── 원천 매치 ID 표본(엔티티별 최대 10개) — matches.jsonl 단일 스트리밍 패스 ───

const MATCH_ID_SAMPLE_SIZE = 10;

export interface EntityMatchIdSamples {
  /** championId → 표본 matchId 배열(최대 10개). */
  championMatchIds: Map<number, string[]>;
  /** itemId → 표본 matchId 배열(최대 10개). */
  itemMatchIds: Map<number, string[]>;
}

/**
 * `matches.jsonl`을 한 번만 스트리밍해 관심 championId/itemId별 표본 matchId(최대 10개)를 모은다.
 * 엔티티 수백 개마다 파일을 재스캔하면 수천 매치 × 수백 엔티티로 느려지므로(실측 26.17 기준
 * 3,405줄·15MB, 계속 증가 중 — advisor 지적) 반드시 단일 패스로 처리한다. 파일이 없으면 빈 결과
 * (에러 아님 — 크롤러가 아직 만들지 않았을 수 있음).
 */
export function sampleMatchIdsByEntity(
  matchesJsonlPath: string,
  championIds: ReadonlySet<number>,
  itemIds: ReadonlySet<number>
): EntityMatchIdSamples {
  const championMatchIds = new Map<number, string[]>();
  const itemMatchIds = new Map<number, string[]>();
  if (!fs.existsSync(matchesJsonlPath)) return { championMatchIds, itemMatchIds };

  const lines = fs.readFileSync(matchesJsonlPath, "utf8").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let match: MatchSlim;
    try {
      match = JSON.parse(line) as MatchSlim;
    } catch {
      continue; // 크롤러가 append 중이라 마지막 줄이 잘려 있을 수 있음 — skip
    }

    const seenChampionsThisMatch = new Set<number>();
    const seenItemsThisMatch = new Set<number>();
    for (const participant of match.participants) {
      if (championIds.has(participant.championId) && !seenChampionsThisMatch.has(participant.championId)) {
        seenChampionsThisMatch.add(participant.championId);
        const bucket = championMatchIds.get(participant.championId) ?? [];
        if (bucket.length < MATCH_ID_SAMPLE_SIZE) {
          bucket.push(match.matchId);
          championMatchIds.set(participant.championId, bucket);
        }
      }
      for (const itemId of participant.items) {
        if (itemId <= 0 || !itemIds.has(itemId) || seenItemsThisMatch.has(itemId)) continue;
        seenItemsThisMatch.add(itemId);
        const bucket = itemMatchIds.get(itemId) ?? [];
        if (bucket.length < MATCH_ID_SAMPLE_SIZE) {
          bucket.push(match.matchId);
          itemMatchIds.set(itemId, bucket);
        }
      }
    }
  }
  return { championMatchIds, itemMatchIds };
}
