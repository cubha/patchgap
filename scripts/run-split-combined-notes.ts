// scripts/run-split-combined-notes.ts
// 커밋된 LoL 노트의 합친 이름 아이템 노트를 DDragon 수치 대조로 나눈다(2026-09-28, C2).
// 실행: npx tsx scripts/run-split-combined-notes.ts --patch 26.19 --from 16.18.1 --to 16.19.1 [--dry-run]
//
// 규칙은 `src/pipeline/match/combined-note-split.ts`. **DDragon 두 버전이 다 있어야 한다** — 없으면 던진다
// (조용히 빈 표로 돌면 「검증할 수치 없음」으로 떨어져 분해가 안 된 것이 숨는다). 노트 id가 바뀌므로 이
// 스크립트 뒤에는 판정(run-match)과 수치 축(run-gamedata-diff)을 다시 돈다.
import fs from "node:fs";
import { splitCombinedNotes } from "../src/pipeline/match/combined-note-split";
import { loadItemStatTable } from "../src/pipeline/match/ddragon";
import { notesFile } from "../src/pipeline/shared/paths";
import type { PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

function main(): void {
  const raw = parseCliArgs("run-split-combined-notes", process.argv.slice(2), [
    { name: "patch", type: "patch", required: true },
    { name: "from", type: "string", required: true },
    { name: "to", type: "string", required: true },
    { name: "dry-run", type: "boolean", default: false },
  ]);
  const file = notesFile(String(raw.patch));
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { items: PatchNoteItem[] };
  const { items, report } = splitCombinedNotes(data.items, loadItemStatTable(String(raw.from)), loadItemStatTable(String(raw.to)));
  for (const r of report) console.log(`[split-combined] ${r.entity}: ${r.outcome} — ${r.reason}`);
  console.log(`[split-combined] 노트 ${data.items.length} → ${items.length}`);
  if (raw["dry-run"] !== true && items.length !== data.items.length) {
    fs.writeFileSync(file, `${JSON.stringify({ ...data, items }, null, 2)}\n`, "utf8");
  }
}

if (isMainModule(import.meta.url)) main();
