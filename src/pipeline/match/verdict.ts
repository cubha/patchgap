// src/pipeline/match/verdict.ts
// F4: entity-match(1단) 결과를 델타에 병합해 최종 MatchStatus를 산출하고, deltas/{from}_{to}.json에
// 기록한다. LLM(2단, causes)은 이 단계 이후 run-match.ts가 별도로 채운다(verdict는 causes를
// 건드리지 않는다 — assignStatus는 통계+1단 매칭만으로 status를 정한다).
//
// 상태 판정 순서(PLAN ③ ST-08 행 그대로, n 게이트를 유의성 표보다 먼저 확인 — PLAN ②는 "승률
// 델타는 n>=200 게이트... 미달=insufficient-sample"을 무조건 조항으로 서술한다):
//   1) metric==="winRate" && !passesSampleGate(n.before, n.after) → "insufficient-sample"(무조건).
//   2) 유의(q<FDR_ALPHA && CI가 0을 포함하지 않음):
//        노트 짝 있음 → 방향 일치("consistent") → "announced-consistent"
//                       불일치/중립           → "announced-inconsistent"
//        노트 짝 없음 → 효과크기 바닥(aggregate/stats.ts meetsEffectFloor) 충족 → "unannounced"
//                                                                       미달 → "below-threshold"
//   3) 비유의:
//        노트 짝 있음 → "announced-inconsistent"(노트는 변경을 말했지만 관측 변화가 유의하지 않음)
//        노트 짝 없음 → "no-change"(ST-08 신규 상태 — "잡음 델타"를 "미공지 변화"와 구분)
//
// ⚠️ 효과크기 바닥은 "짝 없음" 분기에만 건다 — isSignificant() 자체에 넣지 않는다(2026-09-13
// 설계 정정, docs/plan/PLAN-unannounced-effect-size-floor-2026-09-13.md ②-1). isSignificant()를
// false로 만들면 노트 짝이 있는 델타가 아래 3)번(비유의) 분기로 떨어져 "announced-inconsistent"가
// 되는데, 픽/밴 |delta| 중앙값(0.76%p)이 바닥(2~3%p)보다 작아 정상적으로 공지-일치한 델타 다수가
// "공지-불일치"로 뒤집히는 회귀가 생긴다. isSignificant()는 순수 통계 판정으로 유지하고
// `src/pipeline/shared/significance.ts`의 isSignificantDelta와 의미를 계속 일치시킨다(below-
// threshold 행도 "통계적으로 유의한 변화"로 계속 집계되는 것은 의도된 동작 — "실재하지만 실무상
// 무시 가능한 규모"라는 정의와 일치).

import fs from "node:fs";
import type { ProseHygieneStats } from "./llm-match";
import path from "node:path";
import type { DeltaRecord, DeltasFileMeta, MatchStatus, PatchId, PatchNoteItem } from "../types";
import { DATA_ROOT } from "../shared/paths";
import { FDR_ALPHA, meetsEffectFloor, passesSampleGate } from "../aggregate/stats";
import { STATUS_SORT_PRIORITY } from "../shared/status-order";
import type { EntityMatchInfo, EntityMatchOutcome } from "./entity-match";

function isSignificant(delta: DeltaRecord): boolean {
  if (delta.q === null) return false;
  const [low, high] = delta.ci;
  const ciExcludesZero = low > 0 || high < 0;
  return delta.q < FDR_ALPHA && ciExcludesZero;
}

/**
 * 델타 1건 + (있으면) 1단 매칭 정보로 최종 MatchStatus를 정한다. 순수 함수 — delta 자체의
 * q/ci/n/metric만 읽고 부수효과 없음.
 */
export function assignStatus(delta: DeltaRecord, match: EntityMatchInfo | null): MatchStatus {
  if (delta.metric === "winRate" && !passesSampleGate(delta.n.before, delta.n.after)) {
    return "insufficient-sample";
  }

  const hasNote = match !== null && match.noteIds.length > 0;

  if (isSignificant(delta)) {
    if (!hasNote) {
      return meetsEffectFloor(delta.metric, delta.delta, delta.before) ? "unannounced" : "below-threshold";
    }
    return match!.directionAgreement === "consistent" ? "announced-consistent" : "announced-inconsistent";
  }

  return hasNote ? "announced-inconsistent" : "no-change";
}

/**
 * entity-match.ts의 매칭 결과를 델타 배열에 병합한다 — status/matchedNoteId/matchedNoteIds/
 * evidence.noteAnchor를 채운 새 배열을 반환한다(입력 배열은 변경하지 않음). `notesById`는
 * matchedNoteId의 anchorUrl을 evidence.noteAnchor에 채우기 위한 조회용.
 */
export function applyVerdicts(
  deltas: readonly DeltaRecord[],
  matchOutcome: EntityMatchOutcome,
  notesById: ReadonlyMap<string, PatchNoteItem>
): DeltaRecord[] {
  return deltas.map((delta) => {
    const match = matchOutcome.matches.get(delta.id) ?? null;
    const status = assignStatus(delta, match);
    const matchedNoteIds = match?.noteIds ?? [];
    const matchedNoteId = matchedNoteIds.length > 0 ? matchedNoteIds[0] : null;
    const noteAnchor = matchedNoteId ? (notesById.get(matchedNoteId)?.anchorUrl ?? null) : null;

    return {
      ...delta,
      status,
      matchedNoteId,
      matchedNoteIds,
      evidence: {
        ...delta.evidence,
        noteAnchor,
      },
    };
  });
}

/** PatchNoteItem[] → id로 바로 찾는 Map. applyVerdicts의 noteAnchor 조회에 쓴다. */
export function indexNotesById(notes: readonly PatchNoteItem[]): Map<string, PatchNoteItem> {
  const map = new Map<string, PatchNoteItem>();
  for (const note of notes) map.set(note.id, note);
  return map;
}

/** status 우선순위 → |delta| 내림차순(PLAN ③ ST-08 행 정렬 규칙). delta===null은 맨 뒤로 민다.
 * 우선순위 값 자체는 `src/pipeline/shared/status-order.ts` 단일 소스(STATUS_SORT_PRIORITY)를
 * 쓴다 — compare/logic.ts(클라이언트)의 대표 상태 판정도 같은 파일을 참조해 두 곳이 갈라지지
 * 않는다(2026-09-13, below-threshold 도입). */
export function sortDeltas(deltas: readonly DeltaRecord[]): DeltaRecord[] {
  return [...deltas].sort((a, b) => {
    const priorityDiff = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    const absA = a.delta === null ? -Infinity : Math.abs(a.delta);
    const absB = b.delta === null ? -Infinity : Math.abs(b.delta);
    return absB - absA;
  });
}

/** run-match.ts가 LLM(2단) 실행 요약을 여기 채워 deltas.json meta.llm에 그대로 실린다(ST-09). */
export interface DeltasLlmMeta {
  calls: number;
  cacheHits: number;
  skipped: number;
  usage: {
    inputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    outputTokens: number;
  };
  /**
   * 산출 문장의 길이·완곡 종결 위생 집계(2026-09-19). 판정에는 쓰이지 않고 **다음 실행이 개선을
   * 측정할 수 있게** 남기는 수치다 — 근거는 llm-match.ts의 summarizeProseHygiene 주석.
   */
  prose?: ProseHygieneStats;
  /** 문장 규칙 위반으로 1회 재요청한 델타 수(v5). `calls`처럼 **이 실행**의 수치다 — 2026-09-19
   * 부터는 캐시 적중분도 검사·재요청 대상이라 캐시만 읽은 실행에서도 0이 아닐 수 있다.
   * 없으면 계수기가 생기기 전의 파일이다. */
  proseRepairs?: number;
}

export interface WriteDeltasParams {
  from: PatchId;
  to: PatchId;
  deltas: readonly DeltaRecord[];
  qAlpha?: number;
  llm?: DeltasLlmMeta;
  /** 테스트 격리용 — 기본은 shared/paths.ts의 DATA_ROOT. */
  dataRoot?: string;
}

export interface WriteDeltasResult {
  filePath: string;
  sorted: DeltaRecord[];
}

/** deltas/{from}_{to}.json에 정렬된 델타 + meta를 기록한다(디렉토리 자동 생성). */
export function writeDeltas(params: WriteDeltasParams): WriteDeltasResult {
  const sorted = sortDeltas(params.deltas);
  const counts: Partial<Record<MatchStatus, number>> = {};
  for (const record of sorted) {
    counts[record.status] = (counts[record.status] ?? 0) + 1;
  }

  const meta: DeltasFileMeta = {
    from: params.from,
    to: params.to,
    generatedAt: new Date().toISOString(),
    n: sorted.length,
    counts,
    qAlpha: params.qAlpha ?? FDR_ALPHA,
  };
  if (params.llm) meta.llm = params.llm;

  const dataRoot = params.dataRoot ?? DATA_ROOT;
  const filePath = path.join(dataRoot, "aggregated", "deltas", `${params.from}_${params.to}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ meta, rows: sorted }, null, 2)}\n`, "utf8");

  return { filePath, sorted };
}
