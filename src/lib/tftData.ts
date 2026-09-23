// src/lib/tftData.ts
// TFT 빌드 타임 데이터 로더. **런타임 호출 0** — 화면은 `data/aggregated/tft/*.json`만 읽는다.
//
// PUBG(`pubgData.ts`)와 같은 자리이되, 판정 산출물이 LoL과 **같은 `DeltaRecord` 모양**이라
// 표시 규칙(`isReportableRecord`·`displayStatus`·`STATUS_SORT_PRIORITY`)을 그대로 상속한다.
// 그래서 여기엔 TFT 전용 술어가 없다 — 있으면 세 게임이 갈린다.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TftAssetManifest } from "@/pipeline/tft/asset-path";

import type { DeltaRecord, DeltasRunLlmMeta, MatchStatus, PatchNoteItem } from "@/pipeline/types";
import type { NamedStat } from "@/pipeline/match/tft-delta";

const TFT_DIR = path.join(process.cwd(), "data", "aggregated", "tft");

export interface TftBoardsFile {
  patch: string;
  matches: number;
  boards: number;
  droppedMatches: number;
  summary: { avgGameLengthSec: number; avgLastRound: number };
  unmatchedKeys: { units: string[]; traits: string[]; items: string[] };
  units: NamedStat[];
  traits: NamedStat[];
  items: NamedStat[];
}

export interface TftDeltasFile {
  meta: {
    game: "tft";
    from: string;
    to: string;
    generatedAt: string;
    qAlpha: number;
    boards: { before: number; after: number };
    matches: { before: number; after: number };
    noteCount: number;
    counts: Partial<Record<MatchStatus, number>>;
    /** 2단 LLM 실행 요약. `--no-llm`이거나 키가 없으면 없다 — LoL `DeltasFileMeta.llm`과 같은 모양. */
    llm?: DeltasRunLlmMeta;
  };
  rows: DeltaRecord[];
}

export interface TftNotesFile {
  patch: string;
  sourceUrl: string;
  /** 파서가 해소하지 못한 줄 수까지 포함 — 커버리지 고지의 근거다. */
  stats: { sections: number; lines: number; unresolved: number };
  items: PatchNoteItem[];
}

export interface TftBundle {
  deltas: TftDeltasFile;
  before: TftBoardsFile;
  after: TftBoardsFile;
  notes: TftNotesFile;
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** 존재하는 델타 파일 중 가장 최근 것. 없으면 null(빈 데이터 빌드 보장). */
export function loadTft(): TftBundle | null {
  if (!fs.existsSync(TFT_DIR)) return null;
  const deltaFiles = fs
    .readdirSync(TFT_DIR)
    .filter((f) => f.startsWith("deltas-") && f.endsWith(".json"))
    .sort();
  const latest = deltaFiles.at(-1);
  if (!latest) return null;

  const deltas = readJson<TftDeltasFile>(path.join(TFT_DIR, latest));
  if (!deltas) return null;

  const before = readJson<TftBoardsFile>(path.join(TFT_DIR, `boards-${deltas.meta.from}.json`));
  const after = readJson<TftBoardsFile>(path.join(TFT_DIR, `boards-${deltas.meta.to}.json`));
  const notes = readJson<TftNotesFile>(path.join(TFT_DIR, `notes-${deltas.meta.to}.json`));
  if (!before || !after || !notes) return null;

  return { deltas, before, after, notes };
}

/**
 * 자산 매니페스트(`scripts/run-tft-assets.ts` 산출). 없으면 `null` — 화면은 폴백 박스를 그린다.
 * 깨진 `<img>`는 폴백이 아니므로, **빌드 타임에** 있고 없음을 판정한다(PUBG와 같은 구조).
 */
export function loadTftAssets(): TftAssetManifest | null {
  return readJson<TftAssetManifest>(path.join(TFT_DIR, "assets.json"));
}
