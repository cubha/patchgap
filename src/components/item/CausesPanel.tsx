// src/components/item/CausesPanel.tsx
// 항목 상세 "추정 원인(LLM)"(ST-12 ⑤) — causes[]와 llm.summary를 표시한다. 서버 컴포넌트(순수
// JSX, 상태 없음). 검증된 원인만 유색 링크로 노출하고(candidateNoteId → notes(to) 원문 앵커),
// 미검증은 회색 "근거 미확인" — 무근거 문장 회색 원칙(UX-BRIEF §7) 그대로 적용.

import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { fmtKst } from "@/lib/format";
import { LLM_MODEL } from "@/pipeline/match/llm-config";

export interface CausesPanelProps {
  causes: DeltaRecord["causes"];
  llm: DeltaRecord["llm"];
  /** candidateNoteId → 노트 원문(앵커 조회용). notes(to)가 없으면 빈 Map. */
  notesById: Map<string, PatchNoteItem>;
  /** deltas 파일 meta.generatedAt — llm 캡션의 "캐시 {시각}"에 쓴다. */
  generatedAt: string | null;
}

const CONFIDENCE_LABEL: Record<DeltaRecord["causes"][number]["confidence"], string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export default function CausesPanel({ causes, llm, notesById, generatedAt }: CausesPanelProps) {
  return (
    <div className="flex flex-1 flex-col">
      {causes.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">간접 영향 후보 없음</p>
      ) : (
        <div className="flex flex-col">
          {causes.map((cause, i) => {
            const candidate = cause.candidateNoteId ? notesById.get(cause.candidateNoteId) : undefined;
            return (
              <div
                key={`${cause.candidateNoteId ?? "none"}-${i}`}
                className="flex items-start justify-between gap-4 border-b border-border-soft px-5 py-4 last:border-b-0"
              >
                {/* 2026-09-18(ST-2): `low`는 인용 노트가 실재해도(verified) 회색으로 둔다 —
                    "검증 ✓"가 "믿을 만함"으로 읽히던 것을 신뢰도 라벨로 바꿨다. */}
                {cause.verified && candidate ? (
                  <a
                    href={candidate.anchorUrl}
                    className={`text-sm hover:underline ${cause.confidence === "low" ? "text-muted" : "text-accent"}`}
                  >
                    {cause.text}
                  </a>
                ) : (
                  <span className="text-sm text-muted">{cause.text}</span>
                )}
                <span
                  className={`whitespace-nowrap text-xs font-bold ${
                    cause.verified && cause.confidence !== "low" ? "text-accent" : "text-muted"
                  }`}
                >
                  {cause.verified ? `노트 인용 ✓ · 신뢰도 ${CONFIDENCE_LABEL[cause.confidence]}` : "인용 노트 없음"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {llm ? (
        // mt-auto — 부모(SectionCard)가 옆 컬럼과 하단을 맞추려 flex-1로 늘어난 경우, 카드
        // 안에서 이 블록(캡션 포함 마지막 요소)이 항상 카드 하단에 붙도록 한다. 늘어난 공간이
        // 없으면(자연 높이) mt-auto는 0이라 기존 pt-0 간격 그대로 유지된다.
        <div className="mt-auto px-5 py-4 pt-0">
          {llm.skipped ? (
            <p className="mb-2 text-xs text-muted">LLM 미실행({llm.reason ?? "사유 없음"})</p>
          ) : llm.summary ? (
            <p className={`mb-2 text-sm ${llm.summaryVerified ? "text-fg" : "text-muted"}`}>
              {llm.summary}
            </p>
          ) : null}
          {generatedAt ? (
            <span className="text-xs font-bold text-muted">{llmCaption(generatedAt)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** llm 캡션("모델 claude-sonnet-5 · 캐시 {generatedAt}")을 만든다 — 컴포넌트 밖에서도 재사용
 * 가능하도록 분리한 소품 함수(순수). */
export function llmCaption(generatedAt: string): string {
  return `모델 ${LLM_MODEL} · 캐시 ${fmtKst(generatedAt)}`;
}
