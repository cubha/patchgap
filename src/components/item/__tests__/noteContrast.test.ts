import { describe, expect, it } from "vitest";
import type { NotesFile } from "@/lib/data";
import type { PatchNoteItem } from "@/pipeline/types";
import { resolveNoteContrast } from "../noteContrast";

function makeNote(overrides: Partial<PatchNoteItem> = {}): PatchNoteItem {
  return {
    id: "note:26.17:champion:trundle:aaa",
    patch: "26.17",
    section: "champion",
    entity: "트런들",
    skill: "기타 조정",
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "사거리 표시 개선(수치 변경 없음)",
    anchorUrl: "https://example.com/notes#patch-trundle",
    anchorKind: "entity",
    modeScope: "core",
    ...overrides,
  };
}

function makeNotesFile(items: PatchNoteItem[]): NotesFile {
  return {
    meta: { patch: "26.17", sourceUrl: "https://example.com", fetchedAt: "2026-09-05T00:00:00Z", itemCount: items.length },
    summary: "",
    sections: [],
    items,
  };
}

describe("resolveNoteContrast", () => {
  it("matchedNoteIds가 있고 NotesFile에서 조회되면 matched를 반환한다", () => {
    const note = makeNote();
    const result = resolveNoteContrast(
      { matchedNoteIds: [note.id], entityName: "트런들" },
      makeNotesFile([note]),
      "26.17"
    );
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].item.id).toBe(note.id);
      expect(result.matched[0].anchorCaption).toBeNull();
    }
  });

  it("anchorKind가 section/page면 캡션을 붙인다", () => {
    const sectionNote = makeNote({ id: "n1", anchorKind: "section" });
    const pageNote = makeNote({ id: "n2", anchorKind: "page" });
    const notes = makeNotesFile([sectionNote, pageNote]);

    const r1 = resolveNoteContrast({ matchedNoteIds: ["n1"], entityName: "트런들" }, notes, "26.17");
    const r2 = resolveNoteContrast({ matchedNoteIds: ["n2"], entityName: "트런들" }, notes, "26.17");
    expect(r1.status === "matched" && r1.matched[0].anchorCaption).toBe("섹션 앵커");
    expect(r2.status === "matched" && r2.matched[0].anchorCaption).toBe("페이지 앵커");
  });

  it("matchedNoteIds가 비어 있으면 unmatched + 메시지를 반환한다", () => {
    const result = resolveNoteContrast(
      { matchedNoteIds: [], entityName: "트런들" },
      makeNotesFile([]),
      "26.17"
    );
    expect(result.status).toBe("unmatched");
    if (result.status === "unmatched") {
      expect(result.message).toBe("26.17 패치노트에 트런들 항목 없음");
      expect(result.adjacent).toEqual([]);
    }
  });

  it("unmatched일 때 같은 엔티티의 other/system 섹션 항목을 인접 항목으로 반환한다", () => {
    const otherNote = makeNote({ id: "n3", section: "other", entity: "트런들" });
    const systemNote = makeNote({ id: "n4", section: "system", entity: "트런들" });
    const championNoteOtherEntity = makeNote({ id: "n5", section: "champion", entity: "다른챔프" });
    const notes = makeNotesFile([otherNote, systemNote, championNoteOtherEntity]);

    const result = resolveNoteContrast({ matchedNoteIds: [], entityName: "트런들" }, notes, "26.17");
    expect(result.status).toBe("unmatched");
    if (result.status === "unmatched") {
      expect(result.adjacent.map((i) => i.id).sort()).toEqual(["n3", "n4"]);
    }
  });

  it("matchedNoteIds가 있어도 NotesFile에 실제로 없으면(스키마 불일치) unmatched로 폴백한다", () => {
    const result = resolveNoteContrast(
      { matchedNoteIds: ["ghost-id"], entityName: "트런들" },
      makeNotesFile([]),
      "26.17"
    );
    expect(result.status).toBe("unmatched");
  });

  it("notes가 null이면(패치노트 파일 없음) unmatched로 안전하게 처리한다", () => {
    const result = resolveNoteContrast({ matchedNoteIds: [], entityName: "트런들" }, null, "26.17");
    expect(result.status).toBe("unmatched");
    if (result.status === "unmatched") {
      expect(result.adjacent).toEqual([]);
    }
  });
});
