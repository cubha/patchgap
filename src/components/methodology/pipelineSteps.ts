// src/components/methodology/pipelineSteps.ts
// 방법론 페이지 "데이터 파이프라인"(ST-12 ①) — 4단(수집→집계→짝짓기→판정) 표시용 데이터를
// 만드는 순수 함수(테스트 대상). 실제 fs 접근(loadSummary/loadNotes/loadDeltas)은 페이지가
// 하고, 이 함수는 이미 로드된 값만 받는다. 데이터가 없으면(빈 빌드) 각 필드는 "—".

import { FDR_ALPHA } from "@/pipeline/aggregate/stats";
import { fmtInt, fmtKst } from "@/lib/format";

export interface PipelineStepView {
  step: number;
  title: string;
  detail: string;
  meta: string[];
}

export interface PipelineStepsInput {
  from: string | null;
  to: string | null;
  matchesFrom: number | null;
  matchesTo: number | null;
  collectedAt: string | null;
  /**
   * 노트 "엔티티" 수(코디네이터 정정, 2026-09-05) — `src/components/home/logic.ts`의
   * `countRelevantNoteEntities(notes)`와 동일 기준(champion/item 섹션의 고유 `section:entity`
   * 쌍)으로 계산해서 넘겨야 한다. 홈 헤드라인("패치노트는 N개 엔티티를 말했고")과 이 파이프라인
   * 3단 표기가 서로 다른 수(항목 수 vs 엔티티 수)를 보여주면 같은 데이터를 두 화면이 다르게
   * 세는 것처럼 보여 신뢰를 해친다 — 반드시 항목 수(`PatchNoteItem[].length`)가 아니라 이
   * 필드를 표시 기준으로 삼는다.
   */
  noteEntityCount: number | null;
  /** 원문 패치노트 "항목" 수(`NotesFile.meta.itemCount`) — 참고용 병기. null이면 병기하지
   * 않고 엔티티 수만 표시한다. */
  noteItemCount: number | null;
  notesFetchedAt: string | null;
  matchedAt: string | null;
  significantCount: number | null;
  judgedAt: string | null;
}

const DASH = "—";

function nCaption(before: number | null, after: number | null): string {
  if (before === null && after === null) return DASH;
  if (before === null) return `n=${fmtInt(after as number)}`;
  if (after === null) return `n=${fmtInt(before)}`;
  return `n=${fmtInt(before)} / ${fmtInt(after)}`;
}

function timeCaption(iso: string | null): string {
  return iso ? fmtKst(iso) : DASH;
}

/** "노트 {N} 엔티티"(+ 있으면 "· {M}항목" 병기) — 홈 헤드라인 규칙(N=고유 엔티티 수)과
 * 일치시킨다(코디네이터 정정, 2026-09-05: 이전엔 항목 수(`itemCount`)를 그대로 노출해
 * 홈("35개 엔티티")과 방법론("215항목")이 다른 숫자를 보여줬다). */
function noteCaption(entityCount: number | null, itemCount: number | null): string {
  if (entityCount === null) return DASH;
  const base = `노트 ${fmtInt(entityCount)} 엔티티`;
  return itemCount === null ? base : `${base} · ${fmtInt(itemCount)}항목`;
}

/** 파이프라인 4단 뷰 모델을 만든다. 입력이 전부 null이어도(빈 데이터 빌드) 크래시 없이
 * "—" 플레이스홀더로 채워진 4단을 반환한다. */
export function buildPipelineSteps(input: PipelineStepsInput): PipelineStepView[] {
  return [
    {
      step: 1,
      title: "수집",
      detail: "Riot Match-V5 · Timeline API — GitHub Actions cron 자동 수집",
      meta: [nCaption(input.matchesFrom, input.matchesTo), timeCaption(input.collectedAt)],
    },
    {
      step: 2,
      title: "집계",
      detail: "픽·밴·승률·아이템·골드·오브젝트",
      meta: ["1차축 5종", timeCaption(input.collectedAt)],
    },
    {
      step: 3,
      title: "짝짓기",
      detail: "1단 결정론 매칭 / 2단 LLM 후보 검증",
      meta: [
        noteCaption(input.noteEntityCount, input.noteItemCount),
        timeCaption(input.matchedAt ?? input.notesFetchedAt),
      ],
    },
    {
      step: 4,
      title: "판정",
      detail: `BH-FDR q<${FDR_ALPHA} 유의성 판정`,
      meta: [
        input.significantCount === null ? DASH : `유의 변화 ${fmtInt(input.significantCount)}`,
        timeCaption(input.judgedAt),
      ],
    },
  ];
}
