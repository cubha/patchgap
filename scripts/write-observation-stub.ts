// scripts/write-observation-stub.ts
// 관측 stub 판정 파일 쓰기(2026-09-28, C13·C14 — 사용자 결정 D5·D6).
// 실행: npx tsx scripts/write-observation-stub.ts --game tft --from 18.3 --to 18.4 --reason awaiting-observation [--detail "…"]
//       부분 수집: --reason collecting --progress '[{"patch":"18.4","stored":813,"target":2500}]'
//
// 수집 워크플로의 선언 경로(패치 직후·키 없음)와 관측 실패 경로(`if: failure()`)가 부른다. 규칙은
// `src/pipeline/shared/observation-stub.ts`에 있고 여기는 I/O뿐이다.
//
// **실제 관측 산출물은 절대 덮지 않는다** — 같은 쌍의 관측 판정 파일이 있으면 쓰지 않고 끝난다(종료 0).
// 있는 관측을 stub으로 바꾸면 화면을 뒤로 돌린다. 노트 파일이 없으면 던진다 — 선언 축이 없는 stub은
// 화면에 빈 쌍만 올린다(그건 stub이 아니라 결함이다).
import fs from "node:fs";
import path from "node:path";
import { buildObservationStub, deltasStateOf, parseObservationProgress } from "../src/pipeline/shared/observation-stub";
import type { ObservationFailReason, ObservationProgress } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

const REASONS: readonly ObservationFailReason[] = [
  "awaiting-observation",
  "key-expired",
  "product-unapproved",
  "key-missing",
  "crashed",
  "window-lost",
  "collecting",
];

function isReason(value: string): value is ObservationFailReason {
  return (REASONS as readonly string[]).includes(value);
}

export interface StubTarget {
  /** stub을 쓸 파일 — TFT는 그 쌍의 판정 파일, PUBG는 `declaration.json`. */
  deltasFile: string;
  /** 같은 쌍의 **실제 관측**이 있는지 볼 파일 — TFT는 위와 같고, PUBG는 관측 `deltas.json`. */
  observedFile: string;
  notesFile: string;
}

/**
 * 게임별 파일 위치 — TFT는 쌍마다 판정 파일, PUBG는 관측 `deltas.json` **하나**라 stub을 거기 쓰면 이전 쌍의 관측을 지운다
 * (2026-10-09 전까지 실제로 그랬다 — 홈이 관측을 잃고 선언 뷰로 떨어지는 결함, TFT 18.4에서 사용자가 지적한 것과 같은 자리).
 * 그래서 PUBG stub은 `declaration.json`에 따로 산다(PLAN-home-observed-pair ST-9). 로더(`lib/pubgData`)가 관측·선언 두 파일을
 * 보고 "관측 쌍보다 새 stub"만 선언만 쌍으로 고른다.
 */
export function stubTarget(game: "tft" | "pubg", dataRoot: string, from: string, to: string): StubTarget {
  const dir = path.join(dataRoot, "aggregated", game);
  const observedFile = path.join(dir, game === "tft" ? `deltas-${from}-${to}.json` : "deltas.json");
  return {
    deltasFile: game === "tft" ? observedFile : path.join(dir, "declaration.json"),
    observedFile,
    notesFile: path.join(dir, `notes-${to}.json`),
  };
}

/** 쓰면 `true`, 같은 쌍의 실제 관측이 있어 건너뛰면 `false`. */
export function writeObservationStub(
  game: "tft" | "pubg",
  dataRoot: string,
  from: string,
  to: string,
  reason: ObservationFailReason,
  detail: string,
  progress?: readonly ObservationProgress[]
): boolean {
  const target = stubTarget(game, dataRoot, from, to);
  if (!fs.existsSync(target.notesFile)) {
    throw new Error(`write-observation-stub: ${target.notesFile}가 없다 — 선언 축 없는 stub은 쓰지 않는다`);
  }
  const existing = fs.existsSync(target.observedFile) ? (JSON.parse(fs.readFileSync(target.observedFile, "utf8")) as unknown) : null;
  if (deltasStateOf(existing, from, to).kind === "observed") return false;
  const notes = JSON.parse(fs.readFileSync(target.notesFile, "utf8")) as { items?: unknown[] };
  const failure = { reason, detail, at: new Date().toISOString(), ...(progress && progress.length > 0 ? { progress: [...progress] } : {}) };
  const stub = buildObservationStub(game, from, to, failure, notes.items?.length ?? 0);
  fs.mkdirSync(path.dirname(target.deltasFile), { recursive: true });
  fs.writeFileSync(target.deltasFile, `${JSON.stringify(stub, null, 2)}\n`, "utf8");
  return true;
}

function main(): void {
  const raw = parseCliArgs("write-observation-stub", process.argv.slice(2), [
    { name: "game", type: "string", required: true },
    { name: "from", type: "patch", required: true },
    { name: "to", type: "patch", required: true },
    { name: "reason", type: "string", required: true },
    { name: "detail", type: "string", default: "" },
    { name: "progress", type: "string" },
    { name: "dataRoot", type: "string", default: "data" },
  ]);
  const game = String(raw.game);
  const reason = String(raw.reason);
  if (game !== "tft" && game !== "pubg") throw new Error(`write-observation-stub: --game은 tft|pubg: ${game}`);
  if (!isReason(reason)) throw new Error(`write-observation-stub: 모르는 사유: ${reason}`);
  // 빈 문자열은 "진행 없음"(부분 수집이 아닌 선언 경로에서 워크플로가 빈 출력을 넘긴다).
  const progress = typeof raw.progress === "string" && raw.progress.trim() !== "" ? parseObservationProgress(raw.progress) : undefined;
  const wrote = writeObservationStub(game, String(raw.dataRoot), String(raw.from), String(raw.to), reason, String(raw.detail), progress);
  console.log(
    wrote
      ? `[observation-stub] ${game} ${String(raw.from)} → ${String(raw.to)} stub 기록(${reason})`
      : `[observation-stub] ${game} ${String(raw.from)} → ${String(raw.to)} 실제 관측이 있어 그대로 둔다`
  );
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    console.error(`[observation-stub] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
