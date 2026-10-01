// scripts/run-llm-compare.ts
// 모델별 품질 비교(2026-09-30, 사용자 결정 — 「한도·추론강도 낮춤은 원치 않고, 모델별 비교로 퀄리티를 재서 모델
// 하향을 결정」). **모델을 바꾸지 않는다** — `LLM_MODEL`은 SCOPE §3 고정값이고, 채택은 사람이 한다.
// run-llm-ab.ts(9/17, LoL 전용·원인 빈 행만)의 일반화: 세 게임 · 운영과 같은 입력 · 같은 대상.
//
// 공정성 규칙:
//  - 기준(운영 모델)은 **운영 캐시만** 읽는다(`maxTotalCalls: 0` — 호출 0, 비용 0). 운영 답과 같은 것을 잰다.
//  - 대상은 운영이 LLM에 물었던 상태 그대로다 — 3단이 `indirect-effect`로 재분류한 행은 `unannounced`로 되돌려
//    넣는다(안 그러면 원인이 강했던 행이 빠져 표본이 기준 모델에 불리하게 기운다).
//  - 도전 모델은 별도 cacheDir(data/cache/llm-ab/{model}, gitignore) — 운영 캐시에 섞이지 않는다.
//  - 지표는 운영 게이트 그대로(verifyCauses·요약 인용·수치 사실성·문장 위생). 임계를 따로 두지 않는다.
//
// 사용: npx tsx scripts/run-llm-compare.ts --game lol|tft|pubg [--n 20] [--models claude-sonnet-5,claude-haiku-4-5-20251001] [--plan] [--baseline-calls] [--run N]
//      실제 호출은 PATCHGAP_LLM=1 (호출 정책). --plan은 견적만.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { inferIndirectCandidates, LLM_MODEL, type LlmRunSummary } from "../src/pipeline/match/llm-match";
import { loadDdragonSafe } from "../src/pipeline/match/ddragon";
import { lolLlmProfile } from "../src/pipeline/match/llm-profile-lol";
import { tftLlmProfile } from "../src/pipeline/match/llm-profile-tft";
import type { GameLlmProfile, LlmDelta } from "../src/pipeline/match/llm-profile";
import type { DeltasFile, PatchNoteItem } from "../src/pipeline/types";
import { loadPubgLlmInputs } from "./run-pubg-llm";
import { isMainModule } from "./shared/cli";

const ROOT = process.cwd();
const AB_ROOT = path.join(ROOT, "data", "cache", "llm-ab");

/** 1M 토큰당 USD(입력·출력·캐시쓰기·캐시읽기) — 추정용. 청구 단가가 바뀌면 여기만 고친다. */
const PRICE: Record<string, [number, number, number, number]> = {
  "claude-opus-5": [5, 25, 6.25, 0.5],
  "claude-sonnet-5": [2, 10, 2.5, 0.2],
  "claude-haiku-4-5-20251001": [1, 5, 1.25, 0.1],
  // 5.5 세대 — claude.com/pricing 확인(2026-10-01). Opus 5.5가 Opus 5보다 싸다.
  "claude-opus-5-5": [4, 20, 5, 0.2],
  "claude-sonnet-5-5": [2, 10, 2.5, 0.2],
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

interface GameInputs {
  rows: LlmDelta[];
  notes: PatchNoteItem[];
  // 게임마다 델타 타입이 달라 엔진 제네릭을 여기서 닫는다.
  profile: GameLlmProfile<LlmDelta>;
  pair: string;
}

function loadInputs(game: string): GameInputs {
  if (game === "lol") {
    const dir = path.join(ROOT, "data", "aggregated", "deltas");
    const file = fs.readdirSync(dir).filter((f) => /^\d+\.\d+_\d+\.\d+\.json$/.test(f)).sort().at(-1)!;
    const to = file.replace(".json", "").split("_")[1];
    const deltas = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as DeltasFile;
    const notes = (JSON.parse(fs.readFileSync(path.join(ROOT, "data", "aggregated", "notes", `${to}.json`), "utf8")) as { items: PatchNoteItem[] }).items;
    return { rows: deltas.rows, notes, profile: lolLlmProfile(loadDdragonSafe()) as unknown as GameLlmProfile<LlmDelta>, pair: file.replace(".json", "") };
  }
  if (game === "tft") {
    const dir = path.join(ROOT, "data", "aggregated", "tft");
    const file = fs.readdirSync(dir).filter((f) => /^deltas-.*\.json$/.test(f)).sort().at(-1)!;
    const to = file.replace(/^deltas-[^-]+-/, "").replace(".json", "");
    const deltas = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as DeltasFile;
    const notes = (JSON.parse(fs.readFileSync(path.join(dir, `notes-${to}.json`), "utf8")) as { items: PatchNoteItem[] }).items;
    return { rows: deltas.rows, notes, profile: tftLlmProfile as unknown as GameLlmProfile<LlmDelta>, pair: file };
  }
  if (game === "pubg") {
    const { deltas, candidates, profile } = loadPubgLlmInputs();
    return {
      rows: deltas.rows as unknown as LlmDelta[],
      notes: candidates,
      profile: profile as unknown as GameLlmProfile<LlmDelta>,
      pair: `${String(deltas.meta.from)}_${deltas.meta.to}`,
    };
  }
  throw new Error(`--game은 lol|tft|pubg: ${game}`);
}

interface ModelOutcome {
  model: string;
  targets: number;
  answered: number;
  failed: Record<string, number>;
  rowsWithVerifiedCause: number;
  verifiedCauses: number;
  grayCauses: number;
  confidence: Record<string, number>;
  summaryVerified: number;
  summaryDeterministic: number;
  prose: LlmRunSummary["prose"];
  calls: number;
  usd: number;
  byId: Record<string, { summary: string | null; causes: { text: string; note: string | null; verified: boolean; confidence: string }[] }>;
}

function usdOf(model: string, s: LlmRunSummary): number {
  const [i, o, cw, cr] = PRICE[model] ?? [0, 0, 0, 0];
  const u = s.usage;
  return (u.inputTokens * i + u.outputTokens * o + u.cacheCreationInputTokens * cw + u.cacheReadInputTokens * cr) / 1e6;
}

async function runModel(
  model: string,
  inputs: GameInputs,
  targets: LlmDelta[],
  baseline: boolean,
  planOnly: boolean,
  allowBaselineCalls = false,
  run = 1
): Promise<ModelOutcome> {
  const result = await inferIndirectCandidates(targets, inputs.notes, inputs.profile, {
    model,
    maxDeltas: targets.length,
    // 기준은 운영 캐시만(호출 0). 운영 캐시가 없어진 쌍(예: TFT 18.3 — CI 캐시 휘발)만 --baseline-calls로
    // 운영 모델을 **운영 캐시에** 부른다: 같은 키라 다음 운영 실행이 그대로 재사용한다(이중 지출 아님).
    maxTotalCalls: baseline && !allowBaselineCalls ? 0 : targets.length * 2,
    // 다회 표본(2026-10-01): 2회차부터는 회차별 디렉토리 — 같은 키라도 새로 부르게 해 실행 간 편차를 잰다.
    cacheDir: baseline ? undefined : run > 1 ? path.join(AB_ROOT, `run-${run}`, model) : path.join(AB_ROOT, model),
    planOnly,
  });
  const out: ModelOutcome = {
    model,
    targets: targets.length,
    answered: 0,
    failed: {},
    rowsWithVerifiedCause: 0,
    verifiedCauses: 0,
    grayCauses: 0,
    confidence: {},
    summaryVerified: 0,
    summaryDeterministic: 0,
    prose: result.summary.prose,
    calls: result.summary.calls,
    usd: usdOf(model, result.summary),
    byId: {},
  };
  for (const row of result.deltas) {
    const llm = row.llm;
    if (!llm) continue;
    if (llm.skipped) {
      out.failed[llm.reason ?? "unknown"] = (out.failed[llm.reason ?? "unknown"] ?? 0) + 1;
      continue;
    }
    out.answered += 1;
    const causes = row.causes ?? [];
    if (causes.some((c) => c.verified)) out.rowsWithVerifiedCause += 1;
    for (const c of causes) {
      out.confidence[c.confidence] = (out.confidence[c.confidence] ?? 0) + 1;
      if (c.verified) out.verifiedCauses += 1;
      else out.grayCauses += 1;
    }
    if (llm.summaryVerified) out.summaryVerified += 1;
    if (llm.summaryDeterministic) out.summaryDeterministic += 1;
    out.byId[row.id] = {
      summary: llm.summary ?? null,
      causes: causes.map((c) => ({ text: c.text, note: c.candidateNoteId, verified: c.verified, confidence: c.confidence })),
    };
  }
  return out;
}

/** 기준 대비 일치 — 둘 다 답한 행에서, 검증 통과 인용 노트가 하나라도 겹치나 / 기준만 찾음 / 도전만 찾음. */
function agreement(base: ModelOutcome, other: ModelOutcome) {
  let both = 0, overlap = 0, baseOnly = 0, otherOnly = 0;
  for (const [id, b] of Object.entries(base.byId)) {
    const o = other.byId[id];
    if (!o) continue;
    both += 1;
    const bs = new Set(b.causes.filter((c) => c.verified).map((c) => c.note));
    const os = new Set(o.causes.filter((c) => c.verified).map((c) => c.note));
    if (bs.size > 0 && os.size > 0 && [...bs].some((n) => os.has(n))) overlap += 1;
    if (bs.size > 0 && os.size === 0) baseOnly += 1;
    if (os.size > 0 && bs.size === 0) otherOnly += 1;
  }
  return { both, overlap, baseOnly, otherOnly };
}

async function main(): Promise<void> {
  const game = arg("game", "lol");
  const n = Number(arg("n", "20"));
  const models = arg("models", "claude-sonnet-5,claude-haiku-4-5-20251001").split(",").filter(Boolean);
  const planOnly = process.argv.includes("--plan");
  const allowBaselineCalls = process.argv.includes("--baseline-calls");
  const run = Number(arg("run", "1"));
  const inputs = loadInputs(game);

  // 운영이 물었던 상태로 되돌린다 — 3단 재분류 이전.
  const asAsked = inputs.rows.map((row) =>
    row.status === "indirect-effect" ? ({ ...row, status: "unannounced", causes: [], llm: undefined } as LlmDelta) : ({ ...row, causes: [], llm: undefined } as LlmDelta)
  );
  const isTarget = inputs.profile.isTarget ?? ((d: LlmDelta) => d.status === "unannounced" || d.status === "announced-inconsistent");
  const targets = asAsked.filter((d) => isTarget(d)).slice(0, n);
  console.log(`[llm-compare] ${game} ${inputs.pair} · 대상 ${targets.length}건 · 기준 ${LLM_MODEL}(운영 캐시) vs ${models.join(", ")}`);

  const baseline = await runModel(LLM_MODEL, inputs, targets, true, planOnly, allowBaselineCalls);
  const others: ModelOutcome[] = [];
  for (const model of models) others.push(await runModel(model, inputs, targets, false, planOnly, false, run));
  if (planOnly) return;

  for (const out of [baseline, ...others]) {
    const ag = out === baseline ? null : agreement(baseline, out);
    console.log(
      `  ${out.model.padEnd(26)} 답 ${out.answered}/${out.targets} · 실패 ${JSON.stringify(out.failed)} · 검증원인 보유행 ${out.rowsWithVerifiedCause} · ` +
        `검증 ${out.verifiedCauses}/회색 ${out.grayCauses} · 신뢰도 ${JSON.stringify(out.confidence)} · 요약검증 ${out.summaryVerified} · 결정론대체 ${out.summaryDeterministic} · ` +
        `문장위반(요약초과 ${out.prose.summaryOverLength}·완곡 ${out.prose.summaryHedged}·원인초과 ${out.prose.causeOverLength}) · 호출 ${out.calls} · $${out.usd.toFixed(3)}` +
        (ag ? ` · 기준대비 일치 ${ag.overlap}/${ag.both}·기준만 ${ag.baseOnly}·도전만 ${ag.otherOnly}` : "")
    );
  }
  fs.mkdirSync(AB_ROOT, { recursive: true });
  const outFile = path.join(AB_ROOT, run > 1 ? `compare-${game}-run${run}.json` : `compare-${game}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), game, pair: inputs.pair, targetIds: targets.map((t) => t.id), baseline, others }, null, 2)}\n`);
  console.log(`[llm-compare] 원자료: ${path.relative(ROOT, outFile)}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
