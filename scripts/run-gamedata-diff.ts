// scripts/run-gamedata-diff.ts
// F9 — 게임사가 배포한 **원본 수치**를 패치 간 대조해 패치노트에 없는 변경(잠수함 패치)을 찾는다.
//
// 이 단계는 기존 F1~F4(수집→집계→매칭→판정)와 **직교**한다. 판정 파이프라인은 지표가 어떻게
// 움직였나만 보고, 여기는 무엇이 실제로 바뀌었나를 본다. 산출물도 섞지 않는다 —
// `data/aggregated/gamedata/{game}/{from}_{to}.json`로 따로 낸다(기존 판정 산출물 불변 제약).
//
// 사용:
//   npm run pipeline:gamedata-diff -- --game lol --from 26.16 --to 26.17 \
//     --version-from 16.16.1 --version-to 16.17.1

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { diffLol, type DdragonSnapshot } from "../src/pipeline/gamedata/lol";
import {
  compareGrids,
  expandPubgNotes,
  gridToChanges,
  mergeGrids,
  type DamageGrid,
  type PubgNoteLike,
} from "../src/pipeline/gamedata/pubg";
import { PUBG_PATCH_WINDOWS } from "../src/pipeline/collect/pubg/patch-calendar";
import { diffTft, type CdragonSnapshot } from "../src/pipeline/gamedata/tft";
import { isSubmarineChange, type GameDataDiffFile } from "../src/pipeline/gamedata/types";
import type { NoteLike } from "../src/pipeline/gamedata/note-link";
import { isMainModule, parseCliArgs } from "./shared/cli";

interface DdragonListFile {
  readonly data: Record<string, unknown>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * 한 버전의 DDragon 스냅숏. `champions/` 하위가 있으면 스킬 수치까지 읽는다 — 없으면 기본 능력치와
 * 아이템만 본다(스킬 축은 조용히 빠지는 것이 아니라 **아래 로그가 그 사실을 말한다**).
 */
function loadDdragon(dataRoot: string, version: string): DdragonSnapshot {
  const base = join(dataRoot, "ddragon", version);
  const champions = readJson<DdragonListFile>(join(base, "champion.json")).data;
  const items = readJson<DdragonListFile>(join(base, "item.json")).data;

  // 스킬 수치는 `spells.json`(run-ddragon ST-4가 남긴 축약형)에서 읽는다. 원본 챔피언 상세
  // 응답 전체는 버전당 10MB라 커밋하지 않는다.
  const spellsPath = join(base, "spells.json");
  const spells = existsSync(spellsPath) ? readJson<Record<string, unknown>>(spellsPath) : {};

  return { version, champions, items, spells } as DdragonSnapshot;
}

function loadNotes(dataRoot: string, game: string, patch: string): NoteLike[] {
  const path =
    game === "lol"
      ? join(dataRoot, "aggregated", "notes", `${patch}.json`)
      : join(dataRoot, "aggregated", game, `notes-${patch}.json`);
  const parsed = readJson<{ items?: NoteLike[] } | NoteLike[]>(path);
  return Array.isArray(parsed) ? parsed : (parsed.items ?? []);
}

interface ReducedMatchFile {
  readonly patch?: string | null;
  readonly matchType?: string | null;
  readonly damageGrid?: DamageGrid;
}

/** 부위별 최소 히트 — 못 채우면 판정하지 않는다(`insufficient-sample`과 같은 규율). */
const PUBG_MIN_HITS = 120;

/**
 * PUBG는 게임사가 수치 파일을 내지 않으므로 축약본의 **피해 격자**를 읽는다. 격자가 없는 축약본은
 * ST-6 이전에 만들어진 것이라 건너뛴다 — 조용히 0으로 세지 않고 아래에서 수를 보고한다.
 */
async function runPubg(dataRoot: string, from: string, to: string): Promise<void> {
  const dir = join(dataRoot, "raw", "pubg", "telemetry-reduced");
  if (!existsSync(dir)) throw new Error(`run-gamedata-diff: ${dir} 없음 — 먼저 수집이 필요하다`);

  // 축약본의 `patch`는 텔레메트리 라벨(`pc-2018-43`)이고 인자는 표기(`43.1`)다 — 캘린더가 그
  // 대응을 소유한다(`PubgPatchWindow.telemetryPatch`). 여기서 따로 문자열을 만들지 않는다.
  const telemetryLabel = (patch: string): string => {
    const window = PUBG_PATCH_WINDOWS.find((w) => w.patch === patch);
    if (!window) throw new Error(`run-gamedata-diff: PUBG 패치 '${patch}'가 캘린더에 없다`);
    return window.telemetryPatch;
  };
  const labelFrom = telemetryLabel(from);
  const labelTo = telemetryLabel(to);

  const grids: Record<string, DamageGrid[]> = { [labelFrom]: [], [labelTo]: [] };
  let withGrid = 0;
  let withoutGrid = 0;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const m = readJson<ReducedMatchFile>(join(dir, file));
    if (m.matchType !== "official") continue;
    const patch = m.patch ?? "";
    if (!(patch in grids)) continue;
    if (!m.damageGrid) {
      withoutGrid += 1;
      continue;
    }
    withGrid += 1;
    grids[patch].push(m.damageGrid);
  }

  console.log(
    `[gamedata] pubg ${from} → ${to} · 격자 보유 축약본 ${withGrid}건 · 미보유 ${withoutGrid}건`
  );
  if (withoutGrid > 0) {
    console.log("[gamedata] ::warning:: 격자 없는 축약본은 ST-6 이전 생성분이다 — 재수집이 필요하다");
  }

  const before = mergeGrids(grids[labelFrom]);
  const after = mergeGrids(grids[labelTo]);
  const shifts = compareGrids(before, after, { minHits: PUBG_MIN_HITS });
  // PUBG 노트는 `entity`가 없고 `weaponKeys`를 갖는다 — 펴지 않으면 전부 잠수함으로 읽힌다.
  const notes = expandPubgNotes(
    readJson<{ items?: PubgNoteLike[] }>(join(dataRoot, "aggregated", "pubg", `notes-${to}.json`)).items ?? []
  );
  const changes = gridToChanges(shifts, notes, to);
  const submarines = changes.filter(isSubmarineChange);

  const weaponsCompared = Object.keys(after).filter((w) => before[w]).length;
  console.log(
    `[gamedata] 무기 ${weaponsCompared}종 비교 · 격자 이동 ${shifts.length}건 · 그중 노트에 없는 것 ${submarines.length}건`
  );
  for (const s of shifts) {
    const name = `${s.weapon} ${s.reason}`;
    console.log(
      `[gamedata]   ${name}: ${s.before} → ${s.after} (×${s.shiftRatio.toFixed(3)} · 겹침 ${s.overlapBefore.toFixed(2)} → ${s.overlapAfter.toFixed(2)} · n ${s.nBefore}/${s.nAfter})`
    );
  }
  for (const s of submarines) {
    console.log(`[gamedata]   ★ ${s.entityName} ${s.field}: ${s.before} → ${s.after}`);
  }

  writeDiff(dataRoot, {
    meta: {
      game: "pubg",
      from,
      to,
      source: { kind: "telemetry-grid", from, to },
      generatedAt: new Date().toISOString(),
      changeCount: changes.length,
      submarineCount: submarines.length,
    },
    changes,
  });
}

/**
 * TFT는 Community Dragon 수치 추출본을 읽는다(SCOPE §3, 2026-09-21). 원본 응답은 버전당 24MB라
 * 커밋하지 않고 수치 필드만 `data/cdragon/{version}/tft.json`에 남긴다.
 */
function runTft(dataRoot: string, from: string, to: string, vFrom: string, vTo: string): void {
  const load = (version: string): CdragonSnapshot => ({
    version,
    ...readJson<Omit<CdragonSnapshot, "version">>(join(dataRoot, "cdragon", version, "tft.json")),
  });
  const notes = loadNotes(dataRoot, "tft", to);
  const changes = diffTft(load(vFrom), load(vTo), notes, to);
  const submarines = changes.filter(isSubmarineChange);

  console.log(
    `[gamedata] tft ${from} → ${to} · CDragon ${vFrom} → ${vTo} · 노트 ${notes.length}건`
  );
  console.log(`[gamedata] 수치 변경 ${changes.length}건 · 그중 노트에 없는 것 ${submarines.length}건`);
  for (const s of submarines.slice(0, 10)) {
    console.log(`[gamedata]   ★ ${s.entityName} ${s.field}: ${s.before} → ${s.after}`);
  }
  if (submarines.length > 10) console.log(`[gamedata]   … 외 ${submarines.length - 10}건`);

  writeDiff(dataRoot, {
    meta: {
      game: "tft",
      from,
      to,
      source: { kind: "cdragon", from: vFrom, to: vTo },
      generatedAt: new Date().toISOString(),
      changeCount: changes.length,
      submarineCount: submarines.length,
    },
    changes,
  });
}

function writeDiff(dataRoot: string, file: GameDataDiffFile): void {
  const out = join(dataRoot, "aggregated", "gamedata", file.meta.game, `${file.meta.from}_${file.meta.to}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(`[gamedata] 저장: ${out}`);
}

async function main(): Promise<void> {
  const args = parseCliArgs("run-gamedata-diff", process.argv.slice(2), [
    { name: "game", type: "string", required: true },
    { name: "from", type: "patch", required: true },
    { name: "to", type: "patch", required: true },
    { name: "versionFrom", type: "string" },
    { name: "versionTo", type: "string" },
    { name: "dataRoot", type: "string", default: "data" },
  ]);

  const game = String(args.game);
  const from = String(args.from);
  const to = String(args.to);
  const dataRoot = String(args.dataRoot);

  if (game === "pubg") {
    await runPubg(dataRoot, from, to);
    return;
  }
  if (game === "tft") {
    const vFrom = String(args.versionFrom ?? "");
    const vTo = String(args.versionTo ?? "");
    if (!vFrom || !vTo) {
      throw new Error("run-gamedata-diff: TFT는 --version-from/--version-to(Community Dragon 버전)가 필요하다");
    }
    runTft(dataRoot, from, to, vFrom, vTo);
    return;
  }
  if (game !== "lol") {
    throw new Error(`TODO(gamedata): '${game}' 어댑터 미구현 — 현재 'lol'·'tft'·'pubg'만 지원한다`);
  }

  const versionFrom = String(args.versionFrom ?? "");
  const versionTo = String(args.versionTo ?? "");
  if (!versionFrom || !versionTo) {
    throw new Error("run-gamedata-diff: --version-from/--version-to가 필요하다(DDragon 버전)");
  }

  const before = loadDdragon(dataRoot, versionFrom);
  const after = loadDdragon(dataRoot, versionTo);
  const notes = loadNotes(dataRoot, game, to);

  const spellCoverage = Object.keys(after.spells).length;
  console.log(
    `[gamedata] ${game} ${from} → ${to} · DDragon ${versionFrom} → ${versionTo} · 노트 ${notes.length}건 · 스킬 수치 ${spellCoverage}종`
  );
  if (spellCoverage === 0) {
    console.log("[gamedata] ::warning:: 스킬 수치 미보존 — 기본 능력치·아이템만 대조한다(ST-4 참고)");
  }

  const changes = diffLol(before, after, notes, to);
  const submarines = changes.filter(isSubmarineChange);

  const file: GameDataDiffFile = {
    meta: {
      game,
      from,
      to,
      source: { kind: "ddragon", from: versionFrom, to: versionTo },
      generatedAt: new Date().toISOString(),
      changeCount: changes.length,
      submarineCount: submarines.length,
    },
    changes,
  };

  console.log(`[gamedata] 수치 변경 ${changes.length}건 · 그중 노트에 없는 것 ${submarines.length}건`);
  for (const s of submarines) {
    console.log(`[gamedata]   ★ ${s.entityName} ${s.field}: ${s.before} → ${s.after}`);
  }
  writeDiff(dataRoot, file);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
