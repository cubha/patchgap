// src/components/home/indirectEffects.ts
// 홈 "간접 영향" 섹션 선택 로직 — `status==="indirect-effect"` 델타를 원인 노트와 묶어
// 인과 체인(`엔티티 지표 Δ ← [섹션] 원인 엔티티`)으로 보여줄 수 있는 형태로 반환한다.
//
// **왜 별도 섹션인가**(사용자 확정, 2026-09-13): 간접 영향 그룹은 릴리즈 스트림에 끼워넣지
// 않는다(옵션 B) — `releaseStream.ts`가 `status==="unannounced"`만 그룹핑하므로 자동으로 빠진다.
// 대신 홈 하단 전용 섹션에서 노출한다. 사용자가 지목한 가치 있는 형태가 "드레이븐 노트는
// 0건인데 승률·픽률이 급락 ← 드레이븐이 올리는 코어템이 너프됨"이고, 이건 스트림에 섞어
// 흘리는 것보다 인과 체인을 한 줄로 보여주는 편이 훨씬 잘 전달되기 때문이다.
//
// 렌더는 IndirectEffectPanel.tsx 몫 — 이 모듈은 순수 선택·해석만 한다(부수효과 없음).

import type { DeltaRecord, DeltasFile, PatchNoteItem } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { meetsIndirectEffectConfidence } from "@/pipeline/match/indirect-effect";
import { absDelta } from "./logic";

export interface IndirectEffectEntry {
  record: DeltaRecord;
  /** LLM이 제시한 원인 문장(검증된 후보의 텍스트). */
  causeText: string;
  /** 원인 노트의 엔티티명(예: "폭풍갈퀴") — notes에서 못 찾으면 null. */
  causeEntity: string | null;
  /** 원인 노트의 섹션(champion/item/system/other) — 못 찾으면 null. */
  causeSection: PatchNoteItem["section"] | null;
  /** 원인 노트 원문 앵커 — 못 찾으면 null(무근거는 링크를 걸지 않는다). */
  causeAnchor: string | null;
}

/**
 * 엔티티 종류 정렬 순위 — **행위자(champion·item)가 집계 지표(lane·objective·summary)보다 앞**.
 *
 * 근거(사용자 지적, 2026-09-13): "챔피언 버프/너프로 인한 골드획득량 감소같은 간접효과는 굳이
 * LLM이 아니어도 게임플레이를 하는사람이라면 자연스러운 인과관계로 인지할 수 있는 상황임."
 * 라인 골드 같은 **집계 지표가 그 구성원(챔피언) 변경 때문에 움직이는 건 산술적으로 자명**해서
 * 발견 가치가 낮다. 반면 "드레이븐 노트는 0건인데 승률·픽률 급락 ← 드레이븐이 올리는 코어템
 * 너프"처럼 행위자 지표가 다른 엔티티 변경으로 움직이는 건 빌드 경로 지식이 있어야 보이는
 * 진짜 발견이다.
 *
 * 실측 함정도 함께 막는다: |delta|만으로 정렬하면 골드(수십~수백)가 비율(0.0x)을 수천 배
 * 압도해 라인 골드가 섹션 상위를 독점한다(재생성 후 실제로 상위 2칸을 먹었다).
 *
 * 2026-09-13 2차 이후 이 순위는 **드문 경로**가 됐다 — 연속 지표에 효과크기 바닥이 생겨
 * (`aggregate/stats.ts` EFFECT_SIZE_FLOORS, 골드 상대 3%) 집계 엔티티 행은 애초에
 * `unannounced`가 되지 못하고, `indirect-effect` 재분류는 `unannounced`만 대상으로 한다.
 * 그래도 남겨 둔다: 바닥을 넘는 대형 라인 골드 변화(3% 이상)는 여전히 여기로 올 수 있고,
 * 그때도 행위자 지표가 먼저 보여야 한다는 판단은 그대로다.
 */
const ENTITY_TYPE_RANK: Record<DeltaRecord["entityType"], number> = {
  champion: 0,
  item: 0,
  lane: 1,
  objective: 1,
  summary: 1,
};

/** 재분류와 **같은 기준**으로 대표 원인 후보를 고른다 — 파이프라인이 이미 status를 확정했지만,
 * 화면에 띄울 인과 체인은 그 판정 근거가 된 후보여야 한다(더 낮은 신뢰도 후보를 보여주면
 * "왜 이게 간접 영향이지?"가 성립하지 않는다). */
function pickCause(record: DeltaRecord) {
  return (
    record.causes.find(
      (cause) => cause.verified && cause.candidateNoteId !== null && meetsIndirectEffectConfidence(cause.confidence)
    ) ?? null
  );
}

/**
 * `indirect-effect` 델타를 |delta| 내림차순 상위 `limit`건 골라 원인 노트와 묶는다.
 * `deltas`/`notes` 어느 한쪽이 없어도 throw하지 않는다(홈 빈 상태 관례).
 */
export function selectIndirectEffects(
  deltas: DeltasFile | null,
  notes: NotesFile | null,
  limit = 5
): IndirectEffectEntry[] {
  const notesById = new Map((notes?.items ?? []).map((item) => [item.id, item] as const));

  const entries: IndirectEffectEntry[] = [];
  for (const record of deltas?.rows ?? []) {
    if (record.status !== "indirect-effect") continue;
    const cause = pickCause(record);
    if (!cause) continue; // 판정 근거를 화면에서 재현할 수 없는 행은 섹션에 올리지 않는다
    const note = cause.candidateNoteId ? (notesById.get(cause.candidateNoteId) ?? null) : null;
    entries.push({
      record,
      causeText: cause.text,
      causeEntity: note?.entity ?? null,
      causeSection: note?.section ?? null,
      causeAnchor: note?.anchorUrl ?? null,
    });
  }

  entries.sort((a, b) => {
    const rankDiff = ENTITY_TYPE_RANK[a.record.entityType] - ENTITY_TYPE_RANK[b.record.entityType];
    if (rankDiff !== 0) return rankDiff;
    return absDelta(b.record) - absDelta(a.record);
  });
  return entries.slice(0, limit);
}
