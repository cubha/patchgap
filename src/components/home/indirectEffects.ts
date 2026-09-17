// src/components/home/indirectEffects.ts
// 홈 Gap 탭의 인과 체인 조회 — `status==="indirect-effect"` 델타를 원인 노트와 묶어
// 인과 체인(`엔티티 지표 Δ ← [섹션] 원인 엔티티`)으로 보여줄 수 있는 형태로 반환한다.
//
// ~~**왜 별도 섹션인가**(사용자 확정, 2026-09-13)~~ → **2026-09-17 폐기**. 당시 판단은 간접
// 영향을 홈 하단 전용 섹션으로 빼는 것이었고(옵션 B), 인과 체인을 한 줄로 보여준다는 목적은
// 옳았다. 그러나 실물에서 사용자가 **"미공지 Gap 탭의 데이터와 노트에 없는 파급효과/간접 영향
// 섹션의 데이터가 동일한 목적으로 보이는데 다른영역에 별도로 표기되니 혼돈됨"**을 지적했고,
// 판별해 보니 실제로 **같은 뿌리**였다 — `indirect-effect`는 `unannounced`를 재분류한 결과라
// 두 상태는 배타적이면서 부분집합 관계다(차이는 "원인이 규명됐는가" 하나).
// 지금은 Gap 탭 **한 곳**에 모으고, 인과 체인은 그 안의 행에서 그린다.
//
// 이 모듈이 남아 있는 이유: 인과 체인을 만들려면 여전히 "판정 근거가 된 후보"를 골라 원인
// 노트와 묶어야 한다. 선택·해석만 하고 렌더는 ReleaseNoteRow 몫이다(부수효과 없음).

import type { DeltaRecord, DeltasFile, PatchNoteItem } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { meetsIndirectEffectConfidence } from "@/pipeline/match/indirect-effect";

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

// **폐기된 정렬 순위의 Why는 남긴다**(2026-09-13 사용자 지적, 2026-09-17 코드 삭제):
// "챔피언 버프/너프로 인한 골드획득량 감소같은 간접효과는 굳이 LLM이 아니어도 게임플레이를
// 하는사람이라면 자연스러운 인과관계로 인지할 수 있는 상황임." — 집계 지표(lane·objective·
// summary)가 그 구성원(챔피언) 변경으로 움직이는 건 산술적으로 자명해 발견 가치가 낮고,
// 행위자 지표(champion·item)가 다른 엔티티 변경으로 움직이는 쪽이 진짜 발견이다. 이 순위를
// 코드에서 뺀 이유는 두 가지다: ① 연속 지표에 효과크기 바닥이 생긴 뒤(2026-09-13 2차) 집계
// 엔티티는 애초에 `unannounced`가 되지 못해 `indirect-effect` 재분류 대상에서 구조적으로
// 빠진다(실측 잔존 0건) ② Gap 탭 통합 후 정렬은 `releaseStream`의 maxAbsDelta 한 곳이
// 소유한다 — 같은 목록에 정렬 기준이 둘이면 둘 중 하나는 반드시 조용히 진다.
// (|delta| 단독 정렬의 함정도 그때 실측됐다: 골드(수십~수백)가 비율(0.0x)을 수천 배 압도해
//  라인 골드가 상위를 독점한다. 바닥이 그 입구를 막은 것이 현재의 방어선이다.)

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
 * `deltaId → 인과 체인` 색인 — Gap 탭 행이 자기 원인을 즉시 찾을 수 있게 한다.
 *
 * `selectIndirectEffects`와 달리 **정렬·상한이 없다**. 그쪽은 "하단 섹션에 상위 N건만
 * 올린다"는 화면 정책이었고, 여기는 "이 행에 원인이 있으면 그려라"는 조회다 — 정책과 조회를
 * 한 함수에 섞으면 상한 때문에 어떤 행의 원인만 조용히 사라진다.
 */
export function indexIndirectCauses(
  deltas: DeltasFile | null,
  notes: NotesFile | null
): Record<string, IndirectEffectEntry> {
  const notesById = new Map((notes?.items ?? []).map((item) => [item.id, item] as const));
  const out: Record<string, IndirectEffectEntry> = {};
  for (const record of deltas?.rows ?? []) {
    if (record.status !== "indirect-effect") continue;
    const cause = pickCause(record);
    if (!cause) continue;
    const note = cause.candidateNoteId ? (notesById.get(cause.candidateNoteId) ?? null) : null;
    out[record.id] = {
      record,
      causeText: cause.text,
      causeEntity: note?.entity ?? null,
      causeSection: note?.section ?? null,
      causeAnchor: note?.anchorUrl ?? null,
    };
  }
  return out;
}
