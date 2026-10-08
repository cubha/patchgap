// ST-3 RED — 수치 변경 ↔ 패치노트 대조. 실측 26.17에서 걸린 두 오탐을 계약으로 못박는다.
import { describe, it, expect } from "vitest";
import {
  entityMatches,
  linkNotes,
  linkPriorNote,
  linkedNotes,
  noteValueMismatch,
  unappliedNoteMismatch,
  type NoteLike,
} from "../note-link";

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

// 2026-09-21 — 카탈로그 보강(CDragon)으로 덩굴정령·어미 부리 줄이 해소되자, **짝이 생겼다는
// 이유만으로 공지 처리**되어 실제 불일치가 화면에서 사라질 상황이 됐다. 오탐이 **보이지 않는**
// 오탐으로 바뀌는 셈이라 지금이 더 나쁘다. 그래서 세 번째 상태를 둔다 — 「공지값 불일치」.
//
// 값 대조는 **노트가 그 필드를 이름으로 말한 경우(`via: "keyword"`)에만** 한다. 나머지 경로
// (재작업·스킬·엔티티 언급)는 노트가 이 수치를 뭐라 부르는지 모른다는 뜻이라 값을 견줄 수 없다.
describe("noteValueMismatch — 공지했는데 값이 다르다", () => {
  const note = (id: string, stat: string, before: string | null, after: string | null): NoteLike => ({
    id,
    entity: "덩굴정령",
    skill: null,
    stat,
    before,
    after,
  });

  const linkOf = (n: NoteLike, keywords: readonly string[]) =>
    linkedNotes({ entityName: "덩굴정령", fieldKeywords: keywords }, [n]);

  it("★ 실측 — 덩굴정령 공격력: 게임은 110→115인데 노트는 115⇒120이라 적었다", () => {
    const linked = linkOf(note("n1", "기본 공격력", "115", "120"), ["공격력"]);
    expect(noteValueMismatch(linked, 110, 115)).toEqual({
      noteId: "n1",
      noteBefore: "115",
      noteAfter: "120",
    });
  });

  it("★ 실측 — 어미 부리: after만 맞고 before가 어긋나도 불일치다", () => {
    const linked = linkOf(note("n2", "기본 공격력", "50", "55"), ["공격력"]);
    expect(noteValueMismatch(linked, 60, 55)?.noteId).toBe("n2");
  });

  it("값이 정확히 같으면 불일치가 아니다", () => {
    const linked = linkOf(note("n3", "기본 공격력", "30", "40"), ["공격력"]);
    expect(noteValueMismatch(linked, 30, 40)).toBeNull();
  });

  it("단위 표기(골드·%)는 값이 아니다 — 4골드 ⇒ 3골드는 4 → 3과 같다", () => {
    const linked = linkOf(note("n4", "가격", "4골드", "3골드"), ["가격"]);
    expect(noteValueMismatch(linked, 4, 3)).toBeNull();
  });

  it("%로 적힌 노트는 비율 값과 견준다 — 20% ⇒ 15%는 0.2 → 0.15와 같다", () => {
    const linked = linkOf(note("n5", "내구력", "20%", "15%"), ["내구력"]);
    expect(noteValueMismatch(linked, 0.2, 0.15)).toBeNull();
  });

  it("★ %인데 게임 값도 퍼센트 단위면 그것도 같다 — 크기로 단위를 추측하지 않는다", () => {
    // 배수형 필드(`critMultiplier` 1.4)를 노트가 「140%」로 적을 수 있다. "1 이하면 비율"로
    // 단위를 추측하면 이 짝이 거짓 불일치로 찍힌다 — 「공지값 불일치」는 *패치노트가 틀렸다*는
    // 주장이라 잠수함보다 강한 발언이고, 애매하면 같다고 보는 쪽이 옳다.
    const linked = linkOf(note("n5b", "치명타 배수", "140%", "150%"), ["치명타"]);
    expect(noteValueMismatch(linked, 140, 150)).toBeNull();
  });

  it("★ 레벨별 배열은 견주지 않는다 — 어느 레벨을 대표로 삼을지는 이 층이 정할 문제가 아니다", () => {
    const linked = linkOf(note("n6", "스킬 피해량", "공격력 20/30/48", "공격력 22/33/48"), ["피해량"]);
    expect(noteValueMismatch(linked, 20, 22)).toBeNull();
  });

  it("★ 숫자가 둘 이상 섞인 표현도 견주지 않는다 — 「15 + 주문력 30%」", () => {
    const linked = linkOf(note("n7", "방어력 무시", "15 + 주문력 30%", "20 + 주문력 25%"), ["방어력"]);
    expect(noteValueMismatch(linked, 15, 20)).toBeNull();
  });

  it("★ 값이 맞는 노트가 하나라도 있으면 불일치가 아니다 — 같은 필드를 두 줄이 말할 수 있다", () => {
    const linked = linkedNotes({ entityName: "덩굴정령", fieldKeywords: ["공격력"] }, [
      note("n8", "기본 공격력", "999", "888"),
      note("n9", "기본 공격력", "110", "115"),
    ]);
    expect(noteValueMismatch(linked, 110, 115)).toBeNull();
  });

  it("★ 엔티티 언급만으로 걸린 노트는 값을 견주지 않는다 — 그 노트가 이 수치를 말한 게 아니다", () => {
    const linked = linkedNotes(
      { entityName: "덩굴정령", fieldKeywords: [], entityMatchSuffices: true },
      [note("n10", "기본 공격력", "115", "120")]
    );
    expect(linked.map((l) => l.via)).toEqual(["entity"]);
    expect(noteValueMismatch(linked, 110, 115)).toBeNull();
  });

  it("★ 재작업 노트도 값을 견주지 않는다 — 개편은 수치 전부를 갈아엎는다", () => {
    const linked = linkOf(note("n11", "아이템 조합식", "1", "2"), ["공격력"]);
    expect(linked.map((l) => l.via)).toEqual(["rework"]);
    expect(noteValueMismatch(linked, 110, 115)).toBeNull();
  });

  it("게임 값이 배열 문자열이면 견주지 않는다", () => {
    const linked = linkOf(note("n12", "기본 공격력", "115", "120"), ["공격력"]);
    expect(noteValueMismatch(linked, "110/120", "115/125")).toBeNull();
  });

  it("linkNotes는 linkedNotes의 id 목록과 같다 — 두 경로가 갈라지면 판정이 갈라진다", () => {
    const input = { entityName: "폭풍갈퀴", fieldKeywords: ["공격 속도"] };
    expect(linkNotes(input, NOTES_2617)).toEqual(linkedNotes(input, NOTES_2617).map((l) => l.note.id));
  });
});

// ST-01(2026-10-08 site-review lol-S1): 엘리스 패시브 「기본 지속 효과 적중 시 마법 피해량 12/22/32/42 ⇒ 14/24/34/44」가
// DDragon에서는 **R 스펠의 effect**에 들어 있다. 슬롯(Q~R)으로만 맞추면 "기본 지속 효과" 문구에 R이 없어 잠수함이 된다 —
// 같은 화면 위 구획이 공지라고 말한 값을 아래 구획이 잠수함이라고 말했다. 노트가 **그 값 자체**를 적었으면 어느 슬롯이든 공지다.
describe("linkedNotes — 값 토큰 경로(ST-01)", () => {
  const elisePassive: NoteLike = {
    id: "note:elise-passive",
    entity: "엘리스",
    skill: "기본 지속 효과 - 거미 여왕",
    stat: "기본 지속 효과 적중 시 마법 피해량",
    before: "12/22/32/42",
    after: "14/24/34/44",
  };
  const eliseW: NoteLike = {
    id: "note:elise-w",
    entity: "엘리스",
    skill: "W - 광란의 질주",
    stat: "추가 공격 속도",
    before: "60/75/90/105/120%",
    after: "70/85/100/115/130%",
  };

  it("★ 노트가 적은 값과 변경 값이 토큰열로 같으면 스킬 키가 달라도 `value` 경로로 걸린다", () => {
    const linked = linkedNotes(
      { entityName: "엘리스", fieldKeywords: [], skillKey: "R", value: { before: "12/22/32/42", after: "14/24/34/44" } },
      [elisePassive, eliseW]
    );
    expect(linked.map((l) => [l.note.id, l.via])).toEqual([["note:elise-passive", "value"]]);
  });

  it("`%`·쉼표·공백 표기 차이는 무시한다 — 60/75/90/105/120% ↔ 60/75/90/105/120", () => {
    const linked = linkedNotes(
      { entityName: "엘리스", fieldKeywords: [], skillKey: "E", value: { before: "60/75/90/105/120", after: "70/85/100/115/130" } },
      [eliseW]
    );
    expect(linked.map((l) => l.via)).toEqual(["value"]);
  });

  it("★ 단일 숫자는 값 경로로 걸지 않는다 — 「공격력 65 ⇒ 60」이 「방어력 65→60」의 알리바이가 되면 안 된다", () => {
    const ad: NoteLike = { id: "n-ad", entity: "마스터 이", skill: null, stat: "기본 공격력", before: "65", after: "60" };
    expect(linkedNotes({ entityName: "마스터 이", fieldKeywords: ["방어력"], value: { before: 65, after: 60 } }, [ad])).toEqual([]);
  });

  it("토큰 수가 같아도 값이 하나라도 다르면 안 걸린다", () => {
    expect(
      linkedNotes(
        { entityName: "엘리스", fieldKeywords: [], skillKey: "R", value: { before: "12/22/32/42", after: "14/24/34/45" } },
        [elisePassive]
      )
    ).toEqual([]);
  });

  it("엔티티가 다르면 값이 같아도 안 걸린다", () => {
    expect(
      linkedNotes(
        { entityName: "카직스", fieldKeywords: [], skillKey: "R", value: { before: "12/22/32/42", after: "14/24/34/44" } },
        [elisePassive]
      )
    ).toEqual([]);
  });

  it("값 경로로 걸린 노트는 값이 같다는 뜻이므로 불일치 후보가 아니다", () => {
    const linked = linkedNotes(
      { entityName: "엘리스", fieldKeywords: [], skillKey: "R", value: { before: "12/22/32/42", after: "14/24/34/44" } },
      [elisePassive]
    );
    expect(noteValueMismatch(linked, "12/22/32/42", "14/24/34/44")).toBeNull();
  });
});

// ST-02: 직전 패치 노트가 **그 값으로** 바꾼다고 이미 말했으면 잠수함이 아니라 「지연 반영」이다(TFT 렝가·덩굴정령 실측).
describe("linkPriorNote — 직전 노트의 지연 반영(ST-02)", () => {
  const rengar182: NoteLike = { id: "n:18.2:rengar", entity: "렝가", skill: null, stat: "기본 공격 속도", before: "0.8", after: "0.75" };
  const yi182: NoteLike = { id: "n:18.2:yi", entity: "마스터 이", skill: null, stat: "공격력 형태 기본 공격력", before: "65", after: "60" };
  const prior = [{ patch: "18.2", notes: [rengar182, yi182] }];

  it("★ keyword 경로로 걸리고 노트의 after가 변경의 after와 같으면 그 노트가 지연 반영의 출처다", () => {
    expect(
      linkPriorNote({ entityName: "렝가", fieldKeywords: ["공격 속도"], value: { before: 0.8, after: 0.75 } }, prior)
    ).toEqual({ noteId: "n:18.2:rengar", patch: "18.2" });
  });

  it("★ 노트의 after에 못 미치면(65 → 62, 노트 60) 지연 반영이 아니다 — null", () => {
    expect(linkPriorNote({ entityName: "마스터 이", fieldKeywords: ["공격력"], value: { before: 65, after: 62 } }, prior)).toBeNull();
  });

  it("노트의 after에 도달하면(62 → 60) 출발점이 노트와 달라도 지연 반영이다 — 단계적 반영", () => {
    expect(
      linkPriorNote({ entityName: "마스터 이", fieldKeywords: ["공격력"], value: { before: 62, after: 60 } }, prior)
    ).toEqual({ noteId: "n:18.2:yi", patch: "18.2" });
  });

  it("값 토큰 경로(레벨 배열)로 걸린 노트도 출처가 된다", () => {
    const passive: NoteLike = { id: "n:p", entity: "엘리스", skill: "기본 지속 효과", stat: "피해량", before: "12/22/32/42", after: "14/24/34/44" };
    expect(
      linkPriorNote(
        { entityName: "엘리스", fieldKeywords: [], skillKey: "R", value: { before: "12/22/32/42", after: "14/24/34/44" } },
        [{ patch: "26.18", notes: [passive] }]
      )
    ).toEqual({ noteId: "n:p", patch: "26.18" });
  });

  it("엔티티 언급·재작업 경로는 값을 말한 것이 아니라 출처가 못 된다", () => {
    const rework: NoteLike = { id: "n:rw", entity: "렝가", skill: "능력 개편", stat: null };
    expect(linkPriorNote({ entityName: "렝가", fieldKeywords: ["공격 속도"], value: { before: 0.8, after: 0.75 } }, [{ patch: "18.2", notes: [rework] }])).toBeNull();
  });

  it("여러 패치를 주면 **앞에 준 것**(최근)부터 찾는다", () => {
    const older: NoteLike = { id: "n:18.1:rengar", entity: "렝가", skill: null, stat: "기본 공격 속도", before: "0.85", after: "0.75" };
    const found = linkPriorNote(
      { entityName: "렝가", fieldKeywords: ["공격 속도"], value: { before: 0.8, after: 0.75 } },
      [{ patch: "18.2", notes: [rengar182] }, { patch: "18.1", notes: [older] }]
    );
    expect(found?.patch).toBe("18.2");
  });

  it("a/b 성분(마나 조정 시작/최대)은 성분 번호로 견준다", () => {
    const mana: NoteLike = { id: "n:mk", entity: "마오카이", skill: null, stat: "마나 조정", before: "40/100", after: "30/100" };
    expect(
      linkPriorNote({ entityName: "마오카이", fieldKeywords: ["마나"], value: { before: 90, after: 100 } }, [{ patch: "18.2", notes: [mana] }], 1)
    ).toEqual({ noteId: "n:mk", patch: "18.2" });
    expect(
      linkPriorNote({ entityName: "마오카이", fieldKeywords: ["마나"], value: { before: 90, after: 95 } }, [{ patch: "18.2", notes: [mana] }], 1)
    ).toBeNull();
  });
});

// ST-03(site-review tft-S4): 노트가 「0.8 ⇒ 0.75」라 했는데 게임 파일이 **그대로 0.8**이면 변경 행이 없어 화면 어디에도
// 안 나온다 — 같은 상황인 덩굴정령(110→115 vs 노트 115⇒120)은 「공지값 불일치」로 보이는데 렝가만 조용했다.
// 안 바뀐 필드도 노트의 출발값과 같으면 「공지값 미반영」이다.
describe("unappliedNoteMismatch — 공지됐는데 게임 파일이 안 바뀜(ST-03)", () => {
  const rengar: NoteLike = { id: "n:rengar", entity: "렝가", skill: null, stat: "기본 공격 속도", before: "0.8", after: "0.75" };
  const link = (n: NoteLike, keywords = ["공격 속도"]) => linkedNotes({ entityName: "렝가", fieldKeywords: keywords }, [n]);

  it("★ 현재값이 노트의 before와 같고 after와 다르면 미반영이다", () => {
    expect(unappliedNoteMismatch(link(rengar), 0.8)).toEqual({
      noteId: "n:rengar",
      noteBefore: "0.8",
      noteAfter: "0.75",
      unapplied: true,
    });
  });

  it("현재값이 노트의 after와 같으면 이미 반영된 것 — null", () => {
    expect(unappliedNoteMismatch(link(rengar), 0.75)).toBeNull();
  });

  it("현재값이 노트의 before와도 다르면 이 노트가 이 필드를 말한 게 아닐 수 있다 — null(보수적)", () => {
    expect(unappliedNoteMismatch(link(rengar), 0.9)).toBeNull();
  });

  it("keyword 경로가 아니면 값을 견주지 않는다", () => {
    const linked = linkedNotes({ entityName: "렝가", fieldKeywords: [], entityMatchSuffices: true }, [rengar]);
    expect(unappliedNoteMismatch(linked, 0.8)).toBeNull();
  });

  it("값이 맞는(이미 반영된) 노트가 하나라도 있으면 미반영이 아니다", () => {
    const applied: NoteLike = { id: "n:applied", entity: "렝가", skill: null, stat: "기본 공격 속도", before: "0.75", after: "0.8" };
    const linked = linkedNotes({ entityName: "렝가", fieldKeywords: ["공격 속도"] }, [rengar, applied]);
    expect(unappliedNoteMismatch(linked, 0.8)).toBeNull();
  });

  it("★ 낱말이 섞인 표기(「체력 0% ⇒ 체력 5%」)는 견주지 않는다 — 그 0은 기본 치명타 0이 아니다(26.17 트린다미어 실측)", () => {
    const passive: NoteLike = { id: "n:tryn", entity: "트린다미어", skill: null, stat: "기본 치명타", before: "체력 0%", after: "체력 5%" };
    expect(unappliedNoteMismatch(linkedNotes({ entityName: "트린다미어", fieldKeywords: ["치명타"] }, [passive]), 0)).toBeNull();
  });

  it("★ `%` 노트는 비율형 값(≤1)에만 — 「공격력 40% ⇒ 35%」가 기본 공격력 40에 걸리면 안 된다(18.3 럭스 실측)", () => {
    const ratio: NoteLike = { id: "n:lux", entity: "럭스", skill: null, stat: "공격력", before: "40%", after: "35%" };
    const linked = linkedNotes({ entityName: "럭스", fieldKeywords: ["공격력"] }, [ratio]);
    expect(unappliedNoteMismatch(linked, 40)).toBeNull();
    // 반대로 「공격 속도 0.7% ⇒ 0.75%」(노트가 %를 잘못 붙인 실측)는 0.7에 걸린다.
    const as: NoteLike = { id: "n:varus", entity: "바루스", skill: null, stat: "공격 속도", before: "0.7%", after: "0.75%" };
    expect(unappliedNoteMismatch(linkedNotes({ entityName: "바루스", fieldKeywords: ["공격 속도"] }, [as]), 0.7)).toMatchObject({ unapplied: true });
  });

  it("a/b 성분은 성분 번호로 견준다 · 중간 패치 표식을 단다", () => {
    const mana: NoteLike = {
      id: "n:mk", entity: "마오카이", skill: null, stat: "마나 조정", before: "40/100", after: "30/100",
      anchorUrl: "https://x/#patch-midpatch-updates",
    };
    const linked = linkedNotes({ entityName: "마오카이", fieldKeywords: ["마나"] }, [mana]);
    expect(unappliedNoteMismatch(linked, 40, 0)).toMatchObject({ noteBefore: "40", noteAfter: "30", unapplied: true, midpatch: true });
    expect(unappliedNoteMismatch(linked, 100, 1)).toBeNull();
  });
});

// 이월 R9: TFT 「마나 조정 40/100 ⇒ 30/100」은 (시작/최대) 두 값이다 — 성분 번호로 골라 견준다.
describe("noteValueMismatch — a/b 성분 대조(R9)", () => {
  const mana = (anchorUrl?: string): NoteLike => ({
    id: "m1", entity: "마오카이", skill: null, stat: "마나 조정", before: "40/100", after: "30/100",
    ...(anchorUrl ? { anchorUrl } : {}),
  });
  const link = (n: NoteLike) => linkedNotes({ entityName: "마오카이", fieldKeywords: ["마나"] }, [n]);

  it("성분 1(최대)이 어긋나면 그 성분 값으로 불일치를 말한다", () => {
    expect(noteValueMismatch(link(mana()), 100, 90, 1)).toEqual({ noteId: "m1", noteBefore: "100", noteAfter: "100" });
  });
  it("성분 0(시작)이 맞으면 불일치가 아니다", () => {
    expect(noteValueMismatch(link(mana()), 40, 30, 0)).toBeNull();
  });
  it("성분을 안 주면 a/b는 여전히 견주지 않는다(레벨 배열과 같은 이유)", () => {
    expect(noteValueMismatch(link(mana()), 100, 90)).toBeNull();
  });
  it("중간 패치 절의 노트면 midpatch 표식을 붙인다", () => {
    expect(noteValueMismatch(link(mana("https://x/#patch-midpatch-updates")), 100, 90, 1)).toMatchObject({ midpatch: true });
  });
});
