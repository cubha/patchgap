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
// 실행: npx tsx scripts/run-tft-assets.ts --patch 18.3 [--version 16.19.1]
//       버전을 주지 않으면 Data Dragon 최신(`api/versions.json` 첫 항목)을 쓴다 — 수집 워크플로는 지금
//       라이브인 패치를 받으므로 그것이 곧 이 패치의 게임 버전이다(run-cdragon과 같은 규칙).
//
// **CDragon 폴백(2026-09-27)**: DDragon 카탈로그에 없는 대상은 CDragon 원본 JSON의 아이콘 경로로
// 한 번 더 찾는다 — 18.x 「선체분쇄자」가 그랬다. 원본 JSON이 24MB라 **미보유가 있을 때만** 받는다.
import fs from "node:fs";
import path from "node:path";
import {
  cdragonIconOf,
  cdragonTftImageUrl,
  publicTftAssetPath,
  remoteTftCatalogUrl,
  remoteTftImageUrl,
  type CdragonIconFields,
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

  const notInCatalog: { kind: TftAssetKind; key: string }[] = [];
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
        // 카탈로그에 아예 없는 대상이 실재한다(소환수 등) — 아래 CDragon 폴백으로 넘긴다.
        notInCatalog.push({ kind, key });
        continue;
      }
      const dest = path.join(ROOT, "public", publicTftAssetPath(kind, key));
      const ok = await download(remoteTftImageUrl(version, kind, full), dest);
      if (ok) manifest.assets[kind].push(key);
      else manifest.missing.push({ kind, key, reason: `이미지 내려받기 실패(${full})` });
    }
  }

  if (notInCatalog.length > 0) {
    const icons = await fetchCdragonIcons();
    for (const { kind, key } of notInCatalog) {
      const entry = icons.get(key);
      const icon = entry ? cdragonIconOf(kind, entry) : null;
      if (!icon) {
        // 두 원천 모두에 없다 — 숨기지 않고 적는다(화면은 설계된 폴백을 그린다).
        manifest.missing.push({ kind, key, reason: "DDragon 카탈로그·CDragon 모두 항목 없음" });
        continue;
      }
      const dest = path.join(ROOT, "public", publicTftAssetPath(kind, key));
      const ok = await download(cdragonTftImageUrl(icon), dest);
      if (ok) manifest.assets[kind].push(key);
      else manifest.missing.push({ kind, key, reason: `CDragon 이미지 내려받기 실패(${icon})` });
    }
    manifest.source = "Data Dragon (tft-champion · tft-trait · tft-item) + Community Dragon 폴백";
  }

  fs.mkdirSync(AGG_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

interface CdragonNode extends CdragonIconFields {
  apiName?: unknown;
}

/** CDragon 원본 JSON 전체를 훑어 `apiName → 아이콘 필드`를 만든다(세트·아이템·특성 구조를 가정하지 않는다). */
async function fetchCdragonIcons(): Promise<Map<string, CdragonIconFields>> {
  const res = await fetch("https://raw.communitydragon.org/latest/cdragon/tft/ko_kr.json");
  if (!res.ok) throw new Error(`run-tft-assets: CDragon 원본 HTTP ${res.status}`);
  const root: unknown = await res.json();
  const out = new Map<string, CdragonIconFields>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const entry = node as CdragonNode;
    if (typeof entry.apiName === "string" && !out.has(entry.apiName)) {
      out.set(entry.apiName, { icon: entry.icon, squareIcon: entry.squareIcon, tileIcon: entry.tileIcon });
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(root);
  return out;
}

/** Data Dragon 최신 버전 — `--version`이 없을 때. */
async function latestDdragonVersion(): Promise<string> {
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!res.ok) throw new Error(`run-tft-assets: DDragon versions HTTP ${res.status}`);
  const versions = (await res.json()) as unknown;
  if (!Array.isArray(versions) || typeof versions[0] !== "string") {
    throw new Error("run-tft-assets: DDragon versions.json 형식이 예상과 다르다");
  }
  return versions[0];
}

async function main(): Promise<void> {
  // 기본값으로 버전·패치를 박아 두지 않는다 — 전에는 16.18.1·18.2가 기본이라 18.3 이후에도 조용히
  // 옛 패치의 자산 목록을 만들었다(매니페스트가 16.18.1에 멈춰 18.3의 「럭스 (검은 가시)」가 빠졌다).
  const args = parseCliArgs("run-tft-assets", process.argv.slice(2), [
    { name: "version", type: "string", default: "" },
    { name: "patch", type: "patch", required: true },
  ]);
  const version = (args.version as string) || (await latestDdragonVersion());
  const manifest = await runTftAssets(version, String(args.patch));
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
