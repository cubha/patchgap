// scripts/run-ddragon.ts
// Data Dragon 최신 버전 챔피언/아이템 JSON + (집계에 등장한 엔티티만) 이미지를 다운로드한다.
// 실행: npx tsx scripts/run-ddragon.ts
//
// 1) https://ddragon.leagueoflegends.com/api/versions.json → 최신 버전(예 "16.17.1")
// 2) cdn/{v}/data/ko_KR/{champion,item}.json → data/ddragon/{v}/{champion,item}.json (커밋 대상 —
//    소형 JSON이고 src/pipeline/match/ddragon.ts가 빌드 타임 매핑에 그대로 읽는다)
// 3) data/aggregated/{patch}/{champions,items}.json 전 패치를 스캔해 등장한 championId/itemId만
//    cdn/{v}/img/{champion,item}/{...}.png → public/dd/{champion,item}/ 에 다운로드(이미 있으면 skip)
//
// 4) **스킨 인덱스 + 치장 스플래시**(2026-09-18, ST-B6): cdn/{v}/data/ko_KR/champion/{Id}.json을
//    챔피언별로 받아 ko_KR 스킨 목록을 data/aggregated/skin-index.json으로 모으고, 커밋된
//    notes/*.json의 **치장 항목에 글자 그대로 등장하는** 스킨의 스플래시만
//    cdn/img/champion/splash/{Id}_{num}.jpg → public/dd/splash/ 로 받는다. 전 스킨을 받지
//    않는 이유는 규모다 — 173챔프 × 평균 40스킨 ≈ 7,000장(장당 130~160KB)은 저장소에 담을
//    물건이 아니다. 실제로 쓰이는 것은 패치당 수 장뿐이다.
//
// 룬 아이콘(cdn/img/perk-images/...)은 현재 파이프라인에 룬 단위 집계 엔티티가 없어(패치노트
// subsection="rune" 분류는 있지만 통계 집계 대상은 챔피언/아이템뿐) 다운로드 대상이 없다 —
// 향후 룬 통계가 추가되면 이 스크립트에 별도 단계로 추가한다(미확인 사항).

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, skinIndexFile, spellIconsFile } from "../src/pipeline/shared/paths";
import { isCosmeticNote } from "../src/pipeline/shared/cosmetic-note";
import {
  matchSkinsInSummary,
  type SkinIndexFile,
  type SkinRef,
} from "../src/pipeline/shared/cosmetic-skin";
import { loadDdragon, type DdragonData } from "../src/pipeline/match/ddragon";
import {
  parseSkillSlot,
  resolveSpellIconFile,
  spellIconKey,
  type SpellSlot,
} from "../src/pipeline/match/spell-icon";
import type { PatchNoteItem, SpellIconIndexFile, SpellIconMap } from "../src/pipeline/types";
import { isMainModule } from "./shared/cli";

const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const PUBLIC_DD_DIR = path.resolve(process.cwd(), "public", "dd");
const DOWNLOAD_CONCURRENCY = 6;

function cdnBase(version: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}`;
}

// 스플래시(cdn/img/champion/splash/)는 버전 경로가 없다 — 다른 이미지(cdn/{v}/img/...)와
// 경로 규약이 다르므로 cdnBase()를 쓰면 안 된다(공식 CDN 구조, DDragon 문서 확인).
const SPLASH_BASE = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash";

export async function fetchLatestVersion(fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(VERSIONS_URL);
  if (!res.ok) {
    throw new Error(`ddragon versions.json fetch failed: HTTP ${res.status}`);
  }
  const versions = (await res.json()) as unknown;
  if (!Array.isArray(versions) || versions.length === 0 || typeof versions[0] !== "string") {
    throw new Error("ddragon versions.json: unexpected response shape");
  }
  return versions[0];
}

async function downloadJsonFile(
  url: string,
  destPath: string,
  fetchImpl: typeof fetch
): Promise<void> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`fetch failed (HTTP ${res.status}): ${url}`);
  }
  const text = await res.text();
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, text, "utf8");
}

type DownloadResult = "downloaded" | "skipped" | "failed";

async function downloadImageIfMissing(
  url: string,
  destPath: string,
  fetchImpl: typeof fetch
): Promise<DownloadResult> {
  if (fs.existsSync(destPath)) return "skipped";
  const res = await fetchImpl(url);
  if (!res.ok) return "failed";
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
  return "downloaded";
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function runOne(): Promise<void> {
    while (cursor < items.length) {
      const current = items[cursor];
      cursor += 1;
      await worker(current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runOne());
  await Promise.all(workers);
}

interface AggregatedChampionsFile {
  rows: Array<{ championId: number }>;
}
interface AggregatedItemsFile {
  rows: Array<{ itemId: number }>;
}

/**
 * `data/aggregated/{patch}/{champions,items}.json` 전 패치 디렉토리를 스캔해 등장한
 * championId/itemId 집합을 모은다. `deltas/`·`notes/`(패치 디렉토리가 아님)는 제외한다.
 */
export function collectAppearedEntities(dataRoot: string = DATA_ROOT): {
  championIds: Set<number>;
  itemIds: Set<number>;
} {
  const aggregatedDir = path.join(dataRoot, "aggregated");
  const championIds = new Set<number>();
  const itemIds = new Set<number>();
  if (!fs.existsSync(aggregatedDir)) return { championIds, itemIds };

  for (const entry of fs.readdirSync(aggregatedDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "deltas" || entry.name === "notes") continue;
    const patchDir = path.join(aggregatedDir, entry.name);

    const championsPath = path.join(patchDir, "champions.json");
    if (fs.existsSync(championsPath)) {
      const parsed = JSON.parse(
        fs.readFileSync(championsPath, "utf8")
      ) as AggregatedChampionsFile;
      for (const row of parsed.rows) championIds.add(row.championId);
    }

    const itemsPath = path.join(patchDir, "items.json");
    if (fs.existsSync(itemsPath)) {
      const parsed = JSON.parse(fs.readFileSync(itemsPath, "utf8")) as AggregatedItemsFile;
      for (const row of parsed.rows) itemIds.add(row.itemId);
    }
  }
  return { championIds, itemIds };
}

interface SpellIconTarget {
  entity: string;
  skill: string;
  slot: SpellSlot;
}

interface NotesFileForIcons {
  items: Array<{ section: string; entity: string; skill: string | null }>;
}

/**
 * `data/aggregated/notes/*.json` 전 패치를 스캔해, 스펠 아이콘이 필요한 (entity, skill) 쌍만
 * 뽑는다 — HANDOFF §5 "챔피언 상세 JSON 170개를 커밋하지 않고 slim 인덱스만 산출"의 다운로드
 * 범위 축소(등장한 것만) 원칙을 여기에도 적용한다. section이 "champion"이 아니거나 skill이
 * null이거나, `parseSkillSlot`이 슬롯을 못 읽으면(예: "기본 능력치") 대상에서 제외한다.
 */
export function collectSpellIconTargets(dataRoot: string = DATA_ROOT): SpellIconTarget[] {
  const notesDir = path.join(dataRoot, "aggregated", "notes");
  const targets: SpellIconTarget[] = [];
  if (!fs.existsSync(notesDir)) return targets;

  const seenKeys = new Set<string>();
  for (const entry of fs.readdirSync(notesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const parsed = JSON.parse(
      fs.readFileSync(path.join(notesDir, entry.name), "utf8")
    ) as NotesFileForIcons;
    for (const item of parsed.items) {
      if (item.section !== "champion" || !item.skill) continue;
      const slot = parseSkillSlot(item.skill);
      if (!slot) continue;
      const key = spellIconKey(item.entity, item.skill);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      targets.push({ entity: item.entity, skill: item.skill, slot });
    }
  }
  return targets;
}

/**
 * 노트에 등장한 (entity, skill) 대상만큼만 챔피언 상세 JSON을 fetch해(디스크에 쓰지 않음 —
 * 170개 전량 커밋 방지, HANDOFF §5) 스펠 아이콘 파일명을 조회하고, 실제 이미지를
 * `public/dd/spell/`에 다운로드한 뒤 slim 인덱스를 `data/aggregated/spell-icons.json`에 쓴다.
 */
async function syncSpellIcons(
  version: string,
  ddragon: DdragonData,
  fetchImpl: typeof fetch,
  dataRoot: string = DATA_ROOT
): Promise<void> {
  const targets = collectSpellIconTargets(dataRoot);
  console.log(`[run-ddragon] spell icon targets (entity+skill 쌍): ${targets.length}`);

  const byChampion = new Map<string, SpellIconTarget[]>();
  for (const target of targets) {
    const bucket = byChampion.get(target.entity);
    if (bucket) bucket.push(target);
    else byChampion.set(target.entity, [target]);
  }

  const icons: SpellIconMap = {};
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const missingChampionMapping: string[] = [];
  const missingSlot: Array<{ entity: string; skill: string }> = [];

  for (const [entity, entityTargets] of byChampion) {
    const champion = ddragon.champions.byKoName(entity);
    if (!champion) {
      missingChampionMapping.push(entity);
      continue;
    }
    const detailUrl = `${cdnBase(version)}/data/ko_KR/champion/${champion.id}.json`;
    const res = await fetchImpl(detailUrl);
    if (!res.ok) {
      missingChampionMapping.push(entity);
      continue;
    }
    const detailJson = (await res.json()) as unknown;

    for (const target of entityTargets) {
      const filename = resolveSpellIconFile(detailJson, target.slot);
      if (!filename) {
        missingSlot.push({ entity: target.entity, skill: target.skill });
        continue;
      }
      icons[spellIconKey(target.entity, target.skill)] = filename;
      const url = `${cdnBase(version)}/img/spell/${filename}`;
      const dest = path.join(PUBLIC_DD_DIR, "spell", filename);
      const result = await downloadImageIfMissing(url, dest, fetchImpl);
      if (result === "downloaded") downloaded += 1;
      else if (result === "skipped") skipped += 1;
      else failed += 1;
    }
  }

  const indexFile: SpellIconIndexFile = {
    meta: {
      ddragonVersion: version,
      generatedAt: new Date().toISOString(),
      count: Object.keys(icons).length,
    },
    icons,
  };
  const indexPath = spellIconsFile(dataRoot);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(indexFile, null, 2) + "\n", "utf8");

  console.log(
    `[run-ddragon] spell icons: resolved=${Object.keys(icons).length} downloaded=${downloaded} skipped=${skipped} failed=${failed}`
  );
  if (missingChampionMapping.length > 0) {
    console.log(
      `[run-ddragon] spell icons — missing champion ddragon mapping: ${missingChampionMapping.join(", ")}`
    );
  }
  if (missingSlot.length > 0) {
    console.log(
      `[run-ddragon] spell icons — slot not resolvable in detail JSON (entity/skill): ${missingSlot
        .map((m) => `${m.entity}/${m.skill}`)
        .join(", ")}`
    );
  }
}

/** 챔피언 상세 JSON의 필요한 부분만 — 전체 스키마를 타이핑하지 않는다(쓰는 건 skins·spells뿐). */
interface ChampionDetailResponse {
  data: Record<
    string,
    {
      id: string;
      name: string;
      skins?: { num: number; name: string }[];
      /** 스킬 수치 — 잠수함 패치 검출(F9)의 입력. 2026-09-21 이전에는 받고 버렸다. */
      spells?: {
        cooldownBurn?: string;
        costBurn?: string;
        rangeBurn?: string;
        effectBurn?: (string | null)[];
      }[];
    }
  >;
}

/**
 * ko_KR 스킨 인덱스를 만든다 — 챔피언 상세 JSON을 챔피언 수만큼 받는다.
 *
 * ⚠️ **번들 `champion.json`에는 skins가 없다**(2026-09-17 실측: keys에 `skins` 부재).
 * 스킨 목록은 챔피언별 상세(`data/ko_KR/champion/{Id}.json`)에만 있어서 N회 요청이 불가피하다.
 * 대신 결과를 slim 인덱스로 **커밋**하므로 빌드·런타임에는 요청이 0이다.
 */
/** 잠수함 패치 검출(F9)이 읽는 스킬 수치만 담는 축약형 — 응답 전체를 커밋하지 않기 위한 형태. */
interface SpellNumerics {
  readonly spells: readonly {
    readonly cooldownBurn: string | null;
    readonly costBurn: string | null;
    readonly rangeBurn: string | null;
    readonly effectBurn: readonly (string | null)[];
  }[];
}

async function buildSkinIndex(
  version: string,
  ddragon: DdragonData,
  championIds: ReadonlySet<number>,
  fetchImpl: typeof fetch
): Promise<{ skins: SkinRef[]; spellNumerics: Record<string, SpellNumerics> }> {
  const ids = Array.from(championIds)
    .map((key) => ddragon.champions.byKey(key))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const skins: SkinRef[] = [];
  const spellNumerics: Record<string, SpellNumerics> = {};
  let failed = 0;
  await mapWithConcurrency(ids, DOWNLOAD_CONCURRENCY, async (champion) => {
    const url = `${cdnBase(version)}/data/ko_KR/champion/${champion.id}.json`;
    try {
      const res = await fetchImpl(url);
      if (!res.ok) {
        failed += 1;
        return;
      }
      const parsed = (await res.json()) as ChampionDetailResponse;
      const detail = parsed.data?.[champion.id];
      for (const skin of detail?.skins ?? []) {
        skins.push({
          championId: champion.id,
          num: skin.num,
          name: skin.name,
        });
      }
      // 스킬 수치 보존(2026-09-21, ST-4) — 이 응답은 원래 **스킨만 빼고 버려졌다**. 잠수함 패치
      // 검출(F9)은 스킬 수치 diff가 핵심인데(밸런스 변경 대부분이 기본 능력치가 아니라 스킬에
      // 있다), 그 데이터가 이미 여기를 지나가고 있었다. 응답 전체를 커밋하면 버전당 10MB라
      // **수치 필드만** 남긴다(~100KB).
      const spells = (detail?.spells ?? []).map((spell) => ({
        cooldownBurn: spell.cooldownBurn ?? null,
        costBurn: spell.costBurn ?? null,
        rangeBurn: spell.rangeBurn ?? null,
        effectBurn: (spell.effectBurn ?? []).map((e) => e ?? null),
      }));
      if (spells.length > 0) spellNumerics[champion.id] = { spells };
    } catch {
      failed += 1; // 한 챔피언을 못 받아도 인덱스 전체를 버리지 않는다(부분 인덱스가 0보다 낫다)
    }
  });

  skins.sort((a, b) => a.championId.localeCompare(b.championId) || a.num - b.num);
  console.log(
    `[run-ddragon] skin index: champions=${ids.length} skins=${skins.length} fetch-failed=${failed} spells=${Object.keys(spellNumerics).length}`
  );
  return { skins, spellNumerics };
}

/** 커밋된 notes/*.json 전부에서 치장 항목만 모은다 — 스플래시 조달 대상의 유일한 출처. */
function collectCosmeticNotes(dataRoot: string = DATA_ROOT): PatchNoteItem[] {
  const notesDir = path.join(dataRoot, "aggregated", "notes");
  if (!fs.existsSync(notesDir)) return [];
  const out: PatchNoteItem[] = [];
  for (const file of fs.readdirSync(notesDir)) {
    if (!file.endsWith(".json")) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(notesDir, file), "utf8")) as {
      items?: PatchNoteItem[];
    };
    for (const item of parsed.items ?? []) {
      if (isCosmeticNote(item)) out.push(item);
    }
  }
  return out;
}

/**
 * 치장 노트가 실제로 지목한 스킨의 스플래시만 받는다. 인덱스를 파일로 남기는 것과 자산을
 * 받는 것을 한 함수에 둔 이유는 **둘의 대상이 다르기 때문**이다 — 인덱스는 전 챔피언,
 * 자산은 노트가 지목한 소수. 이 비대칭이 이 단계의 전부다.
 */
async function syncSkinIndexAndSplashes(
  version: string,
  ddragon: DdragonData,
  championIds: ReadonlySet<number>,
  fetchImpl: typeof fetch
): Promise<void> {
  const { skins, spellNumerics } = await buildSkinIndex(version, ddragon, championIds, fetchImpl);

  // 스킬 수치를 버전 폴더에 남긴다(ST-4) — 잠수함 패치 검출(F9)의 입력이다. 스킨 인덱스가
  // 비어도 이건 쓴다(두 산출물은 독립이다).
  if (Object.keys(spellNumerics).length > 0) {
    const spellsDest = path.join(DATA_ROOT, "ddragon", version, "spells.json");
    fs.mkdirSync(path.dirname(spellsDest), { recursive: true });
    fs.writeFileSync(spellsDest, `${JSON.stringify(spellNumerics)}\n`, "utf8");
    console.log(`[run-ddragon] spell numerics → ${spellsDest} (${Object.keys(spellNumerics).length}종)`);
  }

  if (skins.length === 0) {
    console.log("[run-ddragon] skin index: 비어 있음 — 인덱스 파일을 덮어쓰지 않는다");
    return;
  }

  const indexFile: SkinIndexFile = {
    meta: { version, generatedAt: new Date().toISOString(), count: skins.length },
    skins,
  };
  const dest = skinIndexFile();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // 들여쓰기 없이 쓴다 — 9,120행짜리 파일에서 pretty-print는 용량을 두 배로 만든다.
  fs.writeFileSync(dest, `${JSON.stringify(indexFile)}\n`, "utf8");
  console.log(`[run-ddragon] skin index → ${dest}`);

  const cosmetic = collectCosmeticNotes();
  const wanted = new Map<string, SkinRef>();
  for (const note of cosmetic) {
    for (const skin of matchSkinsInSummary(note.summary, skins)) {
      wanted.set(`${skin.championId}_${skin.num}`, skin);
    }
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  await mapWithConcurrency(Array.from(wanted.values()), DOWNLOAD_CONCURRENCY, async (skin) => {
    const name = `${skin.championId}_${skin.num}.jpg`;
    const result = await downloadImageIfMissing(
      `${SPLASH_BASE}/${name}`,
      path.join(PUBLIC_DD_DIR, "splash", name),
      fetchImpl
    );
    if (result === "downloaded") downloaded += 1;
    else if (result === "skipped") skipped += 1;
    else failed += 1;
  });

  console.log(
    `[run-ddragon] cosmetic splash: notes=${cosmetic.length} matched-skins=${wanted.size} ` +
      `downloaded=${downloaded} skipped=${skipped} failed=${failed}`
  );
}

export async function main(): Promise<void> {
  const fetchImpl = fetch;
  const version = await fetchLatestVersion(fetchImpl);
  console.log(`[run-ddragon] latest version=${version}`);

  const versionDir = path.join(DATA_ROOT, "ddragon", version);
  await downloadJsonFile(
    `${cdnBase(version)}/data/ko_KR/champion.json`,
    path.join(versionDir, "champion.json"),
    fetchImpl
  );
  await downloadJsonFile(
    `${cdnBase(version)}/data/ko_KR/item.json`,
    path.join(versionDir, "item.json"),
    fetchImpl
  );
  console.log(`[run-ddragon] saved champion.json / item.json → ${versionDir}`);

  const ddragon = loadDdragon(version);
  const { championIds, itemIds } = collectAppearedEntities();
  console.log(
    `[run-ddragon] appeared entities (all aggregated patches): champions=${championIds.size} items=${itemIds.size}`
  );

  let champDownloaded = 0;
  let champSkipped = 0;
  let champFailed = 0;
  const missingChampionMapping: number[] = [];

  await mapWithConcurrency(Array.from(championIds), DOWNLOAD_CONCURRENCY, async (championId) => {
    const champion = ddragon.champions.byKey(championId);
    if (!champion) {
      missingChampionMapping.push(championId);
      return;
    }
    const url = `${cdnBase(version)}/img/champion/${champion.id}.png`;
    const dest = path.join(PUBLIC_DD_DIR, "champion", `${champion.id}.png`);
    const result = await downloadImageIfMissing(url, dest, fetchImpl);
    if (result === "downloaded") champDownloaded += 1;
    else if (result === "skipped") champSkipped += 1;
    else champFailed += 1;
  });

  // 항목상세 페이지 앰비언트 스플래시(챔피언 항목만, entityType==="champion") 자산 — 등장한
  // 챔피언 전원분을 미리 받아 둔다(정적 export라 런타임 fetch 불가, generateStaticParams가
  // 빌드 타임에 전부 프리렌더). public/dd/splash/{championId}_0.jpg 계약은 heroSplash.ts가
  // 이미 전제하던 것을 그대로 재사용.
  let splashDownloaded = 0;
  let splashSkipped = 0;
  let splashFailed = 0;

  await mapWithConcurrency(Array.from(championIds), DOWNLOAD_CONCURRENCY, async (championId) => {
    const champion = ddragon.champions.byKey(championId);
    if (!champion) return; // missingChampionMapping은 위 챔피언 아이콘 루프에서 이미 보고
    const url = `${SPLASH_BASE}/${champion.id}_0.jpg`;
    const dest = path.join(PUBLIC_DD_DIR, "splash", `${champion.id}_0.jpg`);
    const result = await downloadImageIfMissing(url, dest, fetchImpl);
    if (result === "downloaded") splashDownloaded += 1;
    else if (result === "skipped") splashSkipped += 1;
    else splashFailed += 1;
  });

  let itemDownloaded = 0;
  let itemSkipped = 0;
  let itemFailed = 0;
  const missingItemMapping: number[] = [];

  await mapWithConcurrency(Array.from(itemIds), DOWNLOAD_CONCURRENCY, async (itemId) => {
    const item = ddragon.items.byId(itemId);
    if (!item) {
      missingItemMapping.push(itemId);
      return;
    }
    const url = `${cdnBase(version)}/img/item/${itemId}.png`;
    const dest = path.join(PUBLIC_DD_DIR, "item", `${itemId}.png`);
    const result = await downloadImageIfMissing(url, dest, fetchImpl);
    if (result === "downloaded") itemDownloaded += 1;
    else if (result === "skipped") itemSkipped += 1;
    else itemFailed += 1;
  });

  const completedCount = Array.from(itemIds).filter((id) => ddragon.items.isCompleted(id)).length;

  console.log(
    `[run-ddragon] champion images: downloaded=${champDownloaded} skipped=${champSkipped} failed=${champFailed} missing-mapping=${missingChampionMapping.length}`
  );
  console.log(
    `[run-ddragon] champion splash: downloaded=${splashDownloaded} skipped=${splashSkipped} failed=${splashFailed}`
  );
  console.log(
    `[run-ddragon] item images: downloaded=${itemDownloaded} skipped=${itemSkipped} failed=${itemFailed} missing-mapping=${missingItemMapping.length}`
  );
  console.log(
    `[run-ddragon] completed items among appeared: ${completedCount}/${itemIds.size}`
  );
  if (missingChampionMapping.length > 0) {
    console.log(
      `[run-ddragon] missing champion ddragon mapping (championId): ${missingChampionMapping.join(", ")}`
    );
  }
  if (missingItemMapping.length > 0) {
    console.log(
      `[run-ddragon] missing item ddragon mapping (itemId): ${missingItemMapping.join(", ")}`
    );
  }

  await syncSpellIcons(version, ddragon, fetchImpl);
  await syncSkinIndexAndSplashes(version, ddragon, championIds, fetchImpl);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(`[run-ddragon] fatal: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
