// src/pipeline/shared/paths.ts
// 데이터 레이아웃 경로 상수/헬퍼. PLAN ⑥ "데이터 계약"의 경로를 그대로 구현한다.
// data/raw/*는 gitignore(수집 원본), data/aggregated/*는 커밋 대상(빌드 재현용).
//
// 전 헬퍼는 마지막에 선택적 `dataRoot` 인자를 받는다(기본값 DATA_ROOT) — 테스트 격리용
// 오버라이드를 이 파일 자체가 흡수해, 다른 모듈이 "dataRoot ? path.join(...) : xFn(patch)" 형태로
// 같은 레이아웃을 재구현하지 않게 한다(2026-09-05 리팩토링, collect/checkpoint.ts·collect/seed.ts·
// collect/timeline.ts·lib/data.ts·scripts/run-aggregate.ts·scripts/run-notify.ts가 이 헬퍼를
// 직접 호출하도록 정리).

import path from "node:path";
import type { PatchId } from "../types";

/** 데이터 루트. cwd 기준(파이프라인 스크립트는 항상 repo 루트에서 실행된다). */
export const DATA_ROOT = path.resolve(process.cwd(), "data");

/** data/raw/{patch}/ — 패치 1개의 원본 수집 산출물 디렉토리. */
export function rawDir(patch: PatchId, dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "raw", patch);
}

/** data/raw/{patch}/matches.jsonl — MatchSlim 1행/매치. */
export function matchesJsonl(patch: PatchId, dataRoot: string = DATA_ROOT): string {
  return path.join(rawDir(patch, dataRoot), "matches.jsonl");
}

/** data/raw/{patch}/timelines.jsonl — TimelineSlim 1행/매치. */
export function timelinesJsonl(patch: PatchId, dataRoot: string = DATA_ROOT): string {
  return path.join(rawDir(patch, dataRoot), "timelines.jsonl");
}

/** data/raw/{patch}/seen-ids.txt — idempotent 재개용 수집 완료 matchId 인덱스. */
export function seenIdsFile(patch: PatchId, dataRoot: string = DATA_ROOT): string {
  return path.join(rawDir(patch, dataRoot), "seen-ids.txt");
}

/** data/aggregated/{patch}/ — champions/items/lanes/objectives/summary.json이 위치하는 디렉토리. */
export function aggregatedDir(patch: PatchId, dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "aggregated", patch);
}

/** data/aggregated/deltas/{from}_{to}.json — 패치 쌍 델타 판정 결과. */
export function deltasFile(from: PatchId, to: PatchId, dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "aggregated", "deltas", `${from}_${to}.json`);
}

/** data/aggregated/notes/{patch}.json — 패치노트 파서 출력. */
export function notesFile(patch: PatchId, dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "aggregated", "notes", `${patch}.json`);
}

/** data/cache/llm/ — LLM 2단 짝짓기 캐시 디렉토리(gitignore). */
export function llmCacheDir(dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "cache", "llm");
}

/** data/aggregated/spell-icons.json — scripts/run-ddragon.ts가 산출하는 스펠 아이콘 slim
 * 인덱스(`DataFile<SpellIconMap>`). 패치별 디렉토리가 아니라 전 패치 노트를 스캔한 단일 파일. */
export function spellIconsFile(dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "aggregated", "spell-icons.json");
}

/** data/aggregated/skin-index.json — `run-ddragon.ts`가 만드는 ko_KR 스킨 인덱스(치장 노트
 * 매칭용 slim 인덱스). 패치별 디렉토리가 아니라 단일 파일이라는 점에서 `spellIconsFile`과 같은
 * 성격이다 — 스킨 목록은 패치가 아니라 **Data Dragon 버전**에 매인다. */
export function skinIndexFile(dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "aggregated", "skin-index.json");
}
