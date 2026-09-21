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

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { diffLol, type DdragonSnapshot } from "../src/pipeline/gamedata/lol";
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

  if (game !== "lol") {
    // TFT는 Community Dragon 채택(SCOPE §3 갱신)이 선행이고, PUBG는 텔레메트리 격자 경로가 따로다.
    throw new Error(`TODO(gamedata): '${game}' 어댑터 미구현 — 현재 'lol'만 지원한다`);
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

  const out = join(dataRoot, "aggregated", "gamedata", game, `${from}_${to}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`, "utf8");

  console.log(`[gamedata] 수치 변경 ${changes.length}건 · 그중 노트에 없는 것 ${submarines.length}건`);
  for (const s of submarines) {
    console.log(`[gamedata]   ★ ${s.entityName} ${s.field}: ${s.before} → ${s.after}`);
  }
  console.log(`[gamedata] 저장: ${out}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
