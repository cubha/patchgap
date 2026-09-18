// src/pipeline/shared/notes-count.ts
// 패치노트 항목(PatchNoteItem[]) → "서로 다른 엔티티가 몇 개 언급됐는지" 세는 공용 순수 함수.
// 홈 헤드라인("패치노트는 N개 엔티티를 말했고")·대조표 커버리지·디스코드 브리핑·방법론 페이지가
// 전부 이 규칙을 공유해야 화면 간 숫자가 일치한다(2026-09-05 리팩토링 — 기존에 home/logic.ts·
// scripts/run-notify.ts 두 곳에 동일 로직이 따로 구현돼 있었다).

import type { PatchNoteItem } from "../types";
import { isExcludedNote } from "./excluded-notes";

/** 챔피언·아이템 노트만 "엔티티"로 센다(시스템/기타 제외) — entity-match.ts 블로킹 대상 정의와
 * 동일. */
const ENTITY_NOTE_SECTIONS: ReadonlySet<PatchNoteItem["section"]> = new Set(["champion", "item"]);

/**
 * section이 champion|item인 항목을 `${section}:${entity}` 키로 중복 제거해 몇 개의 서로 다른
 * 엔티티가 언급됐는지 센다(예: 아우렐리온 솔 스킬 변경 2줄 = 노트 항목 2건이지만 엔티티는 1개).
 * section을 키에 포함하는 이유는 챔피언명과 아이템명이 우연히 같은 문자열일 가능성을 배제하기
 * 위함(실제로 아직 충돌 사례는 없다 — 실측).
 */
export function countRelevantNoteEntities(items: readonly PatchNoteItem[]): number {
  const keys = new Set<string>();
  for (const item of items) {
    if (!ENTITY_NOTE_SECTIONS.has(item.section)) continue;
    // 2026-09-18 라운드6(L1): 의회 투표 결과 묶음은 section=champion으로 파싱돼 있지만 엔티티가 아니다 —
    // 홈 스트림이 제외하는 것과 같은 술어(excluded-notes.ts)로 세지 않는다(홈·방법론·디스코드 정합).
    if (isExcludedNote(item)) continue;
    keys.add(`${item.section}:${item.entity}`);
  }
  return keys.size;
}
