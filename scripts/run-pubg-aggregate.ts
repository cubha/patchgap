// scripts/run-pubg-aggregate.ts
// PUBG 집계 진입점 — 텔레메트리 reduce-on-ingest 산출물(data/raw/pubg/telemetry-reduced/*.json)을
// 읽어 패치 구간별 무기 집계와 델타/판정을 data/aggregated/pubg/ 에 쓴다.
//
// 파일 I/O는 이 계층에만 둔다(순수 집계는 src/pipeline/aggregate/pubg-weapons.ts,
// 판정은 src/pipeline/match/pubg-delta.ts).
//
// **네임스페이스를 pubg/ 로 분리한 이유**: data/aggregated/{patch}/ 아래에 두면 LoL 화면이
// 오염된다 — src/lib/data.ts의 listPatches는 summary.json이 있는 디렉토리를 전부 패치로
// 집계하고, PatchId 표기("{숫자}.{숫자}")상 "43.1"은 유효한 패치로 통과한다. 별도 디렉토리에
// summary.json 없이 두면 두 게이트 어느 쪽에도 걸리지 않는다.
import fs from "node:fs";
import path from "node:path";
import {
  aggregatePubgWeapons,
  selectMatches,
  type PubgReducedMatch,
} from "../src/pipeline/aggregate/pubg-weapons";
import { buildPubgDeltas, type PubgNoteItem } from "../src/pipeline/match/pubg-delta";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw", "pubg", "telemetry-reduced");
const OUT_DIR = path.join(ROOT, "data", "aggregated", "pubg");

/**
 * 요일을 맞춘 비교 구간(PLAN §6-2). 42.3·43.1 양쪽 다 목~월 5일이다 — 주말 비중이 다르면
 * 플레이어 구성 차이가 패치 효과와 섞인다. 경계 2일(9/9~9/10)은 43.1 rollout 시차가
 * 미검증이라 양쪽 모두에서 제외한다(§6-3).
 */
const WINDOW_BEFORE = new Set(["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"]);
const WINDOW_AFTER = new Set(["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"]);

function readReduced(): PubgReducedMatch[] {
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

/** 무기별 원천 매치 ID 표본 — 모든 판정문은 원천 링크를 가져야 한다. */
function sampleMatchIds(matches: readonly PubgReducedMatch[], limit = 10): Map<string, string[]> {
  const byWeapon = new Map<string, string[]>();
  for (const m of matches) {
    for (const key of Object.keys(m.weaponPickup)) {
      const list = byWeapon.get(key) ?? [];
      if (list.length < limit) {
        list.push(m.matchId);
        byWeapon.set(key, list);
      }
    }
  }
  return byWeapon;
}

function main(): void {
  const all = readReduced();
  const beforeMatches = selectMatches(all, "pc-2018-42", WINDOW_BEFORE);
  const afterMatches = selectMatches(all, "pc-2018-43", WINDOW_AFTER);

  const before = aggregatePubgWeapons(beforeMatches, "42.3", "42.3 (9/4~9/8)");
  const after = aggregatePubgWeapons(afterMatches, "43.1", "43.1 (9/11~9/15)");

  const notesFile = path.join(OUT_DIR, "notes-43.1.json");
  const notes = (JSON.parse(fs.readFileSync(notesFile, "utf8")) as { items: PubgNoteItem[] }).items;

  const { rows, effectFloor, counts } = buildPubgDeltas(
    before,
    after,
    notes,
    sampleMatchIds(afterMatches)
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "weapons-42.3.json"), JSON.stringify(before, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "weapons-43.1.json"), JSON.stringify(after, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, "deltas.json"),
    JSON.stringify(
      {
        meta: {
          game: "pubg",
          from: "42.3",
          to: "43.1",
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

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log(`[pubg] 42.3 ${before.nMatches}매치 / 43.1 ${after.nMatches}매치`);
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
}

main();
