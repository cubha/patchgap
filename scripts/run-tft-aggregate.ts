// scripts/run-tft-aggregate.ts
// TFT 집계 진입점 — 원본 JSONL → 슬림 → 집계 JSON. **키가 필요 없다**(수집된 원본만 읽는다).
// 실행: npm run pipeline:tft-aggregate -- --patch 18.2 [--data-root DIR]
//
// 산출: data/aggregated/tft/boards-{patch}.json
//
// 카탈로그 조인(키 → 한국어 표시명)도 여기서 한다. 매치는 `DA_18_Rakan` 같은 **키**로 오고
// 패치노트는 **한국어 이름**으로 오므로, 둘을 잇지 않으면 선언↔관측 대조가 성립하지 않는다.
// 조인 실패는 **숨기지 않고 센다** — 세트가 바뀌면 여기가 먼저 깨진다.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { aggregateTftBoards, type TftEntityStat } from "../src/pipeline/aggregate/tft-boards";
import { toTftMatchSlim } from "../src/pipeline/collect/tft-slim";
import { fetchTftKeyIndex } from "../src/pipeline/match/tft-catalog";
import type { TftMatchSlim } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

interface CliArgs {
  patch: string;
  dataRoot: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-tft-aggregate", argv, [
    { name: "patch", type: "patch", required: true },
    { name: "dataRoot", type: "string", default: "data" },
  ]);
  return { patch: String(raw.patch), dataRoot: String(raw.dataRoot) };
}

export function readRawMatches(file: string, patch: string): { slim: TftMatchSlim[]; dropped: number } {
  const slim: TftMatchSlim[] = [];
  let dropped = 0;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.trim().length === 0) continue;
    let envelope: { raw?: unknown };
    try {
      envelope = JSON.parse(line) as { raw?: unknown };
    } catch {
      dropped += 1; // 중단 시점에 잘린 줄.
      continue;
    }
    // 8인 전투가 아니면 버린다 — 등장률 분모가 왜곡된다.
    const m = toTftMatchSlim(envelope.raw, patch, { requiredParticipants: 8 });
    if (m === null) dropped += 1;
    else slim.push(m);
  }
  return { slim, dropped };
}

/** 키 → 한국어 표시명. 못 찾은 키는 `null`로 남기고 **개수를 보고한다**. */
function nameStats(
  stats: TftEntityStat[],
  index: Record<string, string>
): { rows: (TftEntityStat & { name: string | null })[]; unmatched: string[] } {
  const unmatched: string[] = [];
  const rows = stats.map((s) => {
    const name = index[s.key] ?? null;
    if (name === null) unmatched.push(s.key);
    return { ...s, name };
  });
  return { rows, unmatched };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rawFile = path.join(args.dataRoot, "raw", "tft", `matches-${args.patch.replace(/\./g, "-")}.jsonl`);
  if (!fs.existsSync(rawFile)) {
    throw new Error(`원본이 없다: ${rawFile} — 먼저 npm run pipeline:tft-collect 를 돌린다.`);
  }

  const { slim, dropped } = readRawMatches(rawFile, args.patch);
  console.log(`[tft-aggregate] ${args.patch}: 매치 ${slim.length} · 버림 ${dropped}`);
  if (slim.length === 0) throw new Error("읽을 수 있는 매치가 0건이다 — 변환이 깨졌는지 확인한다.");

  const agg = aggregateTftBoards(slim, args.patch);
  console.log(`[tft-aggregate] 보드 ${agg.boards} · 유닛 ${agg.units.length} · 특성 ${agg.traits.length} · 아이템 ${agg.items.length}`);

  const index = await fetchTftKeyIndex({ patch: args.patch });
  const units = nameStats(agg.units, index.units);
  const traits = nameStats(agg.traits, index.traits);
  const items = nameStats(agg.items, index.items);
  console.log(
    `[tft-aggregate] 이름 조인 실패 — 유닛 ${units.unmatched.length} · 특성 ${traits.unmatched.length} · 아이템 ${items.unmatched.length}`
  );
  for (const [label, u] of [["유닛", units], ["특성", traits], ["아이템", items]] as const) {
    if (u.unmatched.length > 0) console.log(`   ${label} 미일치 표본: ${u.unmatched.slice(0, 6).join(", ")}`);
  }

  const outFile = path.join(args.dataRoot, "aggregated", "tft", `boards-${args.patch}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(
    outFile,
    `${JSON.stringify(
      {
        patch: agg.patch,
        matches: agg.matches,
        boards: agg.boards,
        droppedMatches: dropped,
        summary: agg.summary,
        unmatchedKeys: { units: units.unmatched, traits: traits.unmatched, items: items.unmatched },
        units: units.rows,
        traits: traits.rows,
        items: items.rows,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`[tft-aggregate] 저장: ${outFile}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[tft-aggregate] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
