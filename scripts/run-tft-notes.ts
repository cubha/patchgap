// scripts/run-tft-notes.ts
// TFT 패치노트 수집·파싱 진입점 — **키가 필요 없다**(공개 웹페이지 + Data Dragon).
// 실행: npm run pipeline:tft-notes -- --patch 18.2 [--data-root DIR] [--no-cache]
//
// 산출: data/aggregated/tft/notes-{patch}.json  ·  캐시: data/cache/tft-notes/{patch}.html
//
// 원본 HTML을 캐시하는 이유는 LoL과 같다 — 라이엇이 발행 후에도 페이지를 고치기 때문에
// (26.18 저장본 180줄 vs 오늘자 162줄, `run-migrate-notes.ts` 참고), 한 번 받은 HTML을 남겨
// 두지 않으면 파서를 고칠 때마다 기준선이 같이 움직여 회귀를 판정할 수 없다.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { fetchTftCatalog } from "../src/pipeline/match/tft-catalog";
import { parseTftPatchNotes } from "../src/pipeline/match/tft-notes-parser";
import { isMainModule, parseCliArgs } from "./shared/cli";

const USER_AGENT = "Mozilla/5.0 (compatible; patchgap/1.0; +https://patchgap.vercel.app)";

/** 「18.2」 → 공식 노트 URL. LoL과 달리 `-notes` 접미가 **없고** 도메인도 다르다(실측 2026-09-20). */
export function buildTftNotesUrl(patch: string, locale = "ko-kr"): string {
  return `https://teamfighttactics.leagueoflegends.com/${locale}/news/game-updates/teamfight-tactics-patch-${patch.replace(
    /\./g,
    "-"
  )}/`;
}

/** 본문만 남긴다 — `<main>` 밖의 하이드레이션 JSON에 같은 내용이 한 벌 더 있어 ⇒가 두 배로 세진다. */
export function extractMain(html: string): string {
  const m = /<main\b[\s\S]*?<\/main>/i.exec(html);
  const body = m ? m[0] : html;
  return body
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
}

interface CliArgs {
  patch: string;
  dataRoot: string;
  noCache: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-tft-notes", argv, [
    { name: "patch", type: "patch", required: true },
    { name: "dataRoot", type: "string", default: "data" },
    { name: "noCache", type: "boolean", default: false },
  ]);
  return { patch: String(raw.patch), dataRoot: String(raw.dataRoot), noCache: raw.noCache === true };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = buildTftNotesUrl(args.patch);
  const cacheFile = path.join(args.dataRoot, "cache", "tft-notes", `${args.patch}.html`);

  let html: string;
  if (!args.noCache && fs.existsSync(cacheFile)) {
    html = fs.readFileSync(cacheFile, "utf8");
    console.log(`[tft-notes] 캐시 사용: ${cacheFile}`);
  } else {
    console.log(`[tft-notes] 가져오는 중: ${url}`);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`패치노트 ${res.status} ${res.statusText} — ${url}`);
    html = extractMain(await res.text());
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, html, "utf8");
    console.log(`[tft-notes] 캐시 저장: ${cacheFile} (${html.length}B)`);
  }

  const catalog = await fetchTftCatalog({ patch: args.patch });
  console.log(
    `[tft-notes] 사전(Set ${args.patch.split(".")[0]}): 유닛 ${catalog.units.length} · 특성 ${catalog.traits.length} · ` +
      `증강 ${catalog.augments.length} · 아이템 ${catalog.items.length}`
  );

  const result = parseTftPatchNotes(html, { patch: args.patch, sourceUrl: url, catalog });
  const rate = result.stats.lines === 0 ? 0 : (result.items.length / result.stats.lines) * 100;
  console.log(
    `[tft-notes] 섹션 ${result.stats.sections} · ⇒줄 ${result.stats.lines} · 항목 ${result.items.length} · ` +
      `미해소 ${result.stats.unresolved} · 해소율 ${rate.toFixed(1)}%`
  );
  console.log(`[tft-notes] 고유 엔티티 ${new Set(result.items.map((i) => i.entity)).size}`);

  const outFile = path.join(args.dataRoot, "aggregated", "tft", `notes-${args.patch}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  // `stats`를 함께 쓴다 — 미해소 줄 수는 화면 커버리지 고지의 근거이고, 숨기면 안 된다.
  fs.writeFileSync(
    outFile,
    `${JSON.stringify({ patch: args.patch, sourceUrl: url, stats: result.stats, items: result.items }, null, 2)}\n`,
    "utf8"
  );
  console.log(`[tft-notes] 저장: ${outFile}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[tft-notes] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
