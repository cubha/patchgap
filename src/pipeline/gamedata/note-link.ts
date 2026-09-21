// src/pipeline/gamedata/note-link.ts
// 원본 수치 변경 ↔ 패치노트 대조. **잠수함 판정이 여기서 난다** — 짝이 없으면 잠수함이다.
//
// 이 파일이 존재하는 이유는 2026-09-21 실측에서 걸린 오탐 두 종이다:
//
// ① **엔티티 단위 대조로는 부족하다.** 26.17 폭풍갈퀴는 노트에 있다 — 그런데 그 줄은
//    `공격 속도: 20% ⇒ 25%`만 말하고 **가격 3000→3200골드는 말하지 않는다**. 엔티티가 언급됐다는
//    이유로 공지 처리하면 이 저장소가 찾으려는 바로 그것을 놓친다. 그래서 **필드 단위**로 본다.
//
// ② **노트 엔티티가 복합일 수 있다.** `"리글의 랜턴과 야생의 섬광"` 한 줄이 아이템 둘을 함께
//    다룬다. 정확 일치로 매칭하면 두 아이템이 **모두** 잠수함으로 오판된다.

/** 대조에 필요한 노트의 최소 모양 — LoL·TFT `PatchNoteItem`과 PUBG 수기 노트가 모두 만족한다. */
export interface NoteLike {
  readonly id: string;
  readonly entity: string | null;
  readonly skill?: string | null;
  readonly stat?: string | null;
}

/**
 * 엔티티가 바뀌면 그에 딸린 수치가 통째로 갈리는데, 노트는 그 사실만 말하고 개별 수치는 적지
 * 않는다(26.17 리글의 랜턴: `"아이템 조합식"` 한 줄, 스탯은 공격력→공격 속도로 교체됐다).
 * 이런 노트는 **그 엔티티의 모든 수치 변경을 설명한 것**으로 본다.
 */
const REWORK_KEYWORDS = ["조합식", "재작업", "개편", "리워크", "신규 아이템", "삭제"] as const;

/** 스킬 키가 노트 문구에 나오는지 — `"W - 별의 비행"`의 W. 한국어 사이의 알파벳이라 경계로 잡는다. */
function mentionsSkill(text: string, skillKey: string): boolean {
  return new RegExp(`(^|[^A-Za-z])${skillKey}([^A-Za-z]|$)`).test(text);
}

/**
 * 엔티티명이 노트 엔티티에 걸리는가.
 *
 * 양방향 포함을 쓴다 — 노트가 `"리글의 랜턴과 야생의 섬광"`처럼 묶을 수도 있고, 반대로 우리
 * 엔티티명이 더 길 수도 있다(게임 데이터의 정식 명칭 vs 노트의 약칭).
 */
export function entityMatches(entityName: string, noteEntity: string | null | undefined): boolean {
  if (!noteEntity) return false;
  const a = entityName.trim();
  const b = noteEntity.trim();
  if (!a || !b) return false;
  return a === b || b.includes(a) || a.includes(b);
}

export interface LinkNotesInput {
  readonly entityName: string;
  /** 이 필드를 가리키는 한국어 낱말들. 어댑터가 준다(`["가격", "골드"]`). */
  readonly fieldKeywords: readonly string[];
  /** 스킬 수치면 그 키(`"Q"`~`"R"`). 주면 **같은 스킬의 노트만** 걸린다. */
  readonly skillKey?: string | null;
}

/**
 * 이 변경을 말한 노트 id 목록. **비어 있으면 잠수함 패치다.**
 *
 * 순서는 입력 노트 순서를 따른다 — 산출물이 실행마다 흔들리면 커밋 diff가 의미를 잃는다.
 */
export function linkNotes(input: LinkNotesInput, notes: readonly NoteLike[]): string[] {
  const out: string[] = [];
  for (const note of notes) {
    if (!entityMatches(input.entityName, note.entity)) continue;
    const text = `${note.skill ?? ""} ${note.stat ?? ""}`.trim();

    // 재작업 노트는 그 엔티티의 수치 변경 전부를 설명한다(위 헤더 ①의 반대 극단).
    if (REWORK_KEYWORDS.some((k) => text.includes(k))) {
      out.push(note.id);
      continue;
    }

    // 스킬 축이 있으면 먼저 스킬이 맞아야 한다 — 같은 엔티티의 다른 스킬 노트가 알리바이가
    // 되어서는 안 된다(아우렐리온 솔 W 노트가 E 변경을 덮어 주면 안 된다).
    if (input.skillKey && !mentionsSkill(text, input.skillKey)) continue;

    // 키워드가 비면 **스킬 일치만으로 공지**다. `effectBurn`은 인덱스의 의미를 DDragon이
    // 알려주지 않아(effect[1]이 피해량인지 슬로우인지 모른다) 필드 낱말을 만들 수 없다.
    // 그 스킬을 언급한 노트가 하나라도 있으면 공지로 본다 — 보수적으로 틀리는 쪽을 고른다.
    if (input.fieldKeywords.length === 0) {
      if (input.skillKey) out.push(note.id);
      continue;
    }
    if (input.fieldKeywords.some((k) => text.includes(k))) out.push(note.id);
  }
  return out;
}
