// scripts/run-tft-match.ts
// TFT 델타·짝짓기·판정 진입점 — **키가 필요 없다**(집계 산출물 + 노트 JSON만 읽는다).
// 실행: npm run pipeline:tft-match -- --from 18.1 --to 18.2 [--data-root DIR]
//
// 산출: data/aggregated/tft/deltas-{from}-{to}.json
//
// 짝짓기는 **이름 정확일치**다. TFT 노트의 엔티티는 이미 카탈로그 대조를 통과한 한국어 이름이고
// (`tft-notes-parser.ts`), 델타의 `entityName`도 같은 카탈로그에서 온 이름이라 두 축이 같은
// 어휘를 쓴다. LoL처럼 별칭·부분일치를 넣지 않은 이유는 **아직 필요하다는 증거가 없어서**다 —
// 실측 일치율을 보고 판단한다(아래 로그가 그 수치를 찍는다).

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { buildTftDeltas, type TftAggregateNamed } from "../src/pipeline/match/tft-delta";
import { assignStatus } from "../src/pipeline/match/verdict";
import { isReportableRecord } from "../src/pipeline/shared/reportable";
import { STATUS_SORT_PRIORITY } from "../src/pipeline/shared/status-order";
import type { DeltaRecord, MatchStatus, PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

interface CliArgs {
  from: string;
  to: string;
  dataRoot: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-tft-match", argv, [
    { name: "from", type: "patch", required: true },
    { name: "to", type: "patch", required: true },
    { name: "dataRoot", type: "string", default: "data" },
  ]);
  return { from: String(raw.from), to: String(raw.to), dataRoot: String(raw.dataRoot) };
}

function readJson<T>(file: string, what: string): T {
  if (!fs.existsSync(file)) throw new Error(`${what}이 없다: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.join(args.dataRoot, "aggregated", "tft");

  const before = readJson<TftAggregateNamed>(path.join(dir, `boards-${args.from}.json`), `${args.from} 집계`);
  const after = readJson<TftAggregateNamed>(path.join(dir, `boards-${args.to}.json`), `${args.to} 집계`);
  const notesFile = path.join(dir, `notes-${args.to}.json`);
  const notes = readJson<{ items: PatchNoteItem[] }>(notesFile, `${args.to} 노트`).items;

  console.log(`[tft-match] ${args.from}(보드 ${before.boards}) → ${args.to}(보드 ${after.boards}) · 노트 ${notes.length}건`);

  const deltas = buildTftDeltas(before, after);
  console.log(`[tft-match] 델타 ${deltas.length}건`);

  // ── 짝짓기: 엔티티 이름 정확일치 ──────────────────────────────────────
  const notesByEntity = new Map<string, PatchNoteItem[]>();
  for (const n of notes) {
    const list = notesByEntity.get(n.entity) ?? [];
    list.push(n);
    notesByEntity.set(n.entity, list);
  }

  let matched = 0;
  const judged: DeltaRecord[] = deltas.map((d) => {
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
      matchedNoteId: hits[0].id,
      matchedNoteIds: hits.map((h) => h.id),
      evidence: { ...d.evidence, noteAnchor: hits[0].anchorUrl },
    };
  });

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

  const counts: Partial<Record<MatchStatus, number>> = {};
  for (const d of judged) counts[d.status] = (counts[d.status] ?? 0) + 1;
  const reportable = judged.filter((d) => isReportableRecord(d));
  console.log(`[tft-match] 판정: ${JSON.stringify(counts)}`);
  console.log(`[tft-match] 보고 자격(isReportableRecord): ${reportable.length}건`);

  const outFile = path.join(dir, `deltas-${args.from}-${args.to}.json`);
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
        },
        rows: judged,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`[tft-match] 저장: ${outFile}`);
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    console.error(`[tft-match] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
