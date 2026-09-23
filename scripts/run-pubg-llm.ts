// scripts/run-pubg-llm.ts
// PUBG LLM 2단 간접 원인 추론 — `data/aggregated/pubg/deltas.json`의 미공지·공지불일치 행에
// `causes`/`llm`을 채워 되쓴다. 실행: npx tsx scripts/run-pubg-llm.ts [--llm-max 40] [--dry-run]
//
// **왜 별도 스크립트인가**: PUBG 판정(`pubg-determine.ts`)은 1회성 harvest 산출물에 붙는
// 순수 계산이고, 이 단계만 네트워크·예산을 쓴다. LoL은 `run-match.ts` 안에서 같은 일을 하지만
// PUBG는 판정을 다시 돌릴 일이 드물어 분리하는 쪽이 재실행이 싸다(캐시 우선이라 재실행도 싸다).
//
// **후보 변환**: PUBG 노트는 `PubgNoteItem`(무기 키 배열)이고 엔진은 `PatchNoteItem`을 받는다.
// 변환은 여기서 하고, 자기참조 판정에 필요한 원본 매핑은 프로필에 클로저로 넘긴다.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { inferIndirectCandidates } from "../src/pipeline/match/llm-match";
import { createPubgLlmProfile } from "../src/pipeline/match/llm-profile-pubg";
import { pubgNotesAsPatchNotes, type PubgDeltaRow, type PubgNoteItem } from "../src/pipeline/match/pubg-delta";
import { isMainModule, parseCliArgs } from "./shared/cli";

const ROOT = process.cwd();
const AGG_DIR = path.join(ROOT, "data", "aggregated", "pubg");

interface DeltasFile {
  meta: { to: string; [k: string]: unknown };
  rows: PubgDeltaRow[];
}

async function main(): Promise<void> {
  const args = parseCliArgs("run-pubg-llm", process.argv.slice(2), [
    { name: "llmMax", type: "number", default: 40 },
    { name: "dryRun", type: "boolean", default: false },
  ]);

  const deltasPath = path.join(AGG_DIR, "deltas.json");
  const deltas = JSON.parse(fs.readFileSync(deltasPath, "utf8")) as DeltasFile;
  const notesPath = path.join(AGG_DIR, `notes-${deltas.meta.to}.json`);
  // 노트 파일은 `{ meta, items }` 래퍼다(`lib/pubgData.ts`와 같은 모양).
  const notes = (JSON.parse(fs.readFileSync(notesPath, "utf8")) as { items: PubgNoteItem[] }).items;

  const nameByKey = new Map(deltas.rows.map((row) => [row.weaponKey, row.weaponName] as const));
  const candidates = pubgNotesAsPatchNotes(notes, (key) => nameByKey.get(key) ?? null);
  const profile = createPubgLlmProfile(new Map(notes.map((n) => [n.id, n.weaponKeys] as const)));

  const targets = deltas.rows.filter(
    (row) => row.status === "unannounced" || row.status === "announced-inconsistent"
  );
  console.log(`[pubg-llm] 대상 ${targets.length}행 · 후보 조항 ${candidates.length}건`);

  const result = await inferIndirectCandidates(deltas.rows, candidates, profile, {
    maxDeltas: args.llmMax as number,
  });

  const withCause = result.deltas.filter((row) => (row.causes ?? []).some((c) => c.verified)).length;
  console.log(
    `[pubg-llm] 호출 ${result.summary.calls} · 캐시 ${result.summary.cacheHits} · 검증 통과 원인 보유 ${withCause}행`
  );

  if (args.dryRun) {
    console.log("[pubg-llm] --dry-run — 파일을 쓰지 않는다");
    return;
  }
  fs.writeFileSync(deltasPath, `${JSON.stringify({ ...deltas, rows: result.deltas }, null, 2)}\n`);
  console.log(`[pubg-llm] 기록: ${path.relative(ROOT, deltasPath)}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
