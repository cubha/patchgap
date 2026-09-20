// src/components/tft/causeRows.ts
// TFT 홈의 "추정 원인" 목록 선택 — **표가 못 하는 일을 한다.**
//
// 대조표는 "무엇이 얼마나 움직였나"를 답한다. 사용자 지적(2026-09-20)은 그 다음 질문이
// 화면에 없다는 것이었다: "이 시스템 목적이 LLM분석을 통한 원인분석 → 사용자에게 자연어로
// 예상원인 등 전달하는건데". 그 문장이 들어갈 자리가 이 목록이다.
//
// 선택 규칙은 **화면 규칙을 새로 만들지 않는다** — 표에 오를 자격(`isReportableRecord`)과
// 정렬(`DISPLAY_SORT_PRIORITY` → 바닥 대비 배수)을 대조표와 그대로 공유한다. 여기서 따로
// 정렬하면 같은 페이지가 두 가지 중요도를 주장하게 된다.
import { DISPLAY_SORT_PRIORITY, displayStatus, type DisplayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import type { DeltaRecord, LlmCause } from "@/pipeline/types";
import { sortCauses } from "@/components/causes/causeOrder";
import { effectStrength } from "./entityRows";

export interface TftCauseRow {
  record: DeltaRecord;
  status: DisplayStatus;
  /** LLM 브리핑 한 줄. 없으면 null(원인 후보만 있는 경우). */
  summary: string | null;
  /** 인용이 후보셋 안에 있는가 — false면 화면이 회색으로 떨어뜨린다(무근거 회색 원칙). */
  summaryVerified: boolean;
  /** 신뢰도 순으로 정렬된 원인 후보(검증 high → medium → low → 미검증). */
  causes: LlmCause[];
}

/**
 * 원인 문장이 실제로 있는 관측만 고른다.
 *
 * `llm.skipped`(예산 초과·파싱 실패)는 제외한다 — "검토했으나 후보가 없다"와 "검토하지
 * 못했다"는 다른 사실이고, 후자를 원인 목록에 올리면 빈 줄이 원인인 척한다. 그 사실은 상세
 * 페이지의 `CausesPanel`이 "LLM 미실행(사유)"로 정직하게 말한다.
 */
export function selectTftCauseRows(
  rows: readonly DeltaRecord[],
  qAlpha: number | undefined,
  limit: number
): TftCauseRow[] {
  const picked: TftCauseRow[] = [];
  for (const record of rows) {
    if (!isReportableRecord(record, qAlpha)) continue;
    const llm = record.llm;
    if (!llm || llm.skipped) continue;
    const summary = llm.summary ?? null;
    const hasText = (summary !== null && summary.length > 0) || record.causes.length > 0;
    if (!hasText) continue;
    picked.push({
      record,
      status: displayStatus(record, qAlpha),
      summary,
      summaryVerified: llm.summaryVerified !== false,
      causes: sortCauses(record.causes),
    });
  }
  picked.sort(
    (a, z) =>
      DISPLAY_SORT_PRIORITY[a.status] - DISPLAY_SORT_PRIORITY[z.status] ||
      effectStrength(z.record) - effectStrength(a.record) ||
      a.record.id.localeCompare(z.record.id)
  );
  return picked.slice(0, limit);
}
