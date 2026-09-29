// src/pipeline/match/__tests__/spell-icon.test.ts
// ST-D — resolveSpellIconFile 순수 매핑 함수 테스트. 파일명은 챔피언마다 임의 문자열이라
// 규칙화 불가하므로, 실제 DDragon 상세 JSON 구조를 축약한 픽스처로 Q/W/E/R/P 인덱스 매핑을
// 검증한다.
import { describe, it, expect } from "vitest";
import chogathFixture from "../../../__fixtures__/ddragon-champion-chogath.json";
import gravesFixture from "../../../__fixtures__/ddragon-champion-graves.json";
import { parseSkillSlot, resolveSpellIconFile, spellIconKey, spellImageDir } from "../spell-icon";

describe("resolveSpellIconFile", () => {
  it("초가스 E는 VorpalSpikes.png", () => {
    expect(resolveSpellIconFile(chogathFixture, "E")).toBe("VorpalSpikes.png");
  });

  it("그레이브즈 Q는 GravesQLineSpell.png", () => {
    expect(resolveSpellIconFile(gravesFixture, "Q")).toBe("GravesQLineSpell.png");
  });

  it("초가스 P(패시브)는 Chogath_Passive.png", () => {
    expect(resolveSpellIconFile(chogathFixture, "P")).toBe("Chogath_Passive.png");
  });

  it("그레이브즈 R은 GravesCollateralDamage.png", () => {
    expect(resolveSpellIconFile(gravesFixture, "R")).toBe("GravesCollateralDamage.png");
  });

  it("spells 배열 범위를 벗어나는 슬롯은 null", () => {
    const truncated = {
      data: {
        Test: {
          spells: [{ image: { full: "OnlyQ.png" } }],
          passive: { image: { full: "Passive.png" } },
        },
      },
    };
    expect(resolveSpellIconFile(truncated, "R")).toBeNull();
  });

  it("구조가 깨진 JSON(data 없음)은 null(throw 아님)", () => {
    expect(resolveSpellIconFile({ foo: "bar" }, "Q")).toBeNull();
  });

  it("구조가 깨진 JSON(spells가 배열이 아님)은 null(throw 아님)", () => {
    const malformed = { data: { X: { spells: "not-an-array", passive: null } } };
    expect(resolveSpellIconFile(malformed, "Q")).toBeNull();
  });

  it("null 입력은 null", () => {
    expect(resolveSpellIconFile(null, "Q")).toBeNull();
  });
});

describe("parseSkillSlot", () => {
  it("'Q - 빛의 숨결' → Q", () => {
    expect(parseSkillSlot("Q - 빛의 숨결")).toBe("Q");
  });

  it("'E - 날카로운 가시' → E", () => {
    expect(parseSkillSlot("E - 날카로운 가시")).toBe("E");
  });

  it("복합 표기 'RW - 모방: 왜곡'은 첫 글자 R만 취한다", () => {
    expect(parseSkillSlot("RW - 모방: 왜곡")).toBe("R");
  });

  it("'기본 능력치'는 슬롯 표기가 없어 null(추측하지 않음)", () => {
    expect(parseSkillSlot("기본 능력치")).toBeNull();
  });

  // 2026-09-29 명세 변경: 「기본 지속 효과」는 LoL 한국어 노트가 패시브에 쓰는 **명시적 표기**다(추측 아님).
  // null로 두었더니 26.19 패시브 4행이 전부 글자 폴백이었다 — 사용자 지적 「lol은 패치내용표에 사진이 없다」.
  it("'기본 지속 효과 - 영혼의 포식자'는 패시브(P)", () => {
    expect(parseSkillSlot("기본 지속 효과 - 영혼의 포식자")).toBe("P");
  });

  it("빈 문자열은 null", () => {
    expect(parseSkillSlot("")).toBeNull();
  });
});

describe("spellIconKey", () => {
  it("entity와 skill을 Unit Separator(U+001F)로 결합한다", () => {
    const key = spellIconKey("초가스", "E - 날카로운 가시");
    expect(key).toBe("초가스\u001FE - 날카로운 가시");
  });

  it("entity/skill 경계가 달라도 결합 결과가 겹치지 않는다(구분자로 경계 보존 확인)", () => {
    const a = spellIconKey("A", "BC");
    const b = spellIconKey("AB", "C");
    expect(a).not.toBe(b);
  });
});

// 패시브 이미지는 DDragon CDN에서 `img/passive/`, 스킬은 `img/spell/`에 있다(2026-09-29).
describe("spellImageDir", () => {
  it("P는 passive, Q/W/E/R은 spell", () => {
    expect(spellImageDir("P")).toBe("passive");
    for (const slot of ["Q", "W", "E", "R"] as const) expect(spellImageDir(slot)).toBe("spell");
  });
});
