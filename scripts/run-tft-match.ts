// scripts/run-tft-match.ts
// TFT 델타·짝짓기·판정 진입점 — **키가 필요 없다**(집계 산출물 + 노트 JSON만 읽는다).
// 실행: npm run pipeline:tft-match -- --from 18.1 --to 18.2 [--llm-max 120] [--no-llm] [--data-root DIR]
//
// 산출: data/aggregated/tft/deltas-{from}-{to}.json
//
// 2단(LLM)·3단(간접 영향 재분류)은 **LoL과 같은 코드**를 쓴다(`llm-match.ts`·`indirect-effect.ts`).
// 게임별로 다른 것은 프로필 하나뿐이다(`llm-profile-tft.ts`) — 지시문·지표 어휘·자기참조 판정.
// 2026-09-20 이전에는 이 스크립트가 1단에서 끝나 TFT 556행의 `causes`가 전부 비어 있었고,
// 화면은 "무근거는 회색" 규칙에 따라 원인 줄을 통째로 생략했다(사용자 지적: "LLM분석을 통한
// 원인 유추는 안 하는 것 같다"). 그 결함의 수정 지점이 여기다.
//
// 짝짓기는 **이름 정확일치**다. TFT 노트의 엔티티는 이미 카탈로그 대조를 통과한 한국어 이름이고
// (`tft-notes-parser.ts`), 델타의 `entityName`도 같은 카탈로그에서 온 이름이라 두 축이 같은
// 어휘를 쓴다. LoL처럼 별칭·부분일치를 넣지 않은 이유는 **아직 필요하다는 증거가 없어서**다 —
// 실측 일치율을 보고 판단한다(아래 로그가 그 수치를 찍는다).

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { buildTftDeltas, type TftAggregateNamed } from "../src/pipeline/match/tft-delta";
import { reclassifyIndirectEffects } from "../src/pipeline/match/indirect-effect";
import {
  CAUSE_MAX_CHARS,
  SUMMARY_MAX_CHARS,
  inferIndirectCandidates,
  type LlmRunSummary,
} from "../src/pipeline/match/llm-match";
import { tftLlmProfile } from "../src/pipeline/match/llm-profile-tft";
import { assignStatus } from "../src/pipeline/match/verdict";
import { isReportableRecord } from "../src/pipeline/shared/reportable";
import { STATUS_SORT_PRIORITY } from "../src/pipeline/shared/status-order";
import type { DeltaRecord, MatchStatus, PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";
import { assertNoLlmDowngrade } from "./shared/llm-guard";
import { readJsonRequired } from "../src/pipeline/shared/json-file";

interface CliArgs {
  from: string;
  to: string;
  dataRoot: string;
  llmMax: number;
  noLlm: boolean;
  /** 견적만 — LLM 호출 0, 파일 기록 없음(2026-09-29). */
  dryRun: boolean;
  /** 0이면 끔. N이면 상위 N건만 묻고 파일은 쓰지 않는다. */
  llmSample: number;
}

export function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-tft-match", argv, [
    { name: "from", type: "patch", required: true },
    { name: "to", type: "patch", required: true },
    { name: "dataRoot", type: "string", default: "data" },
    { name: "llmMax", type: "number", default: 120 },
    { name: "noLlm", type: "boolean", default: false },
    { name: "dryRun", type: "boolean", default: false },
    { name: "llmSample", type: "number", default: 0 },
  ]);
  const llmMax = raw.llmMax as number;
  if (llmMax < 0) throw new Error(`run-tft-match: --llm-max 값이 올바르지 않습니다: ${String(llmMax)}`);
  return {
    from: String(raw.from),
    to: String(raw.to),
    dataRoot: String(raw.dataRoot),
    llmMax,
    noLlm: raw.noLlm === true,
    dryRun: raw.dryRun === true,
    llmSample: Math.max(0, Number(raw.llmSample)),
  };
}

function readJson<T>(file: string, what: string): T {
  return readJsonRequired<T>(file, `${what}이 없다: ${file}`);
}

/** 노트의 방향 다수결 — LoL `entity-match.ts`와 같은 규칙(buff/nerf만 세고 나머지는 중립). */
export function directionMajority(notes: readonly PatchNoteItem[]): "buff" | "nerf" | "neutral" {
  let buff = 0;
  let nerf = 0;
  for (const n of notes) {
    if (n.direction === "buff") buff += 1;
    else if (n.direction === "nerf") nerf += 1;
  }
  if (buff > nerf) return "buff";
  if (nerf > buff) return "nerf";
  return "neutral";
}

/**
 * 관측 델타의 방향 ↔ 노트 방향이 맞는지.
 * **`avgPlacement`는 부호가 반대다** — 등수는 작아져야 개선이므로, 상향 노트와 짝지으려면
 * delta가 음수여야 한다. 이걸 뒤집지 않으면 상향 패치가 전부 「불일치」로 찍힌다.
 */
export function agreesWithNote(
  metric: DeltaRecord["metric"],
  delta: number,
  noteDirection: "buff" | "nerf" | "neutral"
): "consistent" | "inconsistent" | "neutral" {
  if (noteDirection === "neutral" || delta === 0) return "neutral";
  const observedImprovement = metric === "avgPlacement" ? delta < 0 : delta > 0;
  const noteImprovement = noteDirection === "buff";
  return observedImprovement === noteImprovement ? "consistent" : "inconsistent";
}

/**
 * 짝짓기(엔티티 이름 정확일치) + 1단 판정. 순수 함수 — `main`에서 떼어낸 이유는 방향 정합 기록
 * (`directionAgreement`, 2026-09-27)을 단위 테스트로 고정하기 위해서다.
 */
export function judgeTftDeltas(
  deltas: readonly DeltaRecord[],
  notes: readonly PatchNoteItem[]
): { rows: DeltaRecord[]; matched: number } {
  const notesByEntity = new Map<string, PatchNoteItem[]>();
  for (const n of notes) {
    const list = notesByEntity.get(n.entity) ?? [];
    list.push(n);
    notesByEntity.set(n.entity, list);
  }

  let matched = 0;
  const rows: DeltaRecord[] = deltas.map((d) => {
    const hits = notesByEntity.get(d.entityName) ?? [];
    if (hits.length === 0) {
      return { ...d, status: assignStatus(d, null) };
    }
    matched += 1;
    const majority = directionMajority(hits);
    const agreement = agreesWithNote(d.metric, d.delta ?? 0, majority);
    // EntityMatchInfo는 noteIds + directionAgreement 둘뿐이다 — 다수결은 여기서 소비하고 끝난다.
    const status = assignStatus(d, { noteIds: hits.map((h) => h.id), directionAgreement: agreement });
    return {
      ...d,
      status,
      // 화면이 "방향 반대"와 "방향을 말할 수 없음(동률)"을 가른다 — LoL `applyVerdicts`와 같은 계약.
      directionAgreement: agreement,
      matchedNoteId: hits[0].id,
      matchedNoteIds: hits.map((h) => h.id),
      evidence: { ...d.evidence, noteAnchor: hits[0].anchorUrl },
    };
  });
  return { rows, matched };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.join(args.dataRoot, "aggregated", "tft");

  const before = readJson<TftAggregateNamed>(path.join(dir, `boards-${args.from}.json`), `${args.from} 집계`);
  const after = readJson<TftAggregateNamed>(path.join(dir, `boards-${args.to}.json`), `${args.to} 집계`);
  const notesFile = path.join(dir, `notes-${args.to}.json`);
  const notes = readJson<{ items: PatchNoteItem[] }>(notesFile, `${args.to} 노트`).items;

  console.log(`[tft-match] ${args.from}(보드 ${before.boards}) → ${args.to}(보드 ${after.boards}) · 노트 ${notes.length}건`);

  const deltas = buildTftDeltas(before, after);
  console.log(`[tft-match] 델타 ${deltas.length}건`);

  const notesById = new Map(notes.map((n) => [n.id, n] as const));
  const { rows: judged, matched } = judgeTftDeltas(deltas, notes);

  const matchedEntities = new Set(judged.filter((d) => d.matchedNoteIds.length > 0).map((d) => d.entityName));
  console.log(
    `[tft-match] 짝지어진 델타 ${matched}/${deltas.length} · 노트가 붙은 엔티티 ${matchedEntities.size}/${new Set(deltas.map((d) => d.entityName)).size}`
  );

  // LoL·PUBG와 **같은 정렬**(status-order.ts 단일 소스)로 정렬한다.
  judged.sort(
    (a, z) =>
      STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[z.status] ||
      Math.abs(z.delta ?? 0) - Math.abs(a.delta ?? 0)
  );

  // ── 2단(LLM)·3단(간접 영향 재분류) ────────────────────────────────────
  // **정렬이 LLM보다 먼저다**: `inferIndirectCandidates`가 `.slice(0, maxDeltas)`로 상위 N건만
  // 고르므로, 정렬 전에 부르면 "상위 N건"이 그냥 순회 순서 앞쪽이 된다(run-match.ts와 같은 규약).
  let final = judged;
  let llmSummary: LlmRunSummary | undefined;
  let indirectEffectCount = 0;
  // 키가 없어도 2단은 돈다(2026-09-29) — 캐시 전용이 로컬 기본이고, 미스가 있으면 엔진이 견적과 함께 멈춘다.
  // 예전의 「키 없음 → 조용히 회색」은 그 산출물이 커밋되면 이미 산 원인을 덮었다.
  const llmSkipReason = args.noLlm ? "--no-llm" : null;
  const llmMax = args.llmSample > 0 ? args.llmSample : args.llmMax;
  if (llmSkipReason === null) {
    const result = await inferIndirectCandidates(final, notes, tftLlmProfile, {
      maxDeltas: llmMax,
      planOnly: args.dryRun,
      // 호출 총 상한은 엔진이 maxDeltas에서 유도한다(`totalCallCapFor` — 대상 수 + 재요청 여유 40).
      // 전엔 여기서 `llmMax + 40`을 직접 넘겼고 LoL은 그걸 빠뜨려 150에 묶였다(2026-10-06).
    });
    final = result.deltas;
    llmSummary = result.summary;

    const reclassified = reclassifyIndirectEffects(final, notesById);
    final = reclassified.deltas;
    indirectEffectCount = reclassified.reclassifiedCount;
    final.sort(
      (a, z) =>
        STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[z.status] ||
        Math.abs(z.delta ?? 0) - Math.abs(a.delta ?? 0)
    );

    const s = llmSummary;
    console.log(
      `[tft-match] LLM 2단: calls=${s.calls} cacheHits=${s.cacheHits} skipped=${s.skipped} ` +
        `proseRepairs=${s.proseRepairs} usage(input=${s.usage.inputTokens} ` +
        `cacheRead=${s.usage.cacheReadInputTokens} output=${s.usage.outputTokens})`
    );
    console.log(
      `[tft-match] 문장 위생: 요약 ${s.prose.summaryCount}건 중 ${SUMMARY_MAX_CHARS}자 초과 ` +
        `${s.prose.summaryOverLength}건 · 원인 ${s.prose.causeCount}건 중 ${CAUSE_MAX_CHARS}자 초과 ` +
        `${s.prose.causeOverLength}건 · 명사형 종결 ${s.prose.causeNounEnding}건`
    );
    console.log(
      `[tft-match] 원인이 붙은 행: ${final.filter((d) => d.causes.length > 0).length}건 · ` +
        `3단 재분류 ${indirectEffectCount}건(unannounced → indirect-effect)`
    );
  } else {
    // 조용히 건너뛰지 않는다 — "LLM이 돌고 있다"는 착각이 이 결함군의 본질이었다.
    console.log(`[tft-match] LLM 2단 생략(${llmSkipReason}) — causes는 비어 있고 화면은 회색으로 남는다`);
  }

  const counts: Partial<Record<MatchStatus, number>> = {};
  for (const d of final) counts[d.status] = (counts[d.status] ?? 0) + 1;
  const reportable = final.filter((d) => isReportableRecord(d));
  console.log(`[tft-match] 판정: ${JSON.stringify(counts)}`);
  console.log(`[tft-match] 보고 자격(isReportableRecord): ${reportable.length}건`);

  const outFile = path.join(dir, `deltas-${args.from}-${args.to}.json`);
  if (args.dryRun || args.llmSample > 0) {
    console.log(`[tft-match] ${args.dryRun ? "--dry-run" : `--llm-sample ${args.llmSample}`} — 파일 기록 생략`);
    return;
  }
  if (args.noLlm) assertNoLlmDowngrade(outFile, final, "run-tft-match --no-llm");
  fs.writeFileSync(
    outFile,
    `${JSON.stringify(
      {
        meta: {
          game: "tft",
          from: args.from,
          to: args.to,
          generatedAt: new Date().toISOString(),
          qAlpha: 0.1,
          boards: { before: before.boards, after: after.boards },
          matches: { before: before.matches, after: after.matches },
          noteCount: notes.length,
          counts,
          llm: llmSummary
            ? {
                calls: llmSummary.calls,
                cacheHits: llmSummary.cacheHits,
                skipped: llmSummary.skipped,
                proseRepairs: llmSummary.proseRepairs,
                usage: llmSummary.usage,
                prose: llmSummary.prose,
              }
            : undefined,
        },
        rows: final,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`[tft-match] 저장: ${outFile}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[tft-match] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
