// scripts/run-migrate-note-directions.ts
// 커밋된 LoL 노트의 `direction`만 현재 파서 규칙으로 다시 매기는 결정론 마이그레이션(2026-09-28, C10).
// 실행: `npx tsx scripts/run-migrate-note-directions.ts --all` (또는 `--patch 26.17`) · `--dry-run`
//
// **왜 재파싱이 아니라 방향만인가**: 라이엇은 발행 후 페이지를 고친다. 원문 캐시로 다시 파싱하면
// 26.16 4·26.18 1개 core id가 사라지거나 새로 생긴다(내용 해시 id) — 판정·LLM 후보 해시가 흔들린다
// (`run-migrate-notes.ts` 헤더와 같은 이유). 그래서 **id가 양쪽에 다 있는 항목의 방향만** 옮긴다.
// 방향은 원문 blockquote 요약(상향/하향 힌트)까지 봐야 정해지므로 커밋 JSON만으로는 재계산할 수 없고,
// 캐시 원문을 파싱한 결과에서 가져온다. 캐시에 없는 id는 건드리지 않는다.
//
// **머지 조건**: core 노트의 방향 변화 0(판정·후보 해시 불변). 0이 아니면 던진다 — 그 경우는 파서
// 규칙 변화가 판정을 바꾼다는 뜻이라 이 스크립트가 조용히 할 일이 아니다(C12가 먼저 들어간 이유).
import fs from "node:fs";
import { parsePatchNotes } from "../src/pipeline/match/patchnotes-parser";
import { notesCacheFile, notesFile } from "../src/pipeline/shared/paths";
import type { PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

export interface DirectionChange {
  id: string;
  modeScope: PatchNoteItem["modeScope"];
  label: string;
  from: PatchNoteItem["direction"];
  to: PatchNoteItem["direction"];
}

/** 순수 함수 — 커밋 노트에 재파싱 결과의 방향을 id로만 옮긴다. 입력을 바꾸지 않는다. */
export function migrateDirections(
  committed: readonly PatchNoteItem[],
  reparsed: readonly PatchNoteItem[]
): { items: PatchNoteItem[]; changes: DirectionChange[] } {
  const byId = new Map(reparsed.map((n) => [n.id, n] as const));
  const changes: DirectionChange[] = [];
  const items = committed.map((n) => {
    const r = byId.get(n.id);
    if (r === undefined || r.direction === n.direction) return n;
    changes.push({
      id: n.id,
      modeScope: n.modeScope,
      label: `${n.entity} · ${n.stat ?? n.summary}`,
      from: n.direction,
      to: r.direction,
    });
    return { ...n, direction: r.direction };
  });
  return { items, changes };
}

const ALL_PATCHES = ["26.16", "26.17", "26.18", "26.19"];

function main(): void {
  const raw = parseCliArgs("run-migrate-note-directions", process.argv.slice(2), [
    { name: "patch", type: "patch" },
    { name: "all", type: "boolean", default: false },
    { name: "dry-run", type: "boolean", default: false },
  ]);
  const patches = raw.all === true ? ALL_PATCHES : [raw.patch as string];
  for (const patch of patches) {
    const file = notesFile(patch);
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { meta: { sourceUrl: string }; items: PatchNoteItem[] };
    const cache = notesCacheFile(patch);
    if (!fs.existsSync(cache)) throw new Error(`${patch}: 원문 캐시가 없다 (${cache}) — 방향 힌트를 복원할 수 없다`);
    const reparsed = parsePatchNotes(fs.readFileSync(cache, "utf8"), { patch, sourceUrl: data.meta.sourceUrl });
    const { items, changes } = migrateDirections(data.items, reparsed.items);
    const core = changes.filter((c) => c.modeScope === "core");
    console.log(`[migrate-directions] ${patch}: 변경 ${changes.length}건 (core ${core.length})`);
    for (const c of changes) console.log(`  ${c.modeScope} | ${c.label} | ${c.from} → ${c.to}`);
    if (core.length > 0) throw new Error(`${patch}: core 방향 변화 ${core.length}건 — 판정이 바뀐다. 마이그레이션을 멈춘다`);
    if (raw["dry-run"] !== true && changes.length > 0) {
      fs.writeFileSync(file, JSON.stringify({ ...data, items }, null, 2), "utf8");
    }
  }
}

if (isMainModule(import.meta.url)) main();
