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
//
// 2026-09-20 추가 좁힘(**결과**를 요구한다): 여기서 빼려는 것은 투표 *집계표*("1. 너무 짧다 - 1.87%")이지
// 의회 기능 공지가 아니다. 파서의 엔티티 귀속이 고쳐지면서 26.17 「체계」의 기능 공지 묶음이 제 이름
// "제1회 의회 투표"를 되찾았는데, 옛 규칙(`의회.*투표`)은 그것까지 잡아 **화면에서 3줄을 지웠다**
// (투표 안건 · 투표 결과 확인 · 랭크 로딩 화면 테두리 삭제 — 전부 실제 패치 내용이다). 26.18의
// 「의회 - 투표 1 결과」는 두 번째 대안이 그대로 잡는다.
const EXCLUDED_ENTITY_RE = /의회.*투표.*결과|투표\s*\d*\s*결과/;

export function isExcludedNote(note: Pick<PatchNoteItem, "entity">): boolean {
  return EXCLUDED_ENTITY_RE.test(note.entity);
}

// ── 게임 모드 섹션 ────────────────────────────────────────────────────────────────────────
// 2026-09-19: 이 판정의 **1차 방어는 이제 파이프라인**이다. 파서가 노트마다 `modeScope`를 새기고
// (src/pipeline/shared/mode-scope.ts), 결정론 매칭과 LLM 인용 검증이 그 값으로 모드 노트를 거른다.
// 여기 있는 술어는 화면이 같은 질문을 할 때 **같은 답을 돌려주기 위한 것**이고, 판정 키를 둘로
// 늘리지 않도록 modeScope를 우선해서 읽는다. 앵커 폴백은 modeScope가 없던 시절의 데이터(또는
// 노트만 갱신되고 델타는 옛 판정으로 남은 중간 상태)를 위한 방어다.
//
// 라운드6 기록(왜 이 층이 먼저 생겼나): 26.18 원문의 「클래식」(#patch-classic — LoL 클래식 모드)
// 아래 피오라 65줄이 파서에서 SR 챔피언 피오라의 공지로 귀속됐고, 판정이 그 노트에 짝지어 피오라
// 픽률을 "공지"로 냈다. 당시엔 파서·판정 산출물이 보호 대상이라 표시 층위에서 흡수했고, 2026-09-19에
// 근본 수정(modeScope)이 들어가면서 이 층은 멱등 가드가 됐다.
import { isCoreNote, modeScopeFromAnchorUrl } from "./mode-scope";

export function noteAnchorHash(note: Pick<PatchNoteItem, "anchorUrl">): string {
  const idx = note.anchorUrl.indexOf("#");
  return idx < 0 ? "" : note.anchorUrl.slice(idx + 1);
}

/** 게임 모드 섹션(클래식·아수라장·아레나 …)에 속한 줄 — SR 챔피언·아이템 공지가 아니다. */
export function isModeSectionNote(note: Pick<PatchNoteItem, "anchorUrl"> & Partial<Pick<PatchNoteItem, "modeScope">>): boolean {
  if (note.modeScope !== undefined) return !isCoreNote({ modeScope: note.modeScope });
  return modeScopeFromAnchorUrl(note.anchorUrl) !== "core";
}

/** 엔티티 수·내비·짝짓기 우주에서 빠지는 줄 = 의회 투표 결과 ∪ 게임 모드 섹션. 홈은 둘을 다르게
 * 다룬다(의회는 비표시, 모드 섹션은 "기타 변경" 줄) — 그 분기는 호출부가 두 술어를 따로 본다. */
export function isDisplayExcludedNote(
  note: Pick<PatchNoteItem, "entity" | "anchorUrl"> & Partial<Pick<PatchNoteItem, "modeScope">>
): boolean {
  return isExcludedNote(note) || isModeSectionNote(note);
}
