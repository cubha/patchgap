// src/pipeline/match/__tests__/run-remap-note-entities.test.ts
// scripts/run-remap-note-entities.ts 단위 검증. vitest include가 src/**만 수집하므로 위치는
// 여기지만 대상은 scripts/다(run-migrate-notes.test.ts와 같은 관례).
//
// 이 재매핑의 계약은 셋이다 — ① core 노트는 절대 건드리지 않는다(LLM 후보셋 해시의 입력이라
// id 1건만 바뀌어도 캐시 866건이 무효가 된다) ② 짝은 summary로만 짓고, 재파싱본 줄이 하나라도
// 짝을 못 찾으면 그 묶음을 통째로 건너뛴다 ③ 귀속 외 필드가 다르면 역시 건너뛴다.
import { describe, expect, it } from "vitest";
import { remapNoteEntities } from "../../../../scripts/run-remap-note-entities";
import type { PatchNoteItem } from "../../types";

const SRC = "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-18-notes/";

function note(overrides: Partial<PatchNoteItem> & { id: string }): PatchNoteItem {
  return {
    patch: "26.18",
    section: "champion",
    entity: "피오라",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "요약",
    anchorUrl: `${SRC}#patch-classic`,
    anchorKind: "section",
    modeScope: "classic",
    ...overrides,
  };
}

describe("remapNoteEntities", () => {
  it("귀속(entity·skill·id)만 옮겨 오고 나머지 필드는 저장본 그대로 둔다", () => {
    const committed = [
      note({ id: "old-1", summary: "갈리오는 주문력을 얻습니다.", skill: "기본 지속 효과 - 룬 피부" }),
    ];
    const reparsed = [
      note({
        id: "new-1",
        entity: "갈리오",
        summary: "갈리오는 주문력을 얻습니다.",
        skill: "기본 지속 효과 - 룬 피부",
      }),
    ];
    const { items, groups } = remapNoteEntities(committed, reparsed);
    expect(items[0].entity).toBe("갈리오");
    expect(items[0].id).toBe("new-1");
    expect(items[0].summary).toBe(committed[0].summary);
    expect(groups).toEqual([{ scope: "classic", committed: 1, reparsed: 1, changed: 1, skipped: null }]);
  });

  it("core 노트는 재파싱본이 달라도 손대지 않는다", () => {
    const committed = [note({ id: "core-1", modeScope: "core", entity: "카시오페아" })];
    const reparsed = [note({ id: "core-2", modeScope: "core", entity: "다른 이름" })];
    const { items, groups } = remapNoteEntities(committed, reparsed);
    expect(items[0]).toEqual(committed[0]);
    expect(groups).toEqual([]);
  });

  it("재파싱본에만 있는 줄이 남으면 그 묶음을 통째로 건너뛴다(원문이 바뀐 구간)", () => {
    const committed = [note({ id: "a", summary: "남아 있는 줄" })];
    const reparsed = [note({ id: "b", entity: "갈리오", summary: "없던 줄" })];
    const { items, groups } = remapNoteEntities(committed, reparsed);
    expect(items[0].entity).toBe("피오라");
    expect(groups[0].skipped).not.toBeNull();
  });

  // 파서가 나중에 거르게 된 `A ⇒ A` 잔여물처럼 저장본에만 있는 줄은 정렬을 깨지 않는다 —
  // 그 줄은 옛 귀속을 유지하고 나머지는 정상적으로 옮겨진다.
  it("저장본에만 있는 줄은 건너뛰고 나머지 짝은 그대로 옮긴다", () => {
    const committed = [
      note({ id: "a", summary: "변경 없음 ⇒ 변경 없음" }),
      note({ id: "b", summary: "성장 최대 체력: 250% ⇒ 315%" }),
    ];
    const reparsed = [note({ id: "b2", entity: "클래식 정글 조정", summary: "성장 최대 체력: 250% ⇒ 315%" })];
    const { items, groups } = remapNoteEntities(committed, reparsed);
    expect(items.map((i) => i.entity)).toEqual(["피오라", "클래식 정글 조정"]);
    expect(groups[0].skipped).toBeNull();
    expect(groups[0].changed).toBe(1);
  });

  it("귀속 외 필드가 달라지면 내용 변경이므로 건너뛴다", () => {
    const committed = [note({ id: "a", summary: "같은 요약", before: "10", after: "20" })];
    const reparsed = [note({ id: "b", entity: "갈리오", summary: "같은 요약", before: "10", after: "30" })];
    const { items, groups } = remapNoteEntities(committed, reparsed);
    expect(items[0].entity).toBe("피오라");
    expect(groups[0].skipped).toContain("귀속 외 필드");
  });

  it("멱등이다 — 이미 옮겨진 파일을 다시 돌리면 변경 0", () => {
    const committed = [note({ id: "x", entity: "갈리오", summary: "s" })];
    const reparsed = [note({ id: "x", entity: "갈리오", summary: "s" })];
    const { groups } = remapNoteEntities(committed, reparsed);
    expect(groups[0].changed).toBe(0);
  });
});
