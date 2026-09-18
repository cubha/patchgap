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

// scope-critic ST4 권고: "의회" 단독 매치는 미래의 "의회 공지" 같은 묶음을 오탐한다 — 투표와 결합된 형태만.
const EXCLUDED_ENTITY_RE = /의회.*투표|투표\s*\d*\s*결과/;

export function isExcludedNote(note: Pick<PatchNoteItem, "entity">): boolean {
  return EXCLUDED_ENTITY_RE.test(note.entity);
}

// ── 게임 모드 섹션(2026-09-18 라운드6 재판정 보완 1·2) ──────────────────────────────────────────
// 26.18 원문의 「클래식 모드」(#patch-classic — 신규 피오라·갈리오·뽀삐 소개 + 모드 전용 밸런스)와
// 「아수라장 증강」(#patch-aram:-mayhem)은 소환사의 협곡 랭크와 무관한 섹션인데, 파서는 클래식 도입부의
// 첫 챔피언명(피오라)을 엔티티로 잡아 **65줄을 SR 챔피언 피오라의 공지로** 귀속했고, 판정도 그 노트에
// 짝지어 피오라 픽률을 "공지"로 냈다(독립 채점 K1-2·K2-2·K2-3 결함). 파서·판정 산출물은 이번 라운드
// 보호 대상이라 표시 층위에서 의회 제외와 **같은 메커니즘**으로 흡수한다 — 이 노트들은 SR 엔티티 노트가
// 아니므로 ① 엔티티 수·대조표 내비에서 빠지고 ② 홈 "기타 변경"의 카테고리 줄로만 실리며 ③ 이 노트에만
// 짝지어진 관측은 표시용으로 미공지가 된다(display-normalize.ts). 앵커 해시가 곧 섹션이다 — 같은 앵커
// 아래 「버그 수정」·「의회」도 있지만 그건 이름 규칙(위·miscSections)이 먼저 잡는다.
const MODE_SECTION_HASH_RE = /^patch-(classic|aram|arena|swiftplay|brawl|mayhem)/;

export function noteAnchorHash(note: Pick<PatchNoteItem, "anchorUrl">): string {
  const idx = note.anchorUrl.indexOf("#");
  return idx < 0 ? "" : note.anchorUrl.slice(idx + 1);
}

/** 게임 모드 섹션(클래식·아수라장·아레나 …)에 속한 줄 — SR 챔피언·아이템 공지가 아니다. */
export function isModeSectionNote(note: Pick<PatchNoteItem, "anchorUrl">): boolean {
  return MODE_SECTION_HASH_RE.test(noteAnchorHash(note));
}

/** 엔티티 수·내비·짝짓기 우주에서 빠지는 줄 = 의회 투표 결과 ∪ 게임 모드 섹션. 홈은 둘을 다르게
 * 다룬다(의회는 비표시, 모드 섹션은 "기타 변경" 줄) — 그 분기는 호출부가 두 술어를 따로 본다. */
export function isDisplayExcludedNote(note: Pick<PatchNoteItem, "entity" | "anchorUrl">): boolean {
  return isExcludedNote(note) || isModeSectionNote(note);
}
