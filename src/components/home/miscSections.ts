// src/components/home/miscSections.ts
// 홈 "기타 변경" 묶음(2026-09-18 라운드6, 사용자 L2). 순수 함수 — 렌더는 MiscChangesSection.tsx.
//
// **무엇을 모으나**: 3티어 정렬의 tier 3(섹션 묶음 — 「버그 수정」·「증강」·「버그 수정 및 편의성 개선」류,
// sectionBundle.ts)과 tier 4(치장 — 홀 오브 레전드·앞으로 나올 스킨·클래식, cosmetic-note.ts). 둘 다
// 관측할 지표가 없는 줄이라 배지·판정문이 원리적으로 없다. 이전엔 이 그룹들이 챔피언 카드와 같은
// 목록에 카드로 섞여 있었고(라운드5까지 "섹션 묶음 위계"로 톤만 낮췄다) 사용자가 "관측변화없음
// 전체항목은 하나의 섹션으로 … Value별로 묶어 섹션이 명확하게 구분되게"를 지시했다.
//
// **카테고리 규칙**(줄 단위 — 「버그 수정 및 편의성 개선」처럼 한 묶음에 두 종류가 섞인다):
//   augment  엔티티가 「증강」(아수라장 증강 — 요약에 "버그"가 있어도 증강)
//   cosmetic `isCosmeticNote`(스킨·크로마·테두리·홀 오브 레전드·클래식 …)
//   bugfix   엔티티나 요약에 "버그"
//   qol      엔티티나 요약에 "편의성" 또는 "개선"
//   other    나머지(챔피언 변경·아트·시스템 사양 업데이트 등)
// 순서는 사용자가 부른 순서(버그 수정 → 편의성 개선 → 신규 스킨) 뒤에 증강·기타.
import type { PatchNoteItem } from "@/pipeline/types";
import { isCosmeticNote } from "@/pipeline/shared/cosmetic-note";
import { isModeSectionNote } from "@/pipeline/shared/excluded-notes";
import type { MatchedStreamGroup } from "./releaseStream";

export type MiscCategory = "bugfix" | "qol" | "cosmetic" | "augment" | "mode" | "other";

export const MISC_CATEGORY_ORDER: readonly MiscCategory[] = ["bugfix", "qol", "cosmetic", "augment", "mode", "other"];

export const MISC_CATEGORY_LABELS: Record<MiscCategory, string> = {
  bugfix: "버그 수정",
  qol: "편의성 개선",
  cosmetic: "신규 스킨·치장",
  augment: "증강",
  mode: "게임 모드(클래식)",
  other: "기타 변경",
};

export function classifyMiscNote(note: PatchNoteItem): MiscCategory {
  if (/증강/.test(note.entity)) return "augment";
  if (isCosmeticNote(note)) return "cosmetic";
  // 클래식 모드 섹션(#patch-classic)의 챔피언 줄(26.18 "피오라" 65줄) — SR 밸런스가 아니라 모드 콘텐츠다.
  // 같은 앵커 아래 「버그 수정」·「시스템 사양」 같은 시스템 줄은 이름 규칙으로 가르므로 챔피언·아이템
  // 섹션으로 파싱된 줄만 여기서 잡는다(라운드6 재판정 보완 1).
  if ((note.section === "champion" || note.section === "item") && isModeSectionNote(note)) return "mode";
  // 「버그 수정 및 편의성 개선」처럼 묶음 이름이 두 종류를 다 말하면 이름은 힌트가 못 된다 — 요약만 본다.
  const mixed = /버그/.test(note.entity) && /편의성|개선/.test(note.entity);
  const text = mixed ? note.summary : `${note.entity} ${note.summary}`;
  if (/버그/.test(text)) return "bugfix";
  if (/편의성|개선/.test(text)) return "qol";
  if (mixed) return "qol"; // 섞인 묶음에서 버그가 아니면 편의성 쪽이다
  return "other";
}

export interface MiscSection {
  category: MiscCategory;
  label: string;
  /** 문서 순서 그대로(그룹 경계를 넘어 합쳐진다). */
  notes: PatchNoteItem[];
}

/** tier 3·4 그룹 → 카테고리별 줄 목록. 빈 카테고리는 내지 않고, 줄은 하나도 잃지 않는다. */
export function buildMiscSections(groups: readonly MatchedStreamGroup[]): MiscSection[] {
  const bucket = new Map<MiscCategory, PatchNoteItem[]>();
  for (const group of groups) {
    for (const note of group.notes) {
      const category = classifyMiscNote(note);
      const list = bucket.get(category);
      if (list) list.push(note);
      else bucket.set(category, [note]);
    }
  }
  return MISC_CATEGORY_ORDER.filter((category) => bucket.has(category)).map((category) => ({
    category,
    label: MISC_CATEGORY_LABELS[category],
    notes: bucket.get(category)!,
  }));
}

/** 공백·구두점을 걷어낸 비교용 키 — "게임 모드(클래식)"과 "게임모드클래식"을 같게 본다. */
function normalizeLabel(text: string): string {
  return text.replace(/[\s·()（）:：,，/-]/g, "");
}

/**
 * 묶음 머리글(엔티티 이름)을 달지 결정한다.
 *
 * **왜 개수로 정하면 안 되나**(2026-09-19 사용자 지적): 이전 규칙은 "한 카테고리에 엔티티가
 * 둘 이상일 때만 머리글"이었다. 의도는 「버그 수정」 카테고리에서 엔티티가 "버그 수정" 하나뿐일 때
 * 같은 말을 두 번 하지 않는 것이었는데, 26.18 「게임 모드(클래식)」은 **피오라 65줄 하나**라
 * 같은 규칙에 걸려 머리글이 사라졌다 — 화면에는 "Q - 찌르기"·"W - 응수"만 남아 **누구의 변경인지
 * 알 수 없었다**(26.17은 엔티티가 19개라 우연히 문제가 안 보였다).
 *
 * 진짜 기준은 개수가 아니라 **그 이름이 카테고리 라벨과 같은 말인가**다. 포함 관계면 중복이므로
 * 숨기고("버그 수정 및 편의성 개선" ⊃ "버그 수정"), 아니면 보여준다(「게임 모드(클래식)」의 "피오라").
 *
 * 2026-09-20 후속: 위의 "피오라 65줄 하나"는 **파서 결함**이기도 했다(클래식 챔피언 12명이 한
 * 블록에 있어 전원이 첫 이름에 귀속됐다 — patchnotes-parser.ts `startsNewEntity`). 그쪽을 고쳐
 * 지금은 엔티티가 12개지만, 이 함수의 규칙은 그대로 옳다 — 개수는 원래 기준이 아니었다.
 */
export function showsEntityHeading(categoryLabel: string, entity: string): boolean {
  const label = normalizeLabel(categoryLabel);
  const name = normalizeLabel(entity);
  if (name.length === 0) return false;
  return !label.includes(name) && !name.includes(label);
}
