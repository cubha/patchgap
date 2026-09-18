// src/pipeline/shared/display-normalize.ts
// 표시용 델타 정규화(2026-09-18 라운드6 재판정 보완 1·2) — **순수 함수**, 판정 엔진·산출물 불변.
//
// 왜 필요한가: 26.18 원문의 클래식 모드 섹션이 파서에서 "피오라" 65줄로 귀속됐고, `verdict.ts`는 그
// 노트를 근거로 피오라 픽률·밴률을 "공지"로, LLM은 아트록스 승률의 원인으로 그 조항("끝없는 갈증" —
// 실은 모드 전용 워윅 조항)을 인용했다. 파서·verdict·deltas JSON은 이번 라운드 보호 대상이라 표시 층위가
// **제외 노트 우주**(excluded-notes.ts)를 기준으로 판정을 다시 읽는다:
//   ① 짝지은 노트가 전부 제외 노트(또는 노트 파일에 없음)인 공지 관측 → 짝이 없는 것이다 → 엔진과 같은
//      규칙으로 다시 읽는다: 유의·바닥 통과면 `unannounced`, 유의하나 바닥 미달이면 `below-threshold`,
//      비유의면 `no-change`(표본 부족은 그대로). 무조건 미공지로 돌리면 q=0.38짜리 행이 Gap 카드에 오른다(실측).
//   ② 제외 노트를 인용한 원인 후보 → `verified:false`(무근거는 회색 — CLAUDE.md 원칙). LLM 요약(S3)이
//      인용한 후보(`llm.summaryCites`)에 제외 노트가 있으면 `summaryVerified:false`(상세 원인 카드가 회색으로).
//   ③ ②로 검증된 후보가 하나도 안 남은 `indirect-effect` → `unannounced`(재분류 근거가 사라졌다)
// 노트 파일이 없으면 손대지 않는다(loadDeltas 왕복 테스트·빈 데이터 빌드 보존). `meta.counts`는
// 정규화 뒤 행 기준으로 다시 센다 — 방법론 파이프라인 카드가 이 값을 읽는다.
import type { DeltaRecord, DeltasFile, LlmCause, MatchStatus, PatchNoteItem } from "../types";
import { meetsEffectFloor } from "../aggregate/stats";
import { isDisplayExcludedNote } from "./excluded-notes";
import { isSignificantDelta } from "./significance";

/** 짝이 사라진 공지 관측이 받을 상태 — verdict.ts의 무짝 분기와 같은 순서(표본 부족 → 유의 → 바닥). */
function unpairedStatus(record: DeltaRecord, qAlpha: number | undefined): MatchStatus {
  if (record.status === "insufficient-sample") return record.status;
  if (!isSignificantDelta(record, qAlpha)) return "no-change";
  if (record.delta !== null && !meetsEffectFloor(record.metric, record.delta, record.before)) return "below-threshold";
  return "unannounced";
}

export function normalizeRecordForDisplay(
  record: DeltaRecord,
  notesById: ReadonlyMap<string, PatchNoteItem>,
  qAlpha?: number
): DeltaRecord {
  const excluded = (id: string | null): boolean => {
    if (id === null) return false;
    const note = notesById.get(id);
    return note === undefined || isDisplayExcludedNote(note);
  };

  let changed = false;
  const causes: LlmCause[] = record.causes.map((cause) => {
    if (cause.verified && cause.candidateNoteId !== null && excluded(cause.candidateNoteId)) {
      changed = true;
      return { ...cause, verified: false };
    }
    return cause;
  });

  let status: MatchStatus = record.status;
  let matchedNoteIds = record.matchedNoteIds;
  let matchedNoteId = record.matchedNoteId;
  if (matchedNoteIds.length > 0 && matchedNoteIds.every(excluded)) {
    if (status === "announced-consistent" || status === "announced-inconsistent") status = unpairedStatus(record, qAlpha);
    matchedNoteIds = [];
    matchedNoteId = null;
    changed = true;
  }
  if (status === "indirect-effect" && !causes.some((cause) => cause.verified && cause.candidateNoteId !== null)) {
    status = "unannounced";
    changed = true;
  }
  let llm = record.llm;
  if (llm && llm.summaryVerified && (llm.summaryCites ?? []).some(excluded)) {
    llm = { ...llm, summaryVerified: false };
    changed = true;
  }
  if (!changed) return record;
  return { ...record, status, matchedNoteIds, matchedNoteId, causes, llm };
}

export function normalizeDeltasForDisplay(
  file: DeltasFile | null,
  notes: readonly PatchNoteItem[] | null
): DeltasFile | null {
  if (file === null || notes === null) return file;
  const notesById = new Map(notes.map((note) => [note.id, note] as const));
  const rows = file.rows.map((record) => normalizeRecordForDisplay(record, notesById, file.meta.qAlpha));
  const counts: Partial<Record<MatchStatus, number>> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return { ...file, meta: { ...file.meta, counts }, rows };
}
