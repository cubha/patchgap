// src/pipeline/shared/cosmetic-note.ts
// 치장(cosmetic) 패치노트 항목 판별 — 스킨·크로마·테두리·아이콘처럼 **관측할 지표가 원리적으로
// 없는** 항목을 가려낸다.
//
// **왜 필요한가**(사용자 지적, 2026-09-17): "홀오브리그오브레전드 내용은 일반 패치, 업데이트
// 내용임. 신규 스킨 등에 대한 내용이니 관측 불필요 → 뱃지 제거". 실제로 이 항목들에는
// `관측 보류` 뱃지가 붙어 있었는데, 그 뱃지는 "아직 관측하지 못했다"는 뜻이라 **거짓말에
// 가깝다** — 스킨에는 애초에 측정할 승률·픽률이 없다. 관측할 수 없는 것과 관측하지 않은 것을
// 같은 어휘로 부르면 판정 어휘 전체의 신뢰가 깎인다.
//
// **왜 `stat === null && direction === "unknown"`만으로는 안 되는가**(실측): 그 조건은 26.18
// 노트 181건 중 **84건(46%)**을 잡는데, 그 안에 `증강`(25) · `버그 수정`(11) ·
// `의회 - 투표 1 결과`(34)가 들어 있다. 이들은 지표가 **없는** 게 아니라 **파싱되지 않은**
// 것이라 "관측 보류"가 정확한 서술이다. 그래서 비계량 조건은 **필요조건**으로만 쓰고
// (진짜 밸런스 변경을 실수로 숨기지 않기 위한 안전장치), 치장 증거를 따로 요구한다.
// 그 결과 26.18에서 13건 · 26.17에서 5건 · 26.16에서 6건만 잡힌다(실측, 2026-09-17).
import type { PatchNoteItem } from "../types";

/** 엔티티명 자체가 치장 묶음인 경우 — 그 묶음의 모든 줄이 치장이다. */
const COSMETIC_ENTITY_RE = /스킨|크로마|홀\s*오브\s*레전드|클래식/;

/** 요약문에 드러나는 치장 증거. 게임플레이 수치가 아닌 소유물·표식 어휘만 넣는다.
 *
 * ⚠️ **"와드"는 뺐다** — 26.17 실측에서 오탐이 나왔다: "시야 와드 또는 투명 감지 와드를
 * 설치하면 귀환이 취소되던 버그를 수정" 은 게임플레이 수정인데 이 단어 하나로 치장에 걸렸다.
 * 와드 **스킨**은 어차피 엔티티 규칙(홀 오브 레전드 등)이 잡으므로 잃는 것이 없다. */
const COSMETIC_SUMMARY_RE =
  /스킨|크로마|테두리|아이콘|감정\s*표현|휘장|칭호|정수|번들|프로필|배너|장식|구\s*\d+개/;

/** 홀 오브 레전드 섹션 앵커 — 문구가 바뀌어도 앵커는 안정적이다. */
const COSMETIC_ANCHOR_RE = /hall-of-legends|skins-chromas/;

/**
 * 이 노트가 **관측 대상이 아닌 치장 항목**인가.
 *
 * 비계량(`stat === null && direction === "unknown"`)이 **필요조건**이다 — 수치가 파싱된 줄은
 * 어떤 어휘가 들어 있어도 치장으로 접지 않는다(예: "스킨 효과 피해량 10 ⇒ 12"가 있었다면
 * 그건 밸런스 변경이다).
 */
export function isCosmeticNote(note: PatchNoteItem): boolean {
  if (note.stat !== null) return false;
  if (note.direction !== "unknown") return false;

  if (COSMETIC_ENTITY_RE.test(note.entity)) return true;
  if (COSMETIC_SUMMARY_RE.test(note.summary)) return true;
  if (COSMETIC_ANCHOR_RE.test(note.anchorUrl)) return true;
  return false;
}

/** 엔티티 그룹 전체가 치장인가 — 카드 머리에 뱃지를 붙일지 결정할 때 쓴다. 빈 배열은 false
 * (아무것도 없는 것을 "전부 치장"이라고 말하지 않는다). */
export function isCosmeticGroup(notes: readonly PatchNoteItem[]): boolean {
  return notes.length > 0 && notes.every(isCosmeticNote);
}
