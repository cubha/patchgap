// scripts/run-pubg-assets.ts
// PUBG 공식 자산 조달(빌드 이전 1회) — `pubg/api-assets`에서 무기 렌더와 맵 지형도를 내려받아
// `public/pubg/` 아래에 두고, 조달 결과를 매니페스트로 남긴다.
//
// **`public/dd/`(Data Dragon)와 같은 구조다**: 런타임에 외부를 부르지 않기 위해 자산을 저장소에
// 커밋한다. 다른 점은 **실행 빈도**다 — LoL 자산은 패치마다 갱신되므로 CI가 돌리지만, PUBG
// 무기·맵 렌더는 패치와 무관하게 안정적이라 이 스크립트는 **수동 1회성 도구**다(PUBG 수집이
// 애초에 1회성 harvest였던 것과 같은 성격). CI 워크플로에 배선하지 않는다.
//
// **이미지를 리사이즈하지 않는 이유**: 리사이즈에는 새 의존성이 필요하고, SCOPE §3에 없는
// 의존성은 임의로 추가하지 않는다(CLAUDE.md). 맵 지형도는 공식 `_Low_Res`판 그대로 쓴다 —
// 9장 합계 약 12MB로, 저장소가 이미 커밋하고 있는 LoL 스플래시(173장 29MB)와 같은 자릿수다.
import fs from "node:fs";
import path from "node:path";
import { PUBG_MAPS } from "../src/pipeline/aggregate/pubg-maps";
import {
  remoteMapUrl,
  remoteWeaponUrl,
  type PubgAssetManifest,
} from "../src/pipeline/pubg/asset-path";

const ROOT = process.cwd();
const AGG_DIR = path.join(ROOT, "data", "aggregated", "pubg");
const OUT_DIR = path.join(ROOT, "public", "pubg");
const MANIFEST = path.join(AGG_DIR, "assets.json");

interface WeaponsFile {
  weapons: { weaponKey: string }[];
}
interface MapsFile {
  maps: { mapKey: string }[];
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) {
    throw new Error(
      `TODO(run-pubg-assets): ${file} 가 없다. 'npx tsx scripts/run-pubg-aggregate.ts'를 먼저 실행한다.`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/** 이미 받아 둔 파일은 다시 받지 않는다 — 재실행이 싸야 사람이 실제로 재실행한다. */
async function download(url: string, dest: string): Promise<number> {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return 200;
  const res = await fetch(url);
  if (!res.ok) return res.status;
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return 200;
}

async function main(): Promise<void> {
  const weaponKeys = [
    ...new Set(readJson<WeaponsFile>(path.join(AGG_DIR, "weapons-43.1.json")).weapons.map((w) => w.weaponKey)),
  ].sort();

  // 맵은 두 구간 합집합 — 한쪽 구간에만 표본이 잡힌 맵도 상세 화면은 존재한다.
  const mapKeys = [
    ...new Set(
      (["maps-42.3.json", "maps-43.1.json"] as const).flatMap(
        (f) => readJson<MapsFile>(path.join(AGG_DIR, f)).maps.map((m) => m.mapKey)
      )
    ),
  ].sort();

  const manifest: PubgAssetManifest = {
    generatedAt: new Date().toISOString(),
    source: "https://github.com/pubg/api-assets (developer.pubg.com/tos — 개발자 자산)",
    weapons: [],
    maps: [],
    missing: [],
  };

  for (const key of weaponKeys) {
    const status = await download(remoteWeaponUrl(key), path.join(OUT_DIR, "weapon", `${key}.png`));
    if (status === 200) manifest.weapons.push(key);
    else manifest.missing.push({ kind: "weapon", key, status });
  }

  const assetNames = [...new Set(mapKeys.map((k) => PUBG_MAPS[k]?.assetName).filter((n): n is string => !!n))];
  for (const name of assetNames) {
    const status = await download(remoteMapUrl(name), path.join(OUT_DIR, "map", `${name}.png`));
    if (status === 200) manifest.maps.push(name);
    else manifest.missing.push({ kind: "map", key: name, status });
  }

  fs.mkdirSync(AGG_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`[pubg-assets] 무기 ${manifest.weapons.length}/${weaponKeys.length} · 맵 ${manifest.maps.length}/${assetNames.length}`);
  for (const m of manifest.missing) console.log(`   미보유 ${m.kind} ${m.key} (HTTP ${m.status})`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
