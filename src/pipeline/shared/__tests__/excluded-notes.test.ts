// src/pipeline/shared/__tests__/excluded-notes.test.ts
// 화면·집계에서 제외하는 패치노트 묶음(2026-09-18 라운드6, 사용자 L1) — TDD RED 먼저.
// 「의회 - 투표 1 결과」(26.18, 34줄)는 파서가 h3 없는 섹션 라벨을 엔티티로 폴백한 것인데, 내용은 패치
// 내용이 아니라 커뮤니티 투표 집계("1. 너무 짧다 - 1.87%")다. 사용자: "어떤 데이터를 표시하는지도
// 모르겠고 … 고랭크 유저에게 전혀 불필요한 정보". 홈 스트림·엔티티 수·디스코드 카운트가 **같은 규칙**을
// 봐야 하므로 shared에 둔다.
import { describe, expect, it } from "vitest";
import type { PatchNoteItem } from "../../types";
import { isExcludedNote } from "../excluded-notes";
import { countRelevantNoteEntities } from "../notes-count";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:26.18:champion:x:0000",
    patch: "26.18",
    section: "champion",
    entity: "테스트",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "요약",
    anchorUrl: "https://example.com/#x",
    anchorKind: "section",
    modeScope: "core",
    ...overrides,
  };
}

describe("isExcludedNote", () => {
  it("의회 투표 결과 묶음은 제외한다(번호가 달라도)", () => {
    expect(isExcludedNote(note({ entity: "의회 - 투표 1 결과" }))).toBe(true);
    expect(isExcludedNote(note({ entity: "의회 - 투표 2 결과" }))).toBe(true);
  });

  // 2026-09-20: 빼려는 것은 투표 **집계표**이지 의회 기능 공지가 아니다. 파서의 엔티티 귀속이
  // 고쳐지며 26.17 「체계」 묶음이 제 이름("제1회 의회 투표")을 되찾았는데, 옛 규칙은 그 3줄
  // (투표 안건·투표 결과 확인·랭크 테두리 삭제 — 전부 실제 패치 내용)까지 화면에서 지웠다.
  it("의회 기능 공지(결과 집계가 아닌 묶음)는 제외하지 않는다", () => {
    expect(isExcludedNote(note({ entity: "제1회 의회 투표" }))).toBe(false);
    expect(isExcludedNote(note({ entity: "의회" }))).toBe(false);
  });

  it("챔피언·아이템·다른 섹션 묶음은 제외하지 않는다", () => {
    expect(isExcludedNote(note({ entity: "피오라" }))).toBe(false);
    expect(isExcludedNote(note({ entity: "버그 수정", section: "system" }))).toBe(false);
    expect(isExcludedNote(note({ entity: "증강", section: "other" }))).toBe(false);
    expect(isExcludedNote(note({ entity: "홀 오브 레전드", section: "system" }))).toBe(false);
  });
});

describe("countRelevantNoteEntities — 제외 규칙 반영", () => {
  it("section=champion이어도 의회 투표 묶음은 엔티티로 세지 않는다(홈 14 → 13)", () => {
    const items = [
      note({ id: "a", entity: "피오라" }),
      note({ id: "b", entity: "피오라" }),
      note({ id: "c", entity: "의회 - 투표 1 결과" }),
      note({ id: "d", entity: "구인수의 격노검", section: "item" }),
    ];
    expect(countRelevantNoteEntities(items)).toBe(2);
  });
});
