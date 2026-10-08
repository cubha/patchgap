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
import { comparePatchId } from "@/pipeline/collect/calendar-overlay";
import { readJsonOrNull } from "@/pipeline/shared/json-file";

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

// TFT 산출물은 없거나 깨져도 null — 화면이 「미연결」로 떨어진다.
const readJson = readJsonOrNull;

/**
 * 델타 산출 파일명만 매치한다 — `deltas-{from}-{to}.json`(PatchId = `{숫자}.{숫자}`).
 *
 * 확장자만 보고 통과시키면 안 된다: 같은 디렉토리에 전송 로그가 남으면 `to`가 가짜가 되어
 * rows 없는 파일이 화면으로 올라간다(LoL이 2026-09-09에 실제로 그렇게 죽었다 —
 * `data.ts`의 `DELTAS_FILE_PATTERN` 주석 참고. 같은 함정을 여기서도 닫는다).
 */
const TFT_DELTAS_FILE_PATTERN = /^deltas-(\d+\.\d+)-(\d+\.\d+)\.json$/;

/** TFT 패치 쌍 — 판정 파일 이름(`deltas-{from}-{to}.json`)에서 읽는다. */
export interface TftPair {
  from: string;
  to: string;
}

/**
 * 판정 파일이 있는 쌍 전부, **최신 우선**(2026-09-28, 이월 R8 — 과거 쌍 라우트·헤더 select의 목록).
 * 관측 stub 쌍도 들어간다: 최신이 stub이면 `/tft/`가 선언 축을 그리고(C13·C14), 그 쌍이 곧 목록 첫 칸이다 —
 * `latestDeltasFileName`이 이 목록의 첫 칸을 쓰므로 「최신」의 정의가 한 곳이다.
 */
export function listTftPairs(): TftPair[] {
  if (!fs.existsSync(TFT_DIR)) return [];
  // **문자열 정렬을 쓰지 않는다**(2026-09-24 수정). 이전엔 `.sort().at(-1)`이었는데 사전순이라
  // `deltas-18.10-…`이 `deltas-18.9-…`보다 **앞**에 온다 — 마이너가 두 자리가 되는 순간
  // 화면이 "최신"이라고 말하면서 옛 패치를 보여준다. 실패가 조용해서 더 나쁘다.
  // LoL(`data.ts`)은 이미 숫자 비교(`comparePatchDesc`)를 쓰고 있었고 TFT만 예외였다.
  const pairs: TftPair[] = [];
  for (const file of fs.readdirSync(TFT_DIR)) {
    const m = TFT_DELTAS_FILE_PATTERN.exec(file);
    if (m) pairs.push({ from: m[1], to: m[2] });
  }
  return pairs.sort((a, b) => comparePatchId(b.to, a.to) || comparePatchId(b.from, a.from));
}

function deltasFileName(pair: TftPair): string {
  return `deltas-${pair.from}-${pair.to}.json`;
}

/** 가장 최근 쌍의 판정 파일 이름. 없으면 null. */
function latestDeltasFileName(): string | null {
  const latest = listTftPairs()[0];
  return latest ? deltasFileName(latest) : null;
}

/**
 * 가장 최근 쌍(또는 지정한 쌍)의 **관측** 번들. 없으면 null(빈 데이터 빌드 보장).
 *
 * 가장 최근 쌍이 관측 stub(`meta.observationFailed`, C14)이면 **null**이다 — 관측이 없는데 관측 화면을
 * 그리면 보드·판정이 0으로 읽힌다. 그 쌍의 선언 축은 `loadTftDeclaration()`이 준다.
 */
export function loadTft(pair?: TftPair): TftBundle | null {
  // `pair`(2026-09-28, 이월 R8) — 과거 쌍 라우트가 그 쌍을 지정한다. 없으면 최신 쌍.
  const latest = pair ? deltasFileName(pair) : latestDeltasFileName();
  if (!latest) return null;

  const deltas = readJson<TftDeltasFile>(path.join(TFT_DIR, latest));
  if (!deltas || isObservationStub(deltas.meta)) return null;

  const before = readJson<TftBoardsFile>(path.join(TFT_DIR, `boards-${deltas.meta.from}.json`));
  const after = readJson<TftBoardsFile>(path.join(TFT_DIR, `boards-${deltas.meta.to}.json`));
  const notes = readJson<TftNotesFile>(path.join(TFT_DIR, `notes-${deltas.meta.to}.json`));
  if (!before || !after || !notes) return null;

  return { deltas, before, after, notes };
}

/**
 * **관측이 있는** 가장 최근 쌍과, 그것이 최신 쌍인지(ST-14, 2026-10-08). 최신 쌍이 관측 stub(C13·C14)이면 관측 화면
 * (대조표·방법론·상세)은 비는데, 그때 사람을 보낼 곳이 이 쌍이다 — 전에는 테스트 헬퍼(`observed-briefing.tsx`)만 알았고
 * 화면은 "TFT 홈에서 볼 수 있습니다"라는 링크 아닌 문장으로 끝났다(site-review tft-S6). 관측 쌍이 하나도 없으면 null.
 */
export function latestObservedTftPair(): { pair: TftPair; isLatest: boolean } | null {
  const pairs = listTftPairs();
  const index = pairs.findIndex((pair) => loadTft(pair) !== null);
  return index === -1 ? null : { pair: pairs[index], isLatest: index === 0 };
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
export function loadTftDeclaration(pair?: TftPair): TftDeclaration | null {
  const latest = pair ? deltasFileName(pair) : latestDeltasFileName();
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
