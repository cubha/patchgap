// src/pipeline/shared/excluded-notes.ts
// 화면·집계에서 **제외**하는 패치노트 묶음 — 2026-09-18 라운드6(사용자 L1).
//
// 「의회 - 투표 1 결과」(26.18, 34줄)는 파서가 h3 없는 섹션 라벨을 엔티티로 폴백한 묶음인데, 내용은
// 패치 내용이 아니라 커뮤니티 투표 집계("제안된 아이템 3개 모두 부활" · "1. 너무 짧다 - 1.87%")다.
// 사용자: "어떤 데이터를 표시하는지도 모르겠고 … 고랭크 유저에게 전혀 불필요한 정보기 때문에 없어도
// 될듯". 파서·데이터는 건드리지 않는다(LLM 캐시 키가 전체 노트 해시라 파서 수정은 캐시 전량 무효 —
// sectionBundle.ts 헤더) — 표시 층위와 집계 층위가 **같은 술어**를 보게 여기 한 곳에 둔다:
// 홈 스트림(page.tsx) · 엔티티 수(`notes-count.ts` → 히어로·방법론·대조표 커버리지·디스코드).
//
// 키는 엔티티명이다. `anchorKind==="section"`은 피오라 65줄도 잡아 쓸 수 없고(BRAINTRUST-residual3 §2),
// `section==="champion"`이라 섹션으로도 못 가른다. 투표 결과 묶음은 이름이 곧 정체다.
import type { PatchNoteItem } from "../types";

const EXCLUDED_ENTITY_RE = /의회|투표\s*\d*\s*결과/;

export function isExcludedNote(note: Pick<PatchNoteItem, "entity">): boolean {
  return EXCLUDED_ENTITY_RE.test(note.entity);
}
