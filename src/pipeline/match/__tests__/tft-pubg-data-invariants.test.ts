// src/pipeline/match/__tests__/tft-pubg-data-invariants.test.ts
// **커밋된 TFT·PUBG 산출물**에 대한 불변식 게이트(2026-09-27).
//
// 왜 필요한가: LoL에는 `notes-invariants`·`deltas-invariants`가 있었지만 TFT·PUBG 산출물을 읽는
// 불변식은 하나도 없었다. 봇 커밋에 데이터 검사를 경보로 붙여도(수집 워크플로 `Data invariants`
// 스텝), 검사가 그 게임을 읽지 않으면 초록불은 아무것도 말하지 않는다. 규칙은 LoL과 같은 것을
// 옮긴다 — 짝지은 노트의 실재·앵커, 검증 통과 원인의 인용 실재·치장 아님·문장과 인용 대상 일치,
// 화면이 읽는 파일 쌍의 존재.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isCosmeticNote } from "../../shared/cosmetic-note";
import { namesOtherEntityThanCited } from "../llm-match";
import type { DeltaRecord, PatchNoteItem } from "../../types";
import type { PubgDeltaRow, PubgNoteItem } from "../pubg-delta";

const AGG = path.join(process.cwd(), "data", "aggregated");
const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

interface TftPair {
  name: string;
  rows: DeltaRecord[];
  notes: PatchNoteItem[];
}

function loadTftPairs(): TftPair[] {
  const dir = path.join(AGG, "tft");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((f) => /^deltas-(\d+\.\d+)-(\d+\.\d+)\.json$/.exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => {
      const notesFile = path.join(dir, `notes-${m[2]}.json`);
      return {
        name: `tft ${m[1]}→${m[2]}`,
        rows: readJson<{ rows: DeltaRecord[] }>(path.join(dir, m[0])).rows,
        notes: fs.existsSync(notesFile) ? readJson<{ items: PatchNoteItem[] }>(notesFile).items : [],
      };
    });
}

const tftPairs = loadTftPairs();

describe("TFT 커밋 산출물 불변식", () => {
  it("검사 대상 쌍이 있고, 각 쌍의 노트 파일이 있다", () => {
    expect(tftPairs.length).toBeGreaterThan(0);
    for (const pair of tftPairs) expect(`${pair.name}: 노트 ${pair.notes.length > 0 ? "있음" : "없음"}`).toBe(`${pair.name}: 노트 있음`);
  });

  it("짝지은 노트 id가 전부 실재하고, 짝이 있으면 원문 앵커가 있다", () => {
    for (const pair of tftPairs) {
      const ids = new Set(pair.notes.map((n) => n.id));
      const dangling = pair.rows.flatMap((r) => r.matchedNoteIds.filter((id) => !ids.has(id)));
      const noAnchor = pair.rows.filter((r) => r.matchedNoteIds.length > 0 && !r.evidence.noteAnchor);
      expect(`${pair.name}: 댕글링 ${dangling.length} · 앵커 없음 ${noAnchor.length}`).toBe(`${pair.name}: 댕글링 0 · 앵커 없음 0`);
    }
  });

  it("검증 통과 원인은 실재·비치장 노트를 인용하고, 문장이 인용 대상과 다른 대상을 말하지 않는다", () => {
    for (const pair of tftPairs) {
      const byId = new Map(pair.notes.map((n) => [n.id, n] as const));
      const bad = pair.rows.flatMap((row) =>
        row.causes
          .filter((c) => c.verified && c.candidateNoteId !== null)
          .filter((c) => {
            const note = byId.get(c.candidateNoteId as string);
            return (
              note === undefined ||
              isCosmeticNote(note) ||
              namesOtherEntityThanCited(c.text, note, pair.notes, row.entityName)
            );
          })
          .map((c) => `${row.id}: ${c.text.slice(0, 20)}`)
      );
      expect(`${pair.name}: 원인 인용 결함 ${bad.length}건 ${bad.join(" | ")}`).toBe(`${pair.name}: 원인 인용 결함 0건 `);
    }
  });
});

describe("PUBG 커밋 산출물 불변식", () => {
  const dir = path.join(AGG, "pubg");
  const deltasFile = path.join(dir, "deltas.json");
  const has = fs.existsSync(deltasFile);

  it.runIf(has)("화면이 읽는 쌍의 파일(양쪽 무기 집계·이후 패치 노트)이 전부 있다 — 없으면 PUBG가 통째로 사라진다", () => {
    const { meta } = readJson<{ meta: { from: string; to: string } }>(deltasFile);
    const missing = [`weapons-${meta.from}.json`, `weapons-${meta.to}.json`, `notes-${meta.to}.json`].filter(
      (f) => !fs.existsSync(path.join(dir, f))
    );
    expect(missing).toEqual([]);
  });

  it.runIf(has)("짝지은 노트·검증 통과 원인의 인용이 전부 실재한다", () => {
    const { meta, rows } = readJson<{ meta: { to: string }; rows: PubgDeltaRow[] }>(deltasFile);
    const notesFile = path.join(dir, `notes-${meta.to}.json`);
    const ids = new Set(fs.existsSync(notesFile) ? readJson<{ items: PubgNoteItem[] }>(notesFile).items.map((n) => n.id) : []);
    const dangling = rows.flatMap((r) => [
      ...r.matchedNoteIds.filter((id) => !ids.has(id)),
      ...(r.causes ?? []).filter((c) => c.verified && c.candidateNoteId !== null && !ids.has(c.candidateNoteId)).map((c) => String(c.candidateNoteId)),
    ]);
    expect(dangling).toEqual([]);
  });
});
