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
import {
  capOverclaimedConfidence,
  pubgNotesAsPatchNotes,
  redistributionExpectation,
  type PubgDeltaRow,
  type PubgNoteItem,
} from "../src/pipeline/match/pubg-delta";
import type { PubgPatchAggregate } from "../src/pipeline/aggregate/pubg-weapons";
import { isMainModule, parseCliArgs } from "./shared/cli";

const ROOT = process.cwd();
const AGG_DIR = path.join(ROOT, "data", "aggregated", "pubg");

interface DeltasFile {
  meta: { from: string; to: string; [k: string]: unknown };
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
  // 재분배 상한 맥락(2026-09-27) — 제로섬 효과의 **폭**을 모델과 코드 게이트가 같은 수치로 본다.
  const weaponsOf = (patch: string) =>
    JSON.parse(fs.readFileSync(path.join(AGG_DIR, `weapons-${patch}.json`), "utf8")) as PubgPatchAggregate;
  const before = weaponsOf(String(deltas.meta.from));
  const after = weaponsOf(deltas.meta.to);
  const redistribution = redistributionExpectation(before, after, notes);
  const totalPickupsRelChange = before.totalPickups > 0 ? after.totalPickups / before.totalPickups - 1 : 0;
  console.log(
    `[pubg-llm] 균등 재분배 기대치 ${(redistribution * 100).toFixed(2)}% · 전체 획득 수 ${(totalPickupsRelChange * 100).toFixed(1)}%`
  );
  const profile = createPubgLlmProfile(new Map(notes.map((n) => [n.id, n.weaponKeys] as const)), {
    redistribution,
    totalPickupsRelChange,
  });

  const targets = deltas.rows.filter(
    (row) => row.status === "unannounced" || row.status === "announced-inconsistent"
  );
  console.log(`[pubg-llm] 대상 ${targets.length}행 · 후보 조항 ${candidates.length}건`);

  const inferred = await inferIndirectCandidates(deltas.rows, candidates, profile, {
    maxDeltas: args.llmMax as number,
    // 개정 태그는 프로필이 지시문 옆에서 든다(`llm-profile-pubg.ts`, C5).
  });
  const capped = inferred.deltas.map((row) => capOverclaimedConfidence(row, redistribution));
  const cappedCount = capped.filter((row, i) => row !== inferred.deltas[i]).length;
  console.log(`[pubg-llm] 재분배 폭을 넘는 변화의 원인 확신도를 low로 낮춘 행: ${cappedCount}`);
  const result = { ...inferred, deltas: capped };

  const withCause = result.deltas.filter((row) => (row.causes ?? []).some((c) => c.verified)).length;
  console.log(
    `[pubg-llm] 호출 ${result.summary.calls} · 캐시 ${result.summary.cacheHits} · 검증 통과 원인 보유 ${withCause}행`
  );

  if (args.dryRun) {
    console.log("[pubg-llm] --dry-run — 파일을 쓰지 않는다");
    return;
  }
  // 실행 요약을 meta에 싣는다(2026-09-27 인수검증 V9) — LoL·TFT 산출물은 `meta.llm.prose`로 문장 위생을
  // 남기는데 PUBG만 없어, 표현 규칙(요약 100자·원인 80자·완곡 종결)을 산출물에서 확인할 수 없었다.
  const s = result.summary;
  const llm = {
    calls: s.calls,
    cacheHits: s.cacheHits,
    skipped: s.skipped,
    proseRepairs: s.proseRepairs,
    usage: s.usage,
    prose: s.prose,
    redistribution,
    confidenceCapped: cappedCount,
  };
  console.log(
    `[pubg-llm] 문장 위생: 요약 ${s.prose.summaryCount}건 중 100자 초과 ${s.prose.summaryOverLength}건 · ` +
      `원인 ${s.prose.causeCount}건 중 80자 초과 ${s.prose.causeOverLength}건 · 명사형 종결 ${s.prose.causeNounEnding}건`
  );
  fs.writeFileSync(
    deltasPath,
    `${JSON.stringify({ ...deltas, meta: { ...deltas.meta, llm }, rows: result.deltas }, null, 2)}\n`
  );
  console.log(`[pubg-llm] 기록: ${path.relative(ROOT, deltasPath)}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
