// scripts/run-tft-assets.ts
// TFT 엔티티 자산 조달(빌드 이전) — Data Dragon의 `tft-champion`·`tft-trait`·`tft-item` 카탈로그를
// 읽어 이 패치 집계에 실제로 등장한 대상의 이미지만 `public/dd/tft/` 아래에 둔다.
//
// **`public/dd/`(LoL)·`public/pubg/`와 같은 구조다**: 런타임에 외부를 부르지 않기 위해 자산을
// 저장소에 커밋한다. 세트가 바뀌면 키가 통째로 바뀌므로(`DA_18_*` → `DA_19_*`) 패치마다 돌린다.
//
// **전 카탈로그를 받지 않는다**: `tft-champion.json`은 334항목이고 그중 현행 세트는 64개다.
// 쓰지 않을 이미지를 커밋하면 저장소만 무거워진다 — **집계에 등장한 키**만 받는다.
//
// 실행: npx tsx scripts/run-tft-assets.ts [--version 16.18.1] [--patch 18.2]
import fs from "node:fs";
import path from "node:path";
import {
  publicTftAssetPath,
  remoteTftCatalogUrl,
  remoteTftImageUrl,
  type TftAssetKind,
  type TftAssetManifest,
} from "../src/pipeline/tft/asset-path";
import { isMainModule, parseCliArgs } from "./shared/cli";

const ROOT = process.cwd();
const AGG_DIR = path.join(ROOT, "data", "aggregated", "tft");
const MANIFEST = path.join(AGG_DIR, "assets.json");

interface DdEntry {
  image?: { full?: string };
}
interface DdFile {
  data: Record<string, DdEntry>;
}
interface NamedStat {
  key: string;
}
interface BoardsFile {
  units: NamedStat[];
  traits: NamedStat[];
  items: NamedStat[];
}

/** DDragon 유닛 키는 전체 경로(`…/TFTSet18/Shop/DA_18_Rakan`)인데 집계는 마지막 조각만 쓴다. */
function basenameOf(key: string): string {
  const at = key.lastIndexOf("/");
  return at === -1 ? key : key.slice(at + 1);
}

/** 이미 받아 둔 파일은 다시 받지 않는다 — 재실행이 싸야 사람이 실제로 재실행한다. */
async function download(url: string, dest: string): Promise<boolean> {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  const res = await fetch(url);
  if (!res.ok) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

export async function runTftAssets(version: string, patch: string): Promise<TftAssetManifest> {
  const boardsFile = path.join(AGG_DIR, `boards-${patch}.json`);
  if (!fs.existsSync(boardsFile)) {
    throw new Error(
      `TODO(run-tft-assets): ${boardsFile} 가 없다. 'npm run pipeline:tft-aggregate'를 먼저 실행한다.`
    );
  }
  const boards = JSON.parse(fs.readFileSync(boardsFile, "utf8")) as BoardsFile;
  const wanted: Record<TftAssetKind, string[]> = {
    unit: [...new Set(boards.units.map((s) => s.key))].sort(),
    trait: [...new Set(boards.traits.map((s) => s.key))].sort(),
    item: [...new Set(boards.items.map((s) => s.key))].sort(),
  };

  const manifest: TftAssetManifest = {
    generatedAt: new Date().toISOString(),
    source: "Data Dragon (tft-champion · tft-trait · tft-item)",
    version,
    assets: { unit: [], trait: [], item: [] },
    missing: [],
  };

  for (const kind of ["unit", "trait", "item"] as const) {
    const res = await fetch(remoteTftCatalogUrl(version, kind));
    if (!res.ok) throw new Error(`run-tft-assets: ${kind} 카탈로그 HTTP ${res.status}`);
    const catalog = (await res.json()) as DdFile;
    // 키를 basename으로 색인한다 — 집계·델타가 쓰는 형태와 같아야 화면이 바로 찾는다.
    const byBase = new Map<string, string>();
    for (const [key, entry] of Object.entries(catalog.data)) {
      const full = entry.image?.full;
      if (!full) continue;
      const base = basenameOf(key);
      if (!byBase.has(base)) byBase.set(base, full);
    }

    for (const key of wanted[kind]) {
      const full = byBase.get(key);
      if (!full) {
        // 카탈로그에 아예 없는 대상이 실재한다(소환수 등) — 숨기지 않고 적는다.
        manifest.missing.push({ kind, key, reason: "카탈로그에 항목 없음" });
        continue;
      }
      const dest = path.join(ROOT, "public", publicTftAssetPath(kind, key));
      const ok = await download(remoteTftImageUrl(version, kind, full), dest);
      if (ok) manifest.assets[kind].push(key);
      else manifest.missing.push({ kind, key, reason: `이미지 내려받기 실패(${full})` });
    }
  }

  fs.mkdirSync(AGG_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main(): Promise<void> {
  const args = parseCliArgs("run-tft-assets", process.argv.slice(2), [
    { name: "version", type: "string", default: "16.18.1" },
    { name: "patch", type: "string", default: "18.2" },
  ]);
  const manifest = await runTftAssets(args.version as string, args.patch as string);
  const total = (["unit", "trait", "item"] as const).map((k) => `${k} ${manifest.assets[k].length}`).join(" · ");
  console.log(`[tft-assets] ${total} · 미보유 ${manifest.missing.length}`);
  for (const m of manifest.missing.slice(0, 20)) console.log(`   미보유 ${m.kind} ${m.key} — ${m.reason}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
