// scripts/run-fetch-notes.ts
// F3 파이프라인 진입점 — dotenv 로드 후 패치노트 fetch(캐시) + parse 호출.
// 실행: npm run pipeline:fetch-notes -- --patch 26.17 [--force] [--locale en-us]

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fetchPatchNotesHtml, parsePatchNotes } from "../src/pipeline/match/patchnotes-parser";
import { splitCombinedWithLocalDdragon } from "../src/pipeline/match/combined-note-split-local";
import { notesFile } from "../src/pipeline/shared/paths";
import type { PatchNoteSection } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

interface CliArgs {
  patch: string;
  force: boolean;
  locale?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-fetch-notes", argv, [
    { name: "patch", type: "patch", required: true },
    { name: "force", type: "boolean", default: false },
    { name: "locale", type: "string" },
  ]);

  return { patch: raw.patch as string, force: raw.force as boolean, locale: raw.locale as string | undefined };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`[run-fetch-notes] patch=${args.patch}` + (args.force ? " (force)" : ""));

  const fetched = await fetchPatchNotesHtml(args.patch, { locale: args.locale, force: args.force });
  console.log(
    `[run-fetch-notes] html ${fetched.fromCache ? "캐시 재사용" : "새로 fetch"} — ${fetched.sourceUrl} ` +
      `(${fetched.html.length} bytes)`
  );

  const rawParsed = parsePatchNotes(fetched.html, { patch: args.patch, sourceUrl: fetched.sourceUrl });
  // 합친 이름 아이템 노트는 DDragon 수치로 나눈다(C2) — run-match의 fetch 경로와 같은 함수.
  const parsed = { ...rawParsed, items: splitCombinedWithLocalDdragon(rawParsed.items, args.patch) };

  const bySection = new Map<PatchNoteSection, number>();
  for (const item of parsed.items) {
    bySection.set(item.section, (bySection.get(item.section) ?? 0) + 1);
  }

  const outFile = notesFile(args.patch);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        meta: {
          patch: args.patch,
          sourceUrl: fetched.sourceUrl,
          fetchedAt: new Date().toISOString(),
          itemCount: parsed.items.length,
        },
        summary: parsed.summary,
        sections: parsed.sections,
        items: parsed.items,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`[run-fetch-notes] 완료 — ${outFile} (총 ${parsed.items.length}건)`);
  for (const [section, count] of bySection) {
    console.log(`[run-fetch-notes]   ${section}: ${count}건`);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error("run-fetch-notes 실패:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
