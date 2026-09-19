// src/pipeline/match/__tests__/deltas-invariants.test.ts
// **커밋된 판정 산출물**(`data/aggregated/deltas/*.json`)에 대한 불변식 게이트(2026-09-19).
//
// 왜 노트 불변식만으로 부족한가(독립 채점 K3-4 지적): 노트 쪽 검사는 "core인 champion/item은
// 엔티티 앵커를 갖는다"는 **전방 드리프트 가드**라, 정작 이번에 관측된 결함(모드 노트가 델타와
// 짝지어져 "공지"로 판정됨)을 수정 전 데이터에서 재현하지 못했다. 발화하지 않는 규칙은 게이트가
// 아니다. 이 파일은 결함을 **그 형태 그대로** 인코딩한다 — 수정 전 데이터에서는 26.16→26.17
// 739건·26.17→26.18 845건으로 실패했을 검사다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isCoreNote } from "../../shared/mode-scope";
import type { DeltasFile, PatchNoteItem } from "../../types";

const AGG = path.join(process.cwd(), "data", "aggregated");

interface Pair {
  name: string;
  rows: DeltasFile["rows"];
  notes: Map<string, PatchNoteItem>;
}

function loadPairs(): Pair[] {
  const deltasDir = path.join(AGG, "deltas");
  if (!fs.existsSync(deltasDir)) return [];
  return fs
    .readdirSync(deltasDir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => {
      const name = file.replace(/\.json$/, "");
      const to = name.split("_")[1];
      const notesFile = path.join(AGG, "notes", `${to}.json`);
      const items = fs.existsSync(notesFile)
        ? (JSON.parse(fs.readFileSync(notesFile, "utf8")) as { items: PatchNoteItem[] }).items
        : [];
      return {
        name,
        rows: (JSON.parse(fs.readFileSync(path.join(deltasDir, file), "utf8")) as DeltasFile).rows,
        notes: new Map(items.map((n) => [n.id, n] as const)),
      };
    });
}

const pairs = loadPairs();

describe("커밋된 판정 산출물 불변식", () => {
  it("검사 대상 쌍이 있다(빈 클론이면 이 파일 전체가 무의미하다)", () => {
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) expect(pair.notes.size).toBeGreaterThan(0);
  });

  it("짝지어진 노트 id가 전부 실재한다(댕글링 0) — 노트만 재생성하면 여기서 깨진다", () => {
    for (const pair of pairs) {
      const dangling = pair.rows.flatMap((row) =>
        [...(row.matchedNoteIds ?? []), ...(row.matchedNoteId ? [row.matchedNoteId] : [])].filter(
          (id) => !pair.notes.has(id)
        )
      );
      expect(`${pair.name}: 댕글링 ${dangling.length}건`).toBe(`${pair.name}: 댕글링 0건`);
    }
  });

  it("다른 게임 모드 노트와 짝지어진 판정이 없다 — 이번 라운드가 고친 결함 그 자체다", () => {
    for (const pair of pairs) {
      const modePaired = pair.rows.flatMap((row) =>
        [...(row.matchedNoteIds ?? []), ...(row.matchedNoteId ? [row.matchedNoteId] : [])].filter((id) => {
          const note = pair.notes.get(id);
          return note !== undefined && !isCoreNote(note);
        })
      );
      expect(`${pair.name}: 모드 노트 짝 ${modePaired.length}건`).toBe(`${pair.name}: 모드 노트 짝 0건`);
    }
  });

  it("검증 통과 원인이 모드 노트를 인용하지 않는다", () => {
    for (const pair of pairs) {
      const bad = pair.rows.flatMap((row) =>
        row.causes
          .filter((cause) => cause.verified && cause.candidateNoteId !== null)
          .filter((cause) => {
            const note = pair.notes.get(cause.candidateNoteId as string);
            return note === undefined || !isCoreNote(note);
          })
      );
      expect(`${pair.name}: 모드 인용 원인 ${bad.length}건`).toBe(`${pair.name}: 모드 인용 원인 0건`);
    }
  });

  it("본문색으로 나가는 요약이 모드 노트를 인용하지 않는다", () => {
    for (const pair of pairs) {
      const bad = pair.rows.filter((row) => {
        const llm = row.llm;
        if (!llm || llm.skipped || !llm.summaryVerified) return false;
        return (llm.summaryCites ?? []).some((id) => {
          const note = pair.notes.get(id);
          return note === undefined || !isCoreNote(note);
        });
      });
      expect(`${pair.name}: 모드 인용 요약 ${bad.length}건`).toBe(`${pair.name}: 모드 인용 요약 0건`);
    }
  });
});
