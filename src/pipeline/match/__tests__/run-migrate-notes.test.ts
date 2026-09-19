// src/pipeline/match/__tests__/run-migrate-notes.test.ts
// scripts/run-migrate-notes.ts 단위 검증. vitest include가 src/**만 수집하므로 위치는 여기지만
// 대상은 scripts/다(run-match.test.ts와 같은 관례).
//
// 이 마이그레이션의 계약은 하나다 — **modeScope 외에는 아무것도 바꾸지 않는다.** 노트 id가
// 내용 해시 기반이라 본문이 한 글자만 달라져도 커밋된 델타의 matchedNoteIds가 댕글링되기 때문이다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { diffExceptModeScope, migrateFile, migrateNotes } from "../../../../scripts/run-migrate-notes";
import type { PatchNoteItem } from "../../types";

const SRC = "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-18-notes/";

function legacy(overrides: Partial<PatchNoteItem> & { id: string }): Omit<PatchNoteItem, "modeScope"> {
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
    ...overrides,
  };
}

describe("migrateNotes", () => {
  it("앵커로 스코프를 채우고 다른 필드는 건드리지 않는다", () => {
    const before = [
      legacy({ id: "n1" }),
      legacy({ id: "n2", anchorUrl: `${SRC}#patch-cassiopeia`, entity: "카시오페아", anchorKind: "entity" }),
      legacy({ id: "n3", anchorUrl: `${SRC}#patch-aram:-mayhem`, section: "other" }),
    ];
    const { items, result } = migrateNotes(before);
    expect(items.map((i) => i.modeScope)).toEqual(["classic", "core", "aram"]);
    expect(result.filled).toBe(3);
    expect(result.corrected).toBe(0);
    expect(diffExceptModeScope(before, items)).toEqual([]);
    // section은 그대로다 — id가 section을 포함하므로 바꾸면 기존 판정 참조가 끊긴다.
    expect(items[0].section).toBe("champion");
  });

  it("멱등이다 — 두 번 돌려도 같은 결과이고 두 번째는 전부 '동일'로 집계된다", () => {
    const before = [legacy({ id: "n1" })];
    const once = migrateNotes(before);
    const twice = migrateNotes(once.items);
    expect(twice.items).toEqual(once.items);
    expect(twice.result.unchanged).toBe(1);
    expect(twice.result.filled).toBe(0);
  });

  it("값이 틀어져 있으면 교정하고 그 사실을 센다", () => {
    const wrong = [{ ...legacy({ id: "n1" }), modeScope: "core" as const }];
    const { items, result } = migrateNotes(wrong);
    expect(items[0].modeScope).toBe("classic");
    expect(result.corrected).toBe(1);
  });
});

describe("diffExceptModeScope", () => {
  it("본문이 바뀌면 잡아낸다(재파싱 사고 방지 게이트)", () => {
    const before = [legacy({ id: "n1", summary: "원래 문구" })];
    const after = [{ ...legacy({ id: "n1", summary: "바뀐 문구" }), modeScope: "classic" as const }];
    expect(diffExceptModeScope(before, after)).toHaveLength(1);
  });

  it("항목 수가 달라지면 즉시 보고한다", () => {
    expect(diffExceptModeScope([legacy({ id: "n1" })], [])).toHaveLength(1);
  });
});

describe("migrateFile", () => {
  it("파일을 제자리에서 갱신하고 meta·summary·sections를 보존한다", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pg-migrate-"));
    const dir = path.join(root, "aggregated", "notes");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "26.18.json");
    const payload = {
      meta: { patch: "26.18", itemCount: 1 },
      summary: "총평",
      sections: ["챔피언", "클래식"],
      items: [legacy({ id: "n1" })],
    };
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const result = migrateFile("26.18", root);
    expect(result.filled).toBe(1);

    const reread = JSON.parse(fs.readFileSync(file, "utf8")) as typeof payload & {
      items: PatchNoteItem[];
    };
    expect(reread.meta).toEqual(payload.meta);
    expect(reread.summary).toBe("총평");
    expect(reread.sections).toEqual(["챔피언", "클래식"]);
    expect(reread.items[0].modeScope).toBe("classic");
    fs.rmSync(root, { recursive: true, force: true });
  });
});
