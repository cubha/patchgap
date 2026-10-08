// src/components/observation/ObservationCauses.tsx
// 패널 안 「추정 원인(LLM) — 이 지표·구간」 본문 — 세 게임이 같은 규칙을 쓴다(2026-10-06, PLAN D4).
//
// 순서: LLM 브리핑 한 줄(지표 단위 문장이라 여기가 제 자리다) → 원인 후보(`CausesPanel` — 검증 high → … → 미검증).
// 전에는 LoL은 지표 구획에 요약 줄 + 대상 단위 원인 카드, TFT는 지표별 원인 카드, PUBG는 무기 단위 원인 카드로
// 세 자리가 달랐다.
//
// `llm`이 없으면 그 관측은 LLM 2단 대상이 아니었다(1단에서 노트와 짝지어졌거나 미공지·공지-불일치가 아니었다) —
// 빈칸이 아니라 그 사실을 문장으로 말한다(무근거 회색 원칙과 같은 정직).
import CausesPanel from "@/components/causes/CausesPanel";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";

export interface ObservationCausesProps {
  causes: DeltaRecord["causes"];
  llm: DeltaRecord["llm"];
  notesById: Map<string, PatchNoteItem>;
  generatedAt: string | null;
  /** 이 관측이 패치노트 항목과 짝지어졌는가 — `llm`이 없을 때 그 이유를 지어내지 않고 사실로 가른다. */
  noteMatched: boolean;
}

export default function ObservationCauses({
  causes,
  llm,
  notesById,
  generatedAt,
  noteMatched,
}: ObservationCausesProps) {
  if (!llm && causes.length === 0) {
    return (
      <p className="pt-3 text-sm text-muted">
        {noteMatched
          ? "패치노트 항목과 바로 짝지어진 변화라 LLM 원인 추정 대상이 아니었습니다."
          : "이 관측에는 LLM 원인 추정 기록이 없습니다."}{" "}
        없는 원인을 지어내지 않습니다.
      </p>
    );
  }
  // 요약 문장은 `CausesPanel`이 **한 번만** 그린다(ST-27, site-review tft-S16·pubg-S24: 같은 문장이 머리와 바닥에 두 번).
  // 근거 등급에 따른 색도 그쪽이 정한다 — 근거가 전부 「신뢰도 낮음」이면 요약도 회색(무근거 회색 원칙).
  return (
    <div className="-mx-5 flex flex-col">
      <CausesPanel causes={causes} llm={llm} notesById={notesById} generatedAt={generatedAt} />
    </div>
  );
}
