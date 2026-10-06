// src/pipeline/match/llm-cache.ts
// LLM 2단 파일 캐시 — 후보셋 직렬화·키·읽기/쓰기(2026-10-06 `llm-match.ts` 분할). 키 계산은 **바이트 단위로 불변**이어야
// 한다: 바뀌면 커밋된 캐시(data/cache/llm) 전부가 미스가 되어 같은 답을 다시 산다(`llm-cache-key.test.ts` golden).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PatchNoteItem } from "../types";
import { UNTAGGED_CACHE_EFFORT, type LlmEffort } from "./llm-config";
import type { LlmOutput, LlmUsageTotals } from "./llm-schema";

/** system 프롬프트에 넣는 후보 항목 축약 뷰 — 델타 인과 추론에 필요한 필드만. */
type CandidateView = Pick<
  PatchNoteItem,
  "id" | "entity" | "skill" | "stat" | "before" | "after" | "direction" | "section"
>;

function toCandidateView(note: PatchNoteItem): CandidateView {
  return {
    id: note.id,
    entity: note.entity,
    skill: note.skill,
    stat: note.stat,
    before: note.before,
    after: note.after,
    direction: note.direction,
    section: note.section,
  };
}

/**
 * 후보 패치노트 항목을 id 오름차순으로 정렬한 뒤 직렬화한다. **타임스탬프·랜덤 미포함** —
 * 같은 후보셋이면 언제 호출해도 바이트 단위로 동일한 문자열이 나와야 한다(프롬프트 캐싱 전제).
 */
export function serializeCandidates(notes: readonly PatchNoteItem[]): string {
  const sorted = [...notes].map(toCandidateView).sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

export function candidateSetHash(serialized: string): string {
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export function cacheKeyFor(model: string, promptVersion: string, deltaId: string, candSetHash: string, effort: LlmEffort): string {
  // effort는 무태그 기준 강도가 아닐 때만 키에 든다(llm-config.ts UNTAGGED_CACHE_EFFORT) — 기존 캐시를 그대로
  // 적중시키되, 기준을 "지금 기본값"이 아닌 고정값으로 둬야 기본값을 바꾼 날 옛 답이 새 설정에 붙지 않는다.
  const effortTag = effort === UNTAGGED_CACHE_EFFORT ? "" : `|effort=${effort}`;
  return crypto
    .createHash("sha256")
    .update(`${model}|${promptVersion}|${deltaId}|${candSetHash}${effortTag}`)
    .digest("hex");
}

export interface CacheFileShape {
  deltaId: string;
  model: string;
  promptVersion: string;
  candidateSetHash: string;
  generatedAt: string;
  parsed: LlmOutput;
  usage: LlmUsageTotals;
  /**
   * 문장 규칙 재요청을 이 항목에 몇 번 했나(2026-09-28, C1). 캐시 적중 경로는 이 값이 1 미만일 때만
   * 되묻는다 — 없으면 고쳐지지 않는 위반을 **매 실행마다** 다시 물었다(실행당 약 11건, 영구 누수).
   * 필드가 없는 옛 캐시는 0으로 읽혀 한 번 더 묻는다(사용자 결정 D1의 「1회 추가 재요청」).
   */
  proseRepairAttempts?: number;
}

export function readCache(cacheDir: string, key: string): CacheFileShape | null {
  const filePath = path.join(cacheDir, `${key}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as CacheFileShape;
  } catch {
    return null; // 손상된 캐시 파일 — 재호출 유도(폐기 아님, 그냥 miss 취급)
  }
}

export function writeCache(cacheDir: string, key: string, value: CacheFileShape): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `${key}.json`), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
