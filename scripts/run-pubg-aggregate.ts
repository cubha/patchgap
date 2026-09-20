// scripts/run-pubg-aggregate.ts
// PUBG 집계 진입점 — 텔레메트리 reduce-on-ingest 산출물(data/raw/pubg/telemetry-reduced/*.json)을
// 읽어 패치 구간별 무기 집계와 델타/판정을 data/aggregated/pubg/ 에 쓴다.
//
// 파일 I/O는 이 계층에만 둔다(순수 집계는 src/pipeline/aggregate/pubg-weapons.ts,
// 판정은 src/pipeline/match/pubg-delta.ts).
//
// 실행: npm run pipeline:pubg-aggregate [-- --from 42.3 --to 43.1] [--data-root DIR]
//
// **패치쌍과 비교 구간을 인자로 받는다**(2026-09-20). 그전에는 42.3/43.1 날짜가 이 파일에
// 상수로 박혀 있어 다음 패치에서 사람이 코드를 고쳐야 했다 — 정기 수집을 CI에 얹을 수 없던
// 이유 중 하나다. 날짜는 `collect/pubg/patch-calendar.ts`가 **산술로** 만든다(손으로 고른
// 9/4~9/8·9/11~9/15과 같은 값이 나오는 것을 테스트가 고정한다).
//
// **네임스페이스를 pubg/ 로 분리한 이유**: data/aggregated/{patch}/ 아래에 두면 LoL 화면이
// 오염된다 — src/lib/data.ts의 listPatches는 summary.json이 있는 디렉토리를 전부 패치로
// 집계하고, PatchId 표기("{숫자}.{숫자}")상 "43.1"은 유효한 패치로 통과한다. 별도 디렉토리에
// summary.json 없이 두면 두 게이트 어느 쪽에도 걸리지 않는다.
import fs from "node:fs";
import path from "node:path";
import { comparisonWindows, PUBG_PATCH_WINDOWS } from "../src/pipeline/collect/pubg/patch-calendar";
import { isMainModule, parseCliArgs } from "./shared/cli";
import {
  aggregatePubgWeapons,
  isFirearm,
  selectMatches,
  type PubgReducedMatch,
} from "../src/pipeline/aggregate/pubg-weapons";
import { canonicalWeaponKey } from "../src/pipeline/aggregate/pubg-weapon-key";
import { accuracyByWeapon, type PubgAccuracyStat } from "../src/pipeline/aggregate/pubg-accuracy";
import { aggregatePubgMaps, buildPubgMapDeltas } from "../src/pipeline/aggregate/pubg-maps";
import { buildPubgDeltas, type PubgNoteItem } from "../src/pipeline/match/pubg-delta";

const ROOT = process.cwd();

interface CliArgs {
  from: string;
  to: string;
  dataRoot: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const latest = PUBG_PATCH_WINDOWS[PUBG_PATCH_WINDOWS.length - 1];
  const previous = PUBG_PATCH_WINDOWS[PUBG_PATCH_WINDOWS.length - 2];
  const raw = parseCliArgs("run-pubg-aggregate", argv, [
    { name: "from", type: "patch", default: previous?.patch ?? "" },
    { name: "to", type: "patch", default: latest?.patch ?? "" },
    { name: "dataRoot", type: "string", default: "data" },
  ]);
  return { from: String(raw.from), to: String(raw.to), dataRoot: String(raw.dataRoot) };
}

/** 패치 표기 → 달력 항목. 달력에 없으면 **던진다**(조용히 빈 집계를 내지 않는다). */
function windowOf(patch: string) {
  const found = PUBG_PATCH_WINDOWS.find((w) => w.patch === patch);
  if (!found) {
    throw new Error(
      `run-pubg-aggregate: 패치 ${patch}가 달력에 없다 — src/pipeline/collect/pubg/patch-calendar.ts의 ` +
        `PUBG_PATCH_WINDOWS에 추가한다.`
    );
  }
  return found;
}

/** `["2026-09-04", …, "2026-09-08"]` → `"9/4~9/8"`(커밋된 산출물의 label 표기 그대로). */
function labelRange(days: readonly string[]): string {
  const short = (day: string): string => {
    const [, month, date] = day.split("-");
    return `${Number(month)}/${Number(date)}`;
  };
  return `${short(days[0])}~${short(days[days.length - 1])}`;
}

function readReduced(RAW_DIR: string): PubgReducedMatch[] {
  if (!fs.existsSync(RAW_DIR)) {
    throw new Error(
      `TODO(run-pubg-aggregate): ${RAW_DIR} 가 없다. 텔레메트리 수집을 먼저 실행한다 ` +
        `(docs/plan/provenance/2026-09-16-pubg-harvest/).`
    );
  }
  const rows: PubgReducedMatch[] = [];
  for (const file of fs.readdirSync(RAW_DIR)) {
    if (!file.endsWith(".json")) continue;
    rows.push(JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), "utf8")) as PubgReducedMatch);
  }
  return rows;
}

/**
 * 무기별 원천 매치 ID 표본 — 모든 판정문은 원천 링크를 가져야 한다. 정준키로 모아야
 * `aggregatePubgWeapons`가 만든 `weaponKey`(정준키)와 조회가 맞는다 — 안 그러면 스킨
 * 변종이 섞인 무기(AK47·Kar98k 등)의 표본이 raw 키로 흩어져 evidence.matchIds가 빈다.
 */
function sampleMatchIds(matches: readonly PubgReducedMatch[], limit = 10): Map<string, string[]> {
  const byWeapon = new Map<string, string[]>();
  for (const m of matches) {
    for (const key of Object.keys(m.weaponPickup)) {
      if (!isFirearm(key)) continue;
      const canonical = canonicalWeaponKey(key);
      const list = byWeapon.get(canonical) ?? [];
      if (list.length < limit) {
        list.push(m.matchId);
        byWeapon.set(canonical, list);
      }
    }
  }
  return byWeapon;
}

/**
 * §8 반증표(PLAN-pubg-gate-2026-09-16.md) 재현 대상 — 반동 너프를 받은 LMG 3종과
 * 그 대조군 2종. **출하 축이 아니다**(pubg-accuracy.ts 헤더 참고). `/pubg/` 화면의
 * "버린 축" 섹션에서 "시도했고 버렸다"는 주장의 근거로만 쓰인다.
 */
const ACCURACY_TARGETS: readonly { key: string; nerfed: boolean }[] = [
  { key: "Item_Weapon_RPD_C", nerfed: true },
  { key: "Item_Weapon_M249_C", nerfed: true },
  { key: "Item_Weapon_MG3_C", nerfed: true },
  { key: "Item_Weapon_AK47_C", nerfed: false },
  { key: "Item_Weapon_HK416_C", nerfed: false },
];

interface AccuracyComparisonRow {
  weaponKey: string;
  weaponName: string;
  nerfed: boolean;
  before: Pick<PubgAccuracyStat, "accuracy" | "attacks">;
  after: Pick<PubgAccuracyStat, "accuracy" | "attacks">;
  relChangePct: number | null;
}

function buildAccuracyComparison(
  beforeMatches: readonly PubgReducedMatch[],
  afterMatches: readonly PubgReducedMatch[]
): AccuracyComparisonRow[] {
  const accBefore = new Map(accuracyByWeapon(beforeMatches).map((r) => [r.weaponKey, r]));
  const accAfter = new Map(accuracyByWeapon(afterMatches).map((r) => [r.weaponKey, r]));

  return ACCURACY_TARGETS.map(({ key, nerfed }) => {
    const b = accBefore.get(key);
    const a = accAfter.get(key);
    const relChangePct = b && a && b.accuracy > 0 ? ((a.accuracy - b.accuracy) / b.accuracy) * 100 : null;
    return {
      weaponKey: key,
      weaponName: (a ?? b)?.weaponName ?? key,
      nerfed,
      before: { accuracy: b?.accuracy ?? 0, attacks: b?.attacks ?? 0 },
      after: { accuracy: a?.accuracy ?? 0, attacks: a?.attacks ?? 0 },
      relChangePct,
    };
  });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const RAW_DIR = path.join(ROOT, args.dataRoot, "raw", "pubg", "telemetry-reduced");
  const OUT_DIR = path.join(ROOT, args.dataRoot, "aggregated", "pubg");

  const fromWindow = windowOf(args.from);
  const toWindow = windowOf(args.to);
  // 비교 구간은 **`to` 패치의 라이브 날짜 하나**에서 나온다 — before는 그 앞 5일, after는
  // 경계 2일을 건너뛴 5일이다. 두 창이 정확히 7일 차이라 요일이 저절로 맞는다(PLAN §6-2).
  const { before: beforeDays, after: afterDays } = comparisonWindows(toWindow.liveFrom);
  const WINDOW_BEFORE = new Set(beforeDays);
  const WINDOW_AFTER = new Set(afterDays);

  const all = readReduced(RAW_DIR);
  const beforeMatches = selectMatches(all, fromWindow.telemetryPatch, WINDOW_BEFORE);
  const afterMatches = selectMatches(all, toWindow.telemetryPatch, WINDOW_AFTER);

  const before = aggregatePubgWeapons(beforeMatches, args.from, `${args.from} (${labelRange(beforeDays)})`);
  const after = aggregatePubgWeapons(afterMatches, args.to, `${args.to} (${labelRange(afterDays)})`);

  const notesFile = path.join(OUT_DIR, `notes-${args.to}.json`);
  const notes = (JSON.parse(fs.readFileSync(notesFile, "utf8")) as { items: PubgNoteItem[] }).items;

  const { rows, effectFloor, counts } = buildPubgDeltas(
    before,
    after,
    notes,
    sampleMatchIds(afterMatches)
  );

  const accuracyComparison = buildAccuracyComparison(beforeMatches, afterMatches);

  // 맵 축(2026-09-17, ST-A3) — 무기 축과 **같은 전처리 산출물**(selectMatches 결과)을 쓴다.
  // 별도 수집·별도 필터가 없다는 뜻이고, 그래서 42.3 보존창(9/22 마감)과 무관하게 만들 수 있다.
  const mapsBefore = aggregatePubgMaps(beforeMatches, args.from, before.label);
  const mapsAfter = aggregatePubgMaps(afterMatches, args.to, after.label);
  const mapDeltas = buildPubgMapDeltas(mapsBefore, mapsAfter);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `weapons-${args.from}.json`), JSON.stringify(before, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `weapons-${args.to}.json`), JSON.stringify(after, null, 2));
  // §8 반증표 재현 — 출하 축 아님(ST-4). 화면 "버린 축" 섹션의 근거 파일.
  fs.writeFileSync(
    path.join(OUT_DIR, "accuracy-comparison.json"),
    JSON.stringify(
      {
        meta: {
          generatedAt: new Date().toISOString(),
          note: "출하 축 아님 — 반동·ADS 변경을 명중률로 분리하려던 시도의 반증 기록(PLAN-pubg-gate-2026-09-16.md §8). 판정(MatchStatus)에 연결되지 않는다.",
        },
        rows: accuracyComparison,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "deltas.json"),
    JSON.stringify(
      {
        meta: {
          game: "pubg",
          from: args.from,
          to: args.to,
          generatedAt: new Date().toISOString(),
          n: rows.length,
          counts,
          effectFloor,
          sampleScope:
            "steam 플랫폼 전역 · /samples 무작위 표본 · official 매치만 · 요일 정렬(목~월 5일) · 봇 포함(비율 병기)",
          window: { before: [...WINDOW_BEFORE], after: [...WINDOW_AFTER] },
        },
        rows,
      },
      null,
      2
    )
  );

  fs.writeFileSync(path.join(OUT_DIR, `maps-${args.from}.json`), JSON.stringify(mapsBefore, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `maps-${args.to}.json`), JSON.stringify(mapsAfter, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, "map-deltas.json"),
    JSON.stringify(
      {
        meta: {
          game: "pubg",
          from: args.from,
          to: args.to,
          generatedAt: new Date().toISOString(),
          n: mapDeltas.rows.length,
          // 판정(MatchStatus)이 없는 이유 — 43.1 패치노트에 맵 항목이 0건이다. 짝지을 선언이
          // 없는 축에 판정 어휘를 붙이면 "노트에 없다"가 관측이 아니라 전제가 된다.
          note: "기술 통계 전용 — 43.1 패치노트에 맵 항목이 없어 판정(MatchStatus)을 만들지 않는다.",
          onlyBefore: mapDeltas.onlyBefore,
          onlyAfter: mapDeltas.onlyAfter,
        },
        rows: mapDeltas.rows,
      },
      null,
      2
    )
  );

  const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
  console.log(`[pubg] ${args.from} ${before.nMatches}매치 / ${args.to} ${after.nMatches}매치`);
  console.log(
    `[pubg] 맵 ${mapsBefore.maps.length} → ${mapsAfter.maps.length}종 · 비교행 ${mapDeltas.rows.length}` +
      (mapDeltas.onlyBefore.length || mapDeltas.onlyAfter.length
        ? ` · 한쪽만: before=${mapDeltas.onlyBefore.join(",") || "-"} after=${mapDeltas.onlyAfter.join(",") || "-"}`
        : "")
  );
  console.log(
    `[pubg] 기저: 픽업/매치 ${before.pickupsPerMatch.toFixed(1)} → ${after.pickupsPerMatch.toFixed(1)} · ` +
      `봇 ${pct(before.botShare)} → ${pct(after.botShare)}`
  );
  console.log(`[pubg] 효과크기 바닥(데이터 유도) = ${pct(effectFloor)}`);
  console.log(`[pubg] 판정:`, counts);
  for (const row of rows.filter((r) => r.status.startsWith("announced"))) {
    console.log(
      `   ${row.status.padEnd(23)} ${row.weaponName.padEnd(10)} ` +
        `${pct(row.relChange ?? 0)} [${pct(row.relCi[0])}, ${pct(row.relCi[1])}]`
    );
  }

  console.log(`[pubg] §8 명중률 반증표 재현(출하 축 아님):`);
  for (const r of accuracyComparison) {
    const changeStr = r.relChangePct === null ? "n/a" : `${r.relChangePct >= 0 ? "+" : ""}${r.relChangePct.toFixed(1)}%`;
    console.log(
      `   ${r.nerfed ? "너프" : "대조"} ${r.weaponName.padEnd(10)} ` +
        `${pct(r.before.accuracy, 2)} -> ${pct(r.after.accuracy, 2)} (${changeStr})`
    );
  }
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    console.error(`[pubg] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
