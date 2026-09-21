// ST-3 RED — 수치 변경 ↔ 패치노트 대조. 실측 26.17에서 걸린 두 오탐을 계약으로 못박는다.
import { describe, it, expect } from "vitest";
import { entityMatches, linkNotes, type NoteLike } from "../note-link";

const NOTES_2617: NoteLike[] = [
  // 실측: data/aggregated/notes/26.17.json
  { id: "note:stormrazor", entity: "폭풍갈퀴", skill: null, stat: "공격 속도" },
  { id: "note:wriggle", entity: "리글의 랜턴과 야생의 섬광", skill: null, stat: "아이템 조합식" },
  { id: "note:pendant", entity: "활력증진의 펜던트", skill: null, stat: "조합 가격" },
  { id: "note:nocturne-armor", entity: "녹턴", skill: "기본 능력치", stat: "방어력" },
  { id: "note:aurelion-w", entity: "아우렐리온 솔", skill: "W - 별의 비행", stat: "재사용 대기시간" },
  { id: "note:aurelion-q", entity: "아우렐리온 솔", skill: "Q - 빛의 숨결", stat: "초당 마나 소모량" },
];

describe("entityMatches — 복합 엔티티명", () => {
  it("정확히 같으면 걸린다", () => {
    expect(entityMatches("폭풍갈퀴", "폭풍갈퀴")).toBe(true);
  });

  it("노트가 두 엔티티를 한 줄에 묶어도 각각 걸린다", () => {
    // 이 한 줄이 없으면 리글의 랜턴·야생의 섬광이 잠수함으로 오판된다(2026-09-21 실측).
    expect(entityMatches("리글의 랜턴", "리글의 랜턴과 야생의 섬광")).toBe(true);
    expect(entityMatches("야생의 섬광", "리글의 랜턴과 야생의 섬광")).toBe(true);
  });

  it("무관한 엔티티는 안 걸린다", () => {
    expect(entityMatches("폭풍갈퀴", "녹턴")).toBe(false);
    expect(entityMatches("폭풍갈퀴", null)).toBe(false);
  });
});

describe("linkNotes — 재작업 노트 특례 (REWORK_KEYWORDS 전수)", () => {
  // scope-critic 지적(2026-09-21): 상수에 6개 낱말이 있는데 테스트는 "조합식" 하나만 덮고
  // 있었다. 나머지는 추정이므로 **전부 고정**한다 — 넓으면 잠수함을 놓치고, 좁으면 재작업을
  // 잠수함으로 오판한다. 목록을 늘릴 때 여기가 같이 늘어야 한다.
  const REWORK_PHRASES = ["아이템 조합식", "재작업", "능력 개편", "리워크", "신규 아이템", "삭제"];

  it.each(REWORK_PHRASES)("'%s' 노트는 그 엔티티의 수치 변경 전부를 설명한다", (phrase) => {
    const notes: NoteLike[] = [{ id: "n1", entity: "테스트 아이템", skill: null, stat: phrase }];
    // 필드 낱말이 전혀 안 맞는데도 걸려야 한다 — 그게 이 특례의 요점이다.
    expect(linkNotes({ entityName: "테스트 아이템", fieldKeywords: ["공격력"] }, notes)).toEqual([
      "n1",
    ]);
  });

  it("재작업 낱말이 아니면 필드가 맞아야만 걸린다", () => {
    const notes: NoteLike[] = [{ id: "n1", entity: "테스트 아이템", skill: null, stat: "체력" }];
    expect(linkNotes({ entityName: "테스트 아이템", fieldKeywords: ["공격력"] }, notes)).toEqual([]);
  });

  it("재작업 특례는 스킬 키도 무시한다 — 개편은 스킬 전체를 갈아엎는다", () => {
    const notes: NoteLike[] = [{ id: "n1", entity: "테스트 챔피언", skill: "능력 개편", stat: null }];
    expect(
      linkNotes({ entityName: "테스트 챔피언", fieldKeywords: [], skillKey: "R" }, notes)
    ).toEqual(["n1"]);
  });
});

describe("linkNotes — 필드 단위 대조", () => {
  it("★ 폭풍갈퀴 공격 속도는 공지됐다", () => {
    const ids = linkNotes({ entityName: "폭풍갈퀴", fieldKeywords: ["공격 속도"] }, NOTES_2617);
    expect(ids).toEqual(["note:stormrazor"]);
  });

  it("★ 폭풍갈퀴 가격은 공지되지 않았다 — 26.17의 실제 잠수함 패치", () => {
    // 엔티티는 노트에 있지만 그 줄은 공격 속도만 말한다. 엔티티 단위로만 보면 놓친다.
    const ids = linkNotes({ entityName: "폭풍갈퀴", fieldKeywords: ["가격", "골드"] }, NOTES_2617);
    expect(ids).toEqual([]);
  });

  it("활력증진의 펜던트 가격은 공지됐다 — 같은 패치에서 라이엇이 가격을 공지한 대조군", () => {
    const ids = linkNotes({ entityName: "활력증진의 펜던트", fieldKeywords: ["가격", "골드"] }, NOTES_2617);
    expect(ids).toEqual(["note:pendant"]);
  });

  it("조합식 변경 노트는 그 엔티티의 스탯 변경 전부를 설명한다", () => {
    // 조합식이 바뀌면 스탯이 통째로 갈리는데, 노트는 조합식만 말한다.
    // 이 특례가 없으면 리글의 랜턴이 잠수함으로 오판된다.
    const ids = linkNotes({ entityName: "리글의 랜턴", fieldKeywords: ["공격력"] }, NOTES_2617);
    expect(ids).toEqual(["note:wriggle"]);
  });

  it("기본 능력치는 노트의 상위 표현에 포함된다", () => {
    const ids = linkNotes({ entityName: "녹턴", fieldKeywords: ["방어력"] }, NOTES_2617);
    expect(ids).toEqual(["note:nocturne-armor"]);
  });

  it("스킬 키가 주어지면 같은 스킬의 노트만 걸린다", () => {
    const w = linkNotes(
      { entityName: "아우렐리온 솔", fieldKeywords: ["재사용 대기시간"], skillKey: "W" },
      NOTES_2617
    );
    expect(w).toEqual(["note:aurelion-w"]);
  });

  it("같은 엔티티라도 다른 스킬의 같은 지표는 걸리지 않는다", () => {
    const e = linkNotes(
      { entityName: "아우렐리온 솔", fieldKeywords: ["재사용 대기시간"], skillKey: "E" },
      NOTES_2617
    );
    expect(e).toEqual([]);
  });

  it("키워드가 비면 스킬 일치만으로 공지 — effectBurn은 인덱스 의미를 알 수 없다", () => {
    // DDragon은 effect[1]이 피해량인지 슬로우인지 알려주지 않는다. 그래서 스킬 축 변경은
    // 그 스킬을 언급한 노트가 하나라도 있으면 공지로 본다(보수적으로 틀리는 쪽).
    const ids = linkNotes(
      { entityName: "아우렐리온 솔", fieldKeywords: [], skillKey: "W" },
      NOTES_2617
    );
    expect(ids).toEqual(["note:aurelion-w"]);
  });

  it("키워드가 비어도 스킬이 다르면 안 걸린다", () => {
    expect(
      linkNotes({ entityName: "아우렐리온 솔", fieldKeywords: [], skillKey: "E" }, NOTES_2617)
    ).toEqual([]);
  });

  it("entityMatchSuffices면 엔티티 언급만으로 공지 — 노트가 그 낱말을 뭐라 부르는지 모를 때", () => {
    // TFT 스킬 변수(ability.Damage 등)는 노트가 "구체당 스킬 피해량"처럼 제멋대로 부른다.
    // 낱말 사전을 만들 수 없으므로 엔티티 언급을 알리바이로 받는다 — 보수적으로 덜 찾는 쪽.
    const ids = linkNotes(
      { entityName: "폭풍갈퀴", fieldKeywords: [], entityMatchSuffices: true },
      NOTES_2617
    );
    expect(ids).toEqual(["note:stormrazor"]);
  });

  it("entityMatchSuffices여도 엔티티가 없으면 안 걸린다", () => {
    expect(
      linkNotes({ entityName: "없는엔티티", fieldKeywords: [], entityMatchSuffices: true }, NOTES_2617)
    ).toEqual([]);
  });

  it("노트에 엔티티가 아예 없으면 빈 배열 — 잠수함", () => {
    expect(linkNotes({ entityName: "장로 드래곤", fieldKeywords: ["공격력"] }, NOTES_2617)).toEqual([]);
  });
});
