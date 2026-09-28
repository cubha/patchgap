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

import type { DeltaRecord, DeltasRunLlmMeta, MatchStatus, ObservationFailure, PatchNoteItem } from "@/pipeline/types";
import { isObservationStub } from "@/pipeline/shared/observation-stub";
import type { NamedStat } from "@/pipeline/match/tft-delta";
import { latestPatchId } from "@/pipeline/collect/staleness";

const TFT_DIR = path.join(process.cwd(), "data", "aggregated", "tft");

export interface TftBoardsFile {
  patch: string;
  /** 집계에 들어간 가장 늦은 매치 시각(ISO, 2026-09-28 C8·C13). 옛 산출물엔 없다. */
  observedUntil?: string;
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

/**
 * 델타 산출 파일명만 매치한다 — `deltas-{from}-{to}.json`(PatchId = `{숫자}.{숫자}`).
 *
 * 확장자만 보고 통과시키면 안 된다: 같은 디렉토리에 전송 로그가 남으면 `to`가 가짜가 되어
 * rows 없는 파일이 화면으로 올라간다(LoL이 2026-09-09에 실제로 그렇게 죽었다 —
 * `data.ts`의 `DELTAS_FILE_PATTERN` 주석 참고. 같은 함정을 여기서도 닫는다).
 */
const TFT_DELTAS_FILE_PATTERN = /^deltas-(\d+\.\d+)-(\d+\.\d+)\.json$/;

/** 가장 최근 쌍의 판정 파일 이름. 없으면 null. */
function latestDeltasFileName(): string | null {
  if (!fs.existsSync(TFT_DIR)) return null;
  // **문자열 정렬을 쓰지 않는다**(2026-09-24 수정). 이전엔 `.sort().at(-1)`이었는데 사전순이라
  // `deltas-18.10-…`이 `deltas-18.9-…`보다 **앞**에 온다 — 마이너가 두 자리가 되는 순간
  // 화면이 "최신"이라고 말하면서 옛 패치를 보여준다. 실패가 조용해서 더 나쁘다.
  // LoL(`data.ts`)은 이미 숫자 비교(`comparePatchDesc`)를 쓰고 있었고 TFT만 예외였다.
  const byTo = new Map<string, string>();
  for (const file of fs.readdirSync(TFT_DIR)) {
    const m = TFT_DELTAS_FILE_PATTERN.exec(file);
    if (m) byTo.set(m[2], file);
  }
  const latestTo = latestPatchId([...byTo.keys()]);
  return latestTo === null ? null : (byTo.get(latestTo) ?? null);
}

/**
 * 가장 최근 쌍의 **관측** 번들. 없으면 null(빈 데이터 빌드 보장).
 *
 * 가장 최근 쌍이 관측 stub(`meta.observationFailed`, C14)이면 **null**이다 — 관측이 없는데 관측 화면을
 * 그리면 보드·판정이 0으로 읽힌다. 그 쌍의 선언 축은 `loadTftDeclaration()`이 준다.
 */
export function loadTft(): TftBundle | null {
  const latest = latestDeltasFileName();
  if (!latest) return null;

  const deltas = readJson<TftDeltasFile>(path.join(TFT_DIR, latest));
  if (!deltas || isObservationStub(deltas.meta)) return null;

  const before = readJson<TftBoardsFile>(path.join(TFT_DIR, `boards-${deltas.meta.from}.json`));
  const after = readJson<TftBoardsFile>(path.join(TFT_DIR, `boards-${deltas.meta.to}.json`));
  const notes = readJson<TftNotesFile>(path.join(TFT_DIR, `notes-${deltas.meta.to}.json`));
  if (!before || !after || !notes) return null;

  return { deltas, before, after, notes };
}

/** 선언 축만 있는 최신 쌍(C13·C14) — 노트와 관측이 없는 사유. */
export interface TftDeclaration {
  from: string;
  to: string;
  generatedAt: string;
  notes: TftNotesFile;
  failure: ObservationFailure;
}

/**
 * 가장 최근 쌍이 관측 stub이면 그 선언 축(노트 + 사유)을 준다. 관측 쌍이거나 노트가 없으면 null.
 * 화면은 `loadTft()`가 null일 때 이것을 본다 — 새 패치노트가 관측을 기다리느라 숨지 않게(결정 8).
 */
export function loadTftDeclaration(): TftDeclaration | null {
  const latest = latestDeltasFileName();
  if (!latest) return null;
  const stub = readJson<{ meta: { from: string; to: string; generatedAt: string; observationFailed?: ObservationFailure } }>(
    path.join(TFT_DIR, latest)
  );
  if (!stub || !stub.meta.observationFailed) return null;
  const notes = readJson<TftNotesFile>(path.join(TFT_DIR, `notes-${stub.meta.to}.json`));
  if (!notes) return null;
  return { from: stub.meta.from, to: stub.meta.to, generatedAt: stub.meta.generatedAt, notes, failure: stub.meta.observationFailed };
}

/**
 * 자산 매니페스트(`scripts/run-tft-assets.ts` 산출). 없으면 `null` — 화면은 폴백 박스를 그린다.
 * 깨진 `<img>`는 폴백이 아니므로, **빌드 타임에** 있고 없음을 판정한다(PUBG와 같은 구조).
 */
export function loadTftAssets(): TftAssetManifest | null {
  return readJson<TftAssetManifest>(path.join(TFT_DIR, "assets.json"));
}
