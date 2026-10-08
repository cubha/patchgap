// ST-10 RED — TFT 어댑터. 실측(2026-09-21) 32건을 회귀로 고정한다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { diffTft, type CdragonSnapshot } from "../tft";
import { isSubmarineChange } from "../types";
import type { NoteLike } from "../note-link";

function snapshot(version: string): CdragonSnapshot {
  return {
    version,
    ...(JSON.parse(readFileSync(`data/cdragon/${version}/tft.json`, "utf8")) as Omit<
      CdragonSnapshot,
      "version"
    >),
  };
}

function notes(patch: string): NoteLike[] {
  return (
    JSON.parse(readFileSync(`data/aggregated/tft/notes-${patch}.json`, "utf8")) as {
      items: NoteLike[];
    }
  ).items;
}

describe("diffTft — 18.1 → 18.2 회귀 (실측 고정)", () => {
  const changes = diffTft(snapshot("16.17"), snapshot("16.18"), notes("18.2"), "18.2");
  const submarines = changes.filter(isSubmarineChange);

  it("수치 변경을 검출한다", () => {
    expect(changes.length).toBeGreaterThan(0);
  });

  it("★ 장로 드래곤 공격력 110 → 125가 잠수함으로 잡힌다", () => {
    const found = submarines.find(
      (c) => c.entityName === "장로 드래곤" && c.fieldPath === "stats.damage"
    );
    expect(found).toBeDefined();
    expect([found!.before, found!.after]).toEqual([110, 125]);
    expect(found!.relChange).toBeCloseTo(15 / 110, 6);
  });

  it("★ 조약돌·아무무도 잠수함에 들어 있다", () => {
    const names = new Set(submarines.map((c) => c.entityName));
    expect(names.has("조약돌")).toBe(true);
    expect(names.has("아무무")).toBe(true);
  });

  it("유닛과 아이템을 모두 본다", () => {
    const types = new Set(submarines.map((c) => c.entityType));
    expect(types.has("unit")).toBe(true);
    expect(types.has("item")).toBe(true);
  });

  it("★ 엔티티가 노트에 있어도 그 줄이 다른 수치를 말하면 잠수함이다", () => {
    // 폭풍갈퀴와 같은 패턴 — 이것이 필드 단위 대조의 존재 이유다.
    // 카직스 노트는 "기본 공격력 30→40"만 말하는데 체력 850→950이 바뀌었다.
    const kha = submarines.find(
      (c) => c.entityName === "카직스" && c.fieldPath === "stats.hp"
    );
    expect(kha).toBeDefined();
    expect([kha!.before, kha!.after]).toEqual([850, 950]);

    // 마스터 이 노트는 "기본 공격력 65→60"인데 방어력 60→55가 바뀌었다.
    const yi = submarines.find(
      (c) => c.entityName === "마스터 이" && c.fieldPath === "stats.armor"
    );
    expect(yi).toBeDefined();
    expect([yi!.before, yi!.after]).toEqual([60, 55]);
  });

  // **기준선 갱신 2회(2026-09-21)** — 둘 다 판정이 *더 정확해져서* 줄었다. 테스트를 통과시키려고
  // 숫자를 낮춘 것이 아니다. 근거는 전부 `docs/plan/VERIFY-tft-submarine-2026-09-21.md`.
  //   37 → 33 : 아이템 효과 짝짓기가 CDragon **영문 키**를 한국어 노트에서 찾고 있었다.
  //             오탐 4건(금빛 운명+·프리즘 운명+ 골드, 남작의 소굴 능력치, 황금 드래곤 내구력).
  //   33 → 31 : 노트 카탈로그를 CDragon으로 보강해 미해소가 60 → 16줄로 줄었고, 덩굴정령·
  //             어미 부리 공격력 2건이 **잠수함이 아니라 「값 불일치」**임이 드러났다.
  //             이 둘은 사라진 것이 아니라 아래 `noteMismatch` 축으로 옮겨갔다.
  it("18.1 → 18.2 잠수함은 31건이다 (유닛 17 · 아이템 14)", () => {
    expect(submarines).toHaveLength(31);
    expect(submarines.filter((c) => c.entityType === "unit")).toHaveLength(17);
    expect(submarines.filter((c) => c.entityType === "item")).toHaveLength(14);
  });

  it("★ 대상 수와 값 수는 다르다 — 화면은 대상 수로 말한다", () => {
    const entities = new Set(submarines.map((c) => `${c.entityType}:${c.entityKey}`));
    expect(entities.size).toBe(25);
    expect(submarines.length).toBeGreaterThan(entities.size);
  });

  // 카탈로그 보강의 **진짜 값**은 미해소 숫자가 아니라 이 둘이다. 노트가 같은 항목을 말했는데
  // 값이 다르다 — 잠수함으로 세면 틀리고, 그냥 공지로 처리하면 **화면에서 사라진다**.
  // ST-03(2026-10-08): 「공지값 미반영」(노트는 바꾼다고 했는데 파일이 그대로)은 불일치 축의 새 갈래다 — 아래 목록은
  // **값이 바뀐** 불일치만 센다. 미반영은 그 다음 describe가 고정한다.
  it("★ 덩굴정령·어미 부리는 잠수함이 아니라 「값 불일치」다", () => {
    const mismatches = changes.filter((c) => c.noteMismatch && !c.noteMismatch.unapplied);
    // 2026-09-28 명세 변경(이월 R9): 「마나 조정 a/b」를 성분별로 견주면서 마오카이 최대 마나(게임 100→90, 노트
    // 최종 100 ⇒ 100)가 중간 패치 불일치로 들어왔다 — 아래 「마나 조정 a/b 대조와 중간 패치(R9)」 참고.
    expect(mismatches.map((c) => `${c.entityName} ${c.field}`)).toEqual([
      "마오카이 최대 마나",
      "덩굴정령 공격력",
      "어미 부리 공격력",
    ]);

    const bramble = mismatches.find((c) => c.entityName === "덩굴정령")!;
    expect([bramble.before, bramble.after]).toEqual([110, 115]);
    expect([bramble.noteMismatch!.noteBefore, bramble.noteMismatch!.noteAfter]).toEqual(["115", "120"]);

    // 잠수함과 배타적이다 — 짝이 있어야 불일치가 성립한다.
    expect(mismatches.every((c) => c.matchedNoteIds.length > 0)).toBe(true);
    expect(submarines.some((c) => c.noteMismatch)).toBe(false);
  });

  it("부동소수점 잡음은 변경이 아니다 — 0.039999961 → 0.039999962 같은 것", () => {
    // CDragon은 float32를 그대로 낸다. 의미 없는 끝자리 차이를 수치 변경으로 읽으면
    // 잠수함이 수십 건 허위로 생긴다.
    const a: CdragonSnapshot = {
      version: "a",
      set: "TFTSet18",
      units: { U: { name: "테스트", cost: 1, stats: { damage: 0.039999961853027344 }, ability: {} } },
      items: {},
    };
    const b: CdragonSnapshot = {
      version: "b",
      set: "TFTSet18",
      units: { U: { name: "테스트", cost: 1, stats: { damage: 0.03999996185302735 }, ability: {} } },
      items: {},
    };
    expect(diffTft(a, b, [], "18.2")).toEqual([]);
  });
});

// 2026-09-21 사용자 지적("건수가 동일대상의 여러항목으로 과다계상된건아닌지 확인해봐")으로
// 패치노트 원문을 전수 대조한 결과 **명백한 오탐 4건**이 나왔다. 원인은 짝짓기 검색어로
// CDragon **영문 키**(`Gold`·`Stats`)를 그대로 넘긴 것 — 노트는 한국어(「골드 제공」·「능력치
// 부여」)라 영원히 못 맞춘다. 유닛 스킬 변수는 같은 문제를 이미 `entityMatchSuffices`로
// 피하고 있었는데 아이템 효과에는 안 걸려 있었다.
describe("diffTft — 아이템 효과는 한국어 낱말로 노트를 찾는다", () => {
  const changes = diffTft(snapshot("16.17"), snapshot("16.18"), notes("18.2"), "18.2");
  const submarines = changes.filter(isSubmarineChange);
  const sub = (name: string, path: string) =>
    submarines.find((c) => c.entityName === name && c.fieldPath === path);
  const any = (name: string, path: string) =>
    changes.find((c) => c.entityName === name && c.fieldPath === path);

  it.each([
    ["금빛 운명+", "effects.Gold", "골드 제공: 6골드 ⇒ 5골드"],
    ["프리즘 운명+", "effects.Gold", "골드 제공: 10골드 ⇒ 7골드"],
    ["남작의 소굴", "effects.Stats", "능력치 부여: 5% ⇒ 4%"],
    ["황금 드래곤", "effects.BonusDurability", "내구력: 20% ⇒ 15%"],
  ])("★ %s %s — 노트가 「%s」로 공지했으므로 잠수함이 아니다", (name, path) => {
    expect(any(name, path)).toBeDefined();
    expect(sub(name, path)).toBeUndefined();
  });

  it("★ 같은 엔티티라도 노트가 말하지 않은 효과는 그대로 잠수함이다", () => {
    // 황금 드래곤 노트는 「내구력」만 말했다 — 추가 체력 700 → 600은 여전히 미공지다.
    expect(sub("황금 드래곤", "effects.BonusHealth")).toBeDefined();
  });

  it("효과 이름을 한국어로 표시한다 — 화면에 `효과 ASMultiplier`가 나가지 않는다", () => {
    const c = any("후방의 핵심", "effects.ASMultiplier");
    expect(c).toBeDefined();
    expect(c!.field).toBe("효과 공격 속도");
  });

  it("사전에 없는 키는 낱말을 지어내지 않고 원문 키를 쓴다", () => {
    for (const c of changes) {
      if (!c.fieldPath.startsWith("effects.")) continue;
      expect(c.field.startsWith("효과 ")).toBe(true);
    }
  });
});

// ST-03(2026-10-08 site-review tft-S4): 18.2 노트 「렝가 기본 공격 속도 0.8 ⇒ 0.75」·「마스터 이 공격력 형태 기본 공격력
// 65 ⇒ 60」은 CDragon 16.18에 실리지 않았다(둘 다 그대로). 변경 행이 없으니 화면 어디에도 안 나왔고, 같은 상황의
// 덩굴정령만 「공지값 불일치」로 보였다. 안 바뀐 필드도 노트의 출발값과 같으면 「공지값 미반영」 행을 낸다.
describe("diffTft — 공지값 미반영(ST-03)", () => {
  const changes = diffTft(snapshot("16.17"), snapshot("16.18"), notes("18.2"), "18.2");
  const unapplied = changes.filter((c) => c.noteMismatch?.unapplied);
  const of = (name: string, path: string) => unapplied.find((c) => c.entityName === name && c.fieldPath === path);

  it("★ 렝가 공격 속도 — 노트 0.8 ⇒ 0.75, 파일 0.8 그대로", () => {
    const rengar = of("렝가", "stats.attackSpeed")!;
    expect(rengar).toBeDefined();
    expect(rengar.before).toBe(rengar.after);
    expect(rengar.matchedNoteIds).toContain("note:tft:18.2:champion:렝가:4a189382");
    expect(rengar.noteMismatch).toMatchObject({ noteBefore: "0.8", noteAfter: "0.75", unapplied: true });
    expect(isSubmarineChange(rengar)).toBe(false);
  });

  it("★ 마스터 이 공격력 — 노트 65 ⇒ 60, 파일 65 그대로(AD 형태)", () => {
    const yi = unapplied.filter((c) => c.entityName === "마스터 이" && c.fieldPath === "stats.damage");
    expect(yi.length).toBeGreaterThan(0);
    for (const c of yi) expect(c.noteMismatch).toMatchObject({ noteBefore: "65", noteAfter: "60", unapplied: true });
  });

  it("미반영 행은 잠수함 수를 바꾸지 않는다 — 31건 그대로", () => {
    expect(changes.filter(isSubmarineChange)).toHaveLength(31);
  });

  it("값이 바뀐 불일치(덩굴정령 110→115)에는 unapplied 표식이 없다", () => {
    const bramble = changes.find((c) => c.entityName === "덩굴정령" && c.fieldPath === "stats.damage")!;
    expect(bramble.noteMismatch?.unapplied).toBeUndefined();
  });
});

// ST-02(2026-10-08 site-review tft-S1~S3): 18.2 노트가 「렝가 기본 공격 속도 0.8 ⇒ 0.75」·「덩굴정령 공격력 115 ⇒ 120」을
// 말했는데 CDragon 16.18(18.2)엔 안 실렸고 16.19(18.3)에서야 바뀌었다. 현재 쌍 노트만 보면 "18.3 노트에 없다 → 잠수함"이
// 되는데, 같은 사이트의 18.1→18.2 상세는 그 값을 공지로 보여 준다 — 화면이 스스로를 반박했다. 직전 노트들이 **그 값으로**
// 바꾼다고 이미 말했으면 잠수함이 아니라 「지연 반영」이다. 아이템 추출 4→3처럼 어느 노트도 말하지 않은 것만 잠수함으로 남는다.
describe("diffTft — 직전 노트 대조 → 지연 반영(ST-02)", () => {
  const prior = (...patches: string[]) => patches.map((patch) => ({ patch, notes: notes(patch) }));

  describe("18.2 → 18.3 (CDragon 16.18 → 16.19)", () => {
    const changes = diffTft(snapshot("16.18"), snapshot("16.19"), notes("18.3"), "18.3", prior("18.2"));
    const of = (name: string, path: string) => changes.find((c) => c.entityName === name && c.fieldPath === path);

    it("★ 렝가 공격 속도 0.8 → 0.75는 18.2 노트가 공지한 값 — 지연 반영, 잠수함 아님", () => {
      const rengar = of("렝가", "stats.attackSpeed")!;
      expect(rengar).toBeDefined();
      expect(rengar.matchedNoteIds).toEqual([]);
      expect(rengar.priorNote).toEqual({ noteId: "note:tft:18.2:champion:렝가:4a189382", patch: "18.2" });
      expect(isSubmarineChange(rengar)).toBe(false);
    });

    it("★ 덩굴정령 공격력 115 → 120도 18.2 노트(115 ⇒ 120)의 지연 반영이다", () => {
      const bramble = of("덩굴정령", "stats.damage")!;
      expect(bramble.priorNote?.patch).toBe("18.2");
      expect(isSubmarineChange(bramble)).toBe(false);
    });

    it("★ 마스터 이 공격력 65 → 62는 18.2 노트(65 ⇒ 60)에 **못 미친다** — 여전히 잠수함", () => {
      const yi = of("마스터 이", "stats.damage")!;
      expect(yi.priorNote).toBeUndefined();
      expect(isSubmarineChange(yi)).toBe(true);
    });

    it("★ 잠수함은 2건으로 준다 — 마스터 이 공격력 · 아이템 추출 조합 아이템 수", () => {
      const submarines = changes.filter(isSubmarineChange);
      expect(submarines.map((c) => `${c.entityName} ${c.field}`).sort()).toEqual(
        ["마스터 이 공격력", "아이템 추출 효과 조합 아이템 수"].sort()
      );
    });

    it("직전 노트를 안 주면 종전처럼 4건 전부 잠수함이다 — 이 테스트가 바뀐 명세의 분모", () => {
      const legacy = diffTft(snapshot("16.18"), snapshot("16.19"), notes("18.3"), "18.3");
      expect(legacy.filter(isSubmarineChange)).toHaveLength(4);
    });
  });

  describe("18.3 → 18.4 (CDragon 16.19 → 16.20) — 두 패치 전 노트까지 본다", () => {
    const changes = diffTft(snapshot("16.19"), snapshot("16.20"), notes("18.4"), "18.4", prior("18.3", "18.2"));
    const of = (name: string, path: string) => changes.find((c) => c.entityName === name && c.fieldPath === path);

    it("★ 마오카이 최대 마나 90 → 100은 18.2 노트(중간 패치 30/100)가 말한 값으로의 회복 — 지연 반영", () => {
      const maokai = of("마오카이", "stats.mana")!;
      expect(maokai.priorNote?.patch).toBe("18.2");
      expect(isSubmarineChange(maokai)).toBe(false);
    });

    it("★ 마스터 이 공격력 62 → 60은 18.2 노트(65 ⇒ 60)에 드디어 도달 — 지연 반영", () => {
      const yi = of("마스터 이", "stats.damage")!;
      expect(yi.priorNote?.patch).toBe("18.2");
      expect(isSubmarineChange(yi)).toBe(false);
    });

    it("지연 반영은 잠수함 수에서 빠지되 변경 수에는 남는다 — 사라지는 것이 아니라 자리를 옮긴다", () => {
      const legacy = diffTft(snapshot("16.19"), snapshot("16.20"), notes("18.4"), "18.4");
      expect(changes).toHaveLength(legacy.length);
      expect(changes.filter(isSubmarineChange).length).toBeLessThan(legacy.filter(isSubmarineChange).length);
    });
  });
});

// 이월 R9(2026-09-28): 18.2 마오카이 노트는 본 패치 「40/100 ⇒ 30/90」에 중간 패치 「30/90 ⇒ 30/100」을 이은
// 「마나 조정 40/100 ⇒ 30/100」(시작/최대)이다. CDragon 16.18은 중간 패치 이전 값(최대 90)이고 새로 받아도, 16.19도
// 90이다. 「a/b」 값을 대조하지 못해 「최대 마나 100→90(공지됨)」이라는 틀린 말이 나갔다.
describe("diffTft — 마나 조정 a/b 대조와 중간 패치(R9)", () => {
  const changes = diffTft(snapshot("16.17"), snapshot("16.18"), notes("18.2"), "18.2");
  const maokai = (fieldPath: string) => changes.find((c) => c.entityName === "마오카이" && c.fieldPath === fieldPath);

  it("★ 최대 마나 100→90은 노트 최종값(100 ⇒ 100)과 어긋난다 — 공지값 불일치, 중간 패치 표식", () => {
    expect(maokai("stats.mana")?.noteMismatch).toEqual({
      noteId: "note:tft:18.2:champion:마오카이:d7ea1995",
      noteBefore: "100",
      noteAfter: "100",
      midpatch: true,
    });
  });
  it("시작 마나 40→30은 노트(40 ⇒ 30)와 맞는다 — 불일치 아님", () => {
    expect(maokai("stats.initialMana")?.noteMismatch).toBeUndefined();
    expect(maokai("stats.initialMana")?.matchedNoteIds.length).toBeGreaterThan(0);
  });
});
