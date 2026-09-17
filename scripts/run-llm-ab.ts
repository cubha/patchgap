// scripts/run-llm-ab.ts
// LLM 2단 모델 A/B 실측 도구(일회성) — **모델을 바꾸지 않는다**. `LLM_MODEL`은 프로젝트
// CLAUDE.md §기술 스택의 고정값이라 변경하려면 SCOPE를 먼저 갱신해야 한다. 이 스크립트가
// 하는 일은 "같은 델타에 상위 모델을 붙이면 실제로 더 찾는가"에 **숫자로** 답하는 것뿐이고,
// 채택 여부는 사람이 결정한다(사용자 지시 B5: "모델상향 **검토**").
//
// 공정성 규칙:
//  - 두 모델에 **같은 deltaId · 같은 후보셋**을 준다(candidateSetHash가 같으므로 프롬프트도 동일).
//  - 캐시 키에 model이 들어가므로 두 모델 결과가 서로를 덮지 않는다. 다만 A/B는 **별도
//    cacheDir**에 쓴다 — 실험 산출물이 운영 캐시에 섞이면 다음 파이프라인 실행의 입력이 조용히
//    바뀐다.
//  - 대상은 "현재 causes가 비어 있는 미공지 행" 우선 — 개선 여지가 있는 곳에서 재본다.
//
// 사용: npx tsx scripts/run-llm-ab.ts [--n 12] [--challenger claude-opus-5]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { inferIndirectCandidates, LLM_MODEL } from "../src/pipeline/match/llm-match";
import { loadDdragonSafe } from "../src/pipeline/match/ddragon";
import type { DeltaRecord, DeltasFile, PatchNoteItem } from "../src/pipeline/types";

const ROOT = process.cwd();
const AB_CACHE = path.join(ROOT, "data", "cache", "llm-ab");

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

interface Outcome {
  model: string;
  targets: number;
  withCauses: number;
  verifiedCauses: number;
  confidence: Record<string, number>;
  calls: number;
  outputTokens: number;
}

async function runOne(
  model: string,
  targets: DeltaRecord[],
  notes: PatchNoteItem[],
  ddragon: ReturnType<typeof loadDdragonSafe>
): Promise<Outcome> {
  const result = await inferIndirectCandidates(targets, notes, ddragon, {
    model,
    maxDeltas: targets.length,
    maxTotalCalls: targets.length,
    cacheDir: path.join(AB_CACHE, model),
  });
  const confidence: Record<string, number> = {};
  let withCauses = 0;
  let verifiedCauses = 0;
  for (const row of result.deltas) {
    if (row.causes.length > 0) withCauses += 1;
    for (const cause of row.causes) {
      confidence[cause.confidence] = (confidence[cause.confidence] ?? 0) + 1;
      if (cause.verified) verifiedCauses += 1;
    }
  }
  return {
    model,
    targets: targets.length,
    withCauses,
    verifiedCauses,
    confidence,
    calls: result.summary.calls,
    outputTokens: result.summary.usage.outputTokens,
  };
}

async function main(): Promise<void> {
  const n = Number(arg("n", "12"));
  const challenger = arg("challenger", "claude-opus-5");

  const deltasPath = path.join(ROOT, "data", "aggregated", "deltas", "26.17_26.18.json");
  const notesPath = path.join(ROOT, "data", "aggregated", "notes", "26.18.json");
  const deltas = JSON.parse(fs.readFileSync(deltasPath, "utf8")) as DeltasFile;
  const notes = (JSON.parse(fs.readFileSync(notesPath, "utf8")) as { items: PatchNoteItem[] }).items;
  const ddragon = loadDdragonSafe();

  // 개선 여지가 있는 곳 — 지금 원인이 비어 있는 미공지 행. |delta| 정렬은 파일 순서를 신뢰한다.
  const targets = deltas.rows
    .filter((row) => row.status === "unannounced" && row.causes.length === 0)
    .slice(0, n);

  if (targets.length === 0) {
    console.log("[llm-ab] 대상 없음 — 비교할 것이 없다.");
    return;
  }

  console.log(`[llm-ab] 대상 ${targets.length}건 · 기준 ${LLM_MODEL} vs 도전 ${challenger}`);
  const baseline = await runOne(LLM_MODEL, targets, notes, ddragon);
  const contender = await runOne(challenger, targets, notes, ddragon);

  for (const out of [baseline, contender]) {
    console.log(
      `  ${out.model.padEnd(20)} 원인보유 ${out.withCauses}/${out.targets} · 검증통과 ${out.verifiedCauses} · ` +
        `신뢰도 ${JSON.stringify(out.confidence)} · 호출 ${out.calls} · 출력토큰 ${out.outputTokens}`
    );
  }

  fs.mkdirSync(AB_CACHE, { recursive: true });
  fs.writeFileSync(
    path.join(AB_CACHE, "result.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), targetIds: targets.map((t) => t.id), baseline, contender }, null, 2)}\n`
  );
  console.log(`[llm-ab] 원자료: ${path.join(AB_CACHE, "result.json")}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
