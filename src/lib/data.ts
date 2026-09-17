// src/lib/data.ts
// 빌드 타임 JSON 로더 — data/aggregated/**만 읽어 정적 페이지에 임베드한다(런타임 외부 API 0,
// SCOPE §2 F7 "사전 인덱싱" 원칙). 서버 전용(fs 직접 사용) — 클라이언트 컴포넌트에서 import 금지.
//
// 경로 상수는 shared/paths.ts 헬퍼(dataRoot를 마지막 선택 인자로 받는다, 2026-09-05 리팩토링)를
// 그대로 재사용한다 — 이전엔 이 파일이 같은 레이아웃을 dataRoot-first 인자 순서로 로컬 재구현했다.

import type { SkinIndexFile } from "@/pipeline/shared/cosmetic-skin";
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  AggregateMeta as PipelineAggregateMeta,
  ChampionStat,
  DataFile as PipelineDataFile,
  DeltasFile as PipelineDeltasFile,
  ItemStat,
  LaneGoldStat,
  ObjectiveStat,
  PatchId,
  PatchNoteItem,
  PatchSummary,
  RowsFile as PipelineRowsFile,
  SpellIconIndexFile,
} from "@/pipeline/types";
import {
  DATA_ROOT,
  aggregatedDir,
  deltasFile,
  notesFile,
  skinIndexFile,
  spellIconsFile,
} from "@/pipeline/shared/paths";

/** run-aggregate.ts가 각 산출 파일에 공통으로 얹는 메타 블록 — `src/pipeline/types.ts`의
 * `AggregateMeta`를 그대로 재export한다(2026-09-05 리팩토링 — 원래 이 파일 로컬 정의였다). */
export type AggregateMeta = PipelineAggregateMeta;

/** 배열형 산출 파일({meta, rows: T[]}) 공통 래퍼 — champions/items/lanes.json. */
export type RowsFile<T> = PipelineRowsFile<T>;

/** 단일 객체형 산출 파일({meta, data: T}) 공통 래퍼 — objectives/summary.json. */
export type DataFile<T> = PipelineDataFile<T>;

/** data/aggregated/notes/{patch}.json — ST-07 패치노트 파서 출력. */
export interface NotesFile {
  meta: {
    patch: PatchId;
    sourceUrl: string;
    fetchedAt: string;
    itemCount: number;
  };
  summary: string;
  sections: string[];
  items: PatchNoteItem[];
}

/**
 * data/aggregated/deltas/{from}_{to}.json 래퍼 — `src/pipeline/types.ts`의 `DeltasFile`을 그대로
 * 재export한다(2026-09-05 후속 수정). meta가 ST-06 5개 집계 파일의 `AggregateMeta`와 다른
 * 별도 스키마({from, to, generatedAt, n, counts, qAlpha, llm?})라 `RowsFile<DeltaRecord>`로
 * 뭉뚱그릴 수 없다 — `src/pipeline/match/verdict.ts`의 `writeDeltas`가 실제로 기록하는 타입과
 * types.ts에서 동일 인터페이스(`DeltasFileMeta`/`DeltasFile`)를 공유해 스키마 드리프트를 컴파일
 * 타임에 잡는다.
 */
export type DeltasFile = PipelineDeltasFile;

/** 패치 쌍(from → to). */
export interface PatchPair {
  from: PatchId;
  to: PatchId;
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/** "26.17" 같은 점(.) 구분 패치 번호를 내림차순(최신 우선) 비교한다. 세그먼트 수가 달라도
 * 없는 세그먼트는 0으로 취급한다. */
function comparePatchDesc(a: PatchId, b: PatchId): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** data/aggregated/{patch}/summary.json이 존재하는 패치 목록(내림차순 = 최신 우선). "deltas"·
 * "notes"는 패치 디렉토리가 아니라 별도 네임스페이스라 제외한다. */
export function listPatches(dataRoot: string = DATA_ROOT): PatchId[] {
  const aggRoot = path.join(dataRoot, "aggregated");
  if (!fs.existsSync(aggRoot)) return [];
  const patches = fs
    .readdirSync(aggRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "deltas" && entry.name !== "notes")
    .map((entry) => entry.name)
    .filter((patch) => fs.existsSync(path.join(aggRoot, patch, "summary.json")));
  return patches.sort(comparePatchDesc);
}

/** 델타 산출 파일명만 매치한다 — "{from}_{to}.json"(PatchId = "{숫자}.{숫자}"). */
const DELTAS_FILE_PATTERN = /^(\d+\.\d+)_(\d+\.\d+)\.json$/;

/** data/aggregated/deltas/*.json 파일명("{from}_{to}.json")에서 패치 쌍 목록을 뽑는다
 * (내림차순 = 최신 쌍 우선). 디렉토리가 없으면 빈 배열(빈 데이터 빌드 보장). */
export function listPatchPairs(dataRoot: string = DATA_ROOT): PatchPair[] {
  // shared/paths.ts는 특정 {from}_{to}.json 파일 경로(deltasFile)만 제공하고 이 디렉토리
  // 자체를 위한 헬퍼는 없다(readdir 대상은 여기뿐이라 승격할 만한 중복이 아니었다).
  const dir = path.join(dataRoot, "aggregated", "deltas");
  if (!fs.existsSync(dir)) return [];
  const pairs: PatchPair[] = [];
  for (const file of fs.readdirSync(dir)) {
    // 확장자만 보고 통과시키면 안 된다 — 같은 디렉토리에 run-notify.ts가 전송 로그
    // "{from}_{to}.notify.json"을 남기므로(gitignore 대상이지만 로컬·워크플로 실행 후에는 존재),
    // to = "26.17.notify" 같은 가짜 쌍이 만들어지고 loadDeltas가 rows 없는 그 로그를 그대로
    // 반환해 빌드가 `a.rows is not iterable`로 죽는다(실측 2026-09-09). PatchId 표기
    // "{숫자}.{숫자}" 두 개만으로 이루어진 파일명만 델타로 인정한다.
    const match = DELTAS_FILE_PATTERN.exec(file);
    if (!match) continue;
    pairs.push({ from: match[1], to: match[2] });
  }
  return pairs.sort((a, b) => comparePatchDesc(a.to, b.to) || comparePatchDesc(a.from, b.from));
}

/** 가장 최신 패치 쌍. 쌍이 하나도 없으면(ST-08 미착수·빈 빌드 등) null. */
export function getDefaultPair(dataRoot: string = DATA_ROOT): PatchPair | null {
  return listPatchPairs(dataRoot)[0] ?? null;
}

export function loadSummary(patch: PatchId, dataRoot: string = DATA_ROOT): DataFile<PatchSummary> | null {
  return readJsonFile(path.join(aggregatedDir(patch, dataRoot), "summary.json"));
}

export function loadChampions(patch: PatchId, dataRoot: string = DATA_ROOT): RowsFile<ChampionStat> | null {
  return readJsonFile(path.join(aggregatedDir(patch, dataRoot), "champions.json"));
}

export function loadItems(patch: PatchId, dataRoot: string = DATA_ROOT): RowsFile<ItemStat> | null {
  return readJsonFile(path.join(aggregatedDir(patch, dataRoot), "items.json"));
}

export function loadLanes(patch: PatchId, dataRoot: string = DATA_ROOT): RowsFile<LaneGoldStat> | null {
  return readJsonFile(path.join(aggregatedDir(patch, dataRoot), "lanes.json"));
}

export function loadObjectives(
  patch: PatchId,
  dataRoot: string = DATA_ROOT
): DataFile<ObjectiveStat> | null {
  return readJsonFile(path.join(aggregatedDir(patch, dataRoot), "objectives.json"));
}

export function loadNotes(patch: PatchId, dataRoot: string = DATA_ROOT): NotesFile | null {
  return readJsonFile(notesFile(patch, dataRoot));
}

/** data/aggregated/deltas/{from}_{to}.json — 파일이 없으면 null(ST-08 미착수 구간·빈 데이터
 * 빌드 모두 이 경로로 안전하게 처리된다). */
export function loadDeltas(from: PatchId, to: PatchId, dataRoot: string = DATA_ROOT): DeltasFile | null {
  return readJsonFile(deltasFile(from, to, dataRoot));
}

/** data/aggregated/spell-icons.json — scripts/run-ddragon.ts 미실행이거나 노트에 스킬 표기가
 * 없으면 null — 렌더러는 아이콘 없이 텍스트만 표시하는 것으로 폴백한다(크래시 없음). */
export function loadSpellIcons(dataRoot: string = DATA_ROOT): SpellIconIndexFile | null {
  return readJsonFile(spellIconsFile(dataRoot));
}

/** data/aggregated/skin-index.json — 치장 노트 ↔ 스킨 매칭용 ko_KR 인덱스(ST-B6).
 * 없으면 null이고, 그 경우 치장 행은 지금까지처럼 텍스트만 나온다(크래시 없음). */
export function loadSkinIndex(dataRoot: string = DATA_ROOT): SkinIndexFile | null {
  return readJsonFile(skinIndexFile(dataRoot));
}

/**
 * `public/dd/splash/`에 **실제로 존재하는** 스플래시 파일 집합.
 *
 * **왜 인덱스만 믿으면 안 되는가**(2026-09-18 실측): Data Dragon은 스킨 목록에 크로마 항목
 * ("떠오른 전설 오리아나 (질서)" 등)을 넣어 두지만 **그 스플래시 파일은 배포하지 않는다** —
 * 26.18 크로마 줄이 매칭한 5건이 전부 404였다. 인덱스에 있다고 이미지를 걸면 그 줄은
 * 깨진 `<img>`가 된다.
 *
 * 정적 export라 **빌드 타임에 파일 유무를 미리 판정**할 수 있다 — 클라이언트 `onError`
 * 핸들러가 필요 없고, 서버 컴포넌트 경계도 그대로 유지된다(PUBG 자산 매니페스트와 같은 판단).
 */
export function listAvailableSplashes(publicRoot: string = path.resolve(process.cwd(), "public")): Set<string> {
  const dir = path.join(publicRoot, "dd", "splash");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")));
}
