// src/pipeline/shared/__tests__/mode-scope.test.ts
// 모드 스코프 공용 술어(2026-09-19 근본수정 S1) — TDD RED 먼저.
//
// 배경: 패치노트 h2 "클래식"은 SR이 아니라 **별도 게임 모드**(LoL 클래식, 2010~2017 시점 챔피언
// 복각)다 — 26.16~26.18 원문 확인. 그런데 파서가 그 섹션 하위 라벨 "챔피언"을 만나면 section을
// champion으로 재분류해, 클래식 피오라 65줄이 SR 피오라 델타와 짝지어졌다.
//
// 이 모듈은 "이 노트가 **어디에 적용되나**"를 한 곳에서 답한다. section("무엇이 바뀌었나")과 축이
// 다르며, section·노트 id는 건드리지 않는다(id에 section이 들어가 있어 바꾸면 기존 델타의
// matchedNoteIds가 전부 댕글링된다 — BRAINTRUST-root-fix-2026-09-19.md §4).
import { describe, expect, it } from "vitest";
import {
  isCoreNote,
  modeScopeFromAnchorUrl,
  modeScopeFromSectionTitle,
  assertModeScopeConsistent,
  type NoteModeScope,
} from "../mode-scope";

const SRC = "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-18-notes/";

describe("modeScopeFromAnchorUrl", () => {
  it.each<[string, NoteModeScope]>([
    ["#patch-classic", "classic"],
    ["#patch-classic-gold-generation", "classic"],
    ["#patch-aram:-mayhem", "aram"],
    ["#patch-mayhem", "aram"],
    ["#patch-arena", "arena"],
    ["#patch-swiftplay", "swiftplay"],
    ["#patch-brawl", "brawl"],
  ])("모드 섹션 앵커 %s → %s", (hash, expected) => {
    expect(modeScopeFromAnchorUrl(`${SRC}${hash}`)).toBe(expected);
  });

  it.each(["#patch-cassiopeia", "#patch-champions", "#patch-items", "#patch-bugfixes-and-qol-changes", "#patch-hall-of-legends", ""])(
    "SR 앵커 %s → core",
    (hash) => {
      expect(modeScopeFromAnchorUrl(`${SRC}${hash}`)).toBe("core");
    }
  );
});

describe("isCoreNote", () => {
  it("core만 true다 — 짝짓기 자격은 이 술어 하나로 판정한다", () => {
    expect(isCoreNote({ modeScope: "core" })).toBe(true);
    expect(isCoreNote({ modeScope: "classic" })).toBe(false);
    expect(isCoreNote({ modeScope: "aram" })).toBe(false);
    expect(isCoreNote({ modeScope: "arena" })).toBe(false);
  });
});

describe("modeScopeFromSectionTitle — 앵커와 독립인 두 번째 신호", () => {
  it.each<[string, NoteModeScope | null]>([
    ["클래식", "classic"],
    ["무작위 총력전: 아수라장", "aram"],
    ["아레나", "arena"],
    ["챔피언", null],
    ["아이템", null],
    ["버그 수정 및 편의성 개선", null],
  ])("%s → %s", (title, expected) => {
    expect(modeScopeFromSectionTitle(title)).toBe(expected);
  });
});

describe("assertModeScopeConsistent — 조용한 실패를 시끄럽게", () => {
  it("제목과 앵커가 같은 말을 하면 통과한다", () => {
    expect(() => assertModeScopeConsistent("클래식", `${SRC}#patch-classic`)).not.toThrow();
    expect(() => assertModeScopeConsistent("챔피언", `${SRC}#patch-cassiopeia`)).not.toThrow();
  });

  it("제목은 모드인데 앵커가 core면 throw한다(라이엇이 앵커 id를 바꾼 경우)", () => {
    expect(() => assertModeScopeConsistent("클래식", `${SRC}#patch-lol-classic-2026`)).toThrow(/modeScope/);
  });

  it("앵커는 모드인데 제목이 core면 throw한다(라이엇이 h2 제목을 바꾼 경우)", () => {
    expect(() => assertModeScopeConsistent("LoL 클래식 모드", `${SRC}#patch-classic`)).toThrow(/modeScope/);
  });
});
