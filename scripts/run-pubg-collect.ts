// scripts/run-pubg-collect.ts
// PUBG 수집 진입점 — 표본 id → 매치 → 텔레메트리 → **축약**까지 한 번에 돈다.
// 실행: npm run pipeline:pubg-collect -- --days 2026-09-04,2026-09-05,… [--per-day 120]
//
// 산출: data/raw/pubg/telemetry-reduced/{matchId}.json (gitignore — 집계가 읽는 유일한 입력)
//
// **원본은 남기지 않는다.** 매치당 텔레메트리가 16~30MB라 1,200건이면 20GB가 넘고, 집계가
// 읽는 것은 매치당 ~3KB 축약뿐이다. Python 재현본(docs/plan/provenance/2026-09-16-pubg-harvest/)은
// `data/raw/pubg/matches/*.json`을 남겼는데, 그건 패치 라벨 검증 패스를 **나중에** 돌기 위한
// 것이었고 지금은 축약이 라벨을 함께 담으므로 필요 없다.
//
// **336시간 보존창**: 이 스크립트는 "지금 받을 수 있는 것"만 받는다. 창을 넘긴 날짜는 텔레메트리가
// 404로 사라져 있고, 그 사실을 `expired` 카운터로 **드러낸다**(조용히 적은 표본으로 끝내지 않는다).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { PubgApi, telemetryUrlOf } from "../src/pipeline/collect/pubg/api";
import { reduceTelemetry } from "../src/pipeline/collect/pubg/telemetry-reduce";
import { isMainModule, parseCliArgs } from "./shared/cli";

interface CliArgs {
  days: string[];
  perDay: number;
  concurrency: number;
  dataRoot: string;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-pubg-collect", argv, [
    { name: "days", type: "string", required: true },
    { name: "perDay", type: "number", default: 120 },
    { name: "concurrency", type: "number", default: 8 },
    { name: "dataRoot", type: "string", default: "data" },
  ]);
  const days = String(raw.days)
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  // 날짜는 URL과 파일 경로로 흘러간다 — 형식을 여기서 못 박는다(scripts/shared/cli.ts의
  // PATCH_ID_PATTERN과 같은 이유).
  for (const day of days) {
    if (!DAY_PATTERN.test(day)) throw new Error(`run-pubg-collect: --days 형식 오류: ${day}`);
  }
  if (days.length === 0) throw new Error("run-pubg-collect: --days가 비어 있다");
  const perDay = raw.perDay as number;
  const concurrency = raw.concurrency as number;
  if (perDay <= 0) throw new Error(`run-pubg-collect: --per-day는 양수여야 한다: ${perDay}`);
  if (concurrency <= 0) throw new Error(`run-pubg-collect: --concurrency는 양수여야 한다: ${concurrency}`);
  return { days, perDay, concurrency, dataRoot: String(raw.dataRoot) };
}

export interface CollectStats {
  requested: number;
  reduced: number;
  cached: number;
  noTelemetry: number;
  expired: number;
  failed: number;
}

/** 고정 크기 워커 풀 — 신규 의존성 없이(SCOPE §3) 동시성만 제한한다. */
async function pool<T>(items: readonly T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) throw new Error("run-pubg-collect: PUBG_API_KEY가 없다(.env 또는 시크릿).");

  const outDir = path.join(args.dataRoot, "raw", "pubg", "telemetry-reduced");
  fs.mkdirSync(outDir, { recursive: true });
  const api = new PubgApi({ apiKey });

  // ── Phase A: 날짜별 무작위 표본 id ────────────────────────────────────
  const selected: string[] = [];
  for (const day of args.days) {
    const ids = await api.sampleMatchIds(day);
    const take = ids.slice(0, args.perDay);
    selected.push(...take);
    console.log(`[pubg-collect] ${day}: 표본 ${ids.length}건 중 ${take.length}건 선택`);
  }
  const unique = [...new Set(selected)];
  console.log(`[pubg-collect] 대상 매치 ${unique.length}건(중복 제거 전 ${selected.length})`);

  // ── Phase B: 매치 → 텔레메트리 → 축약 ────────────────────────────────
  const stats: CollectStats = { requested: unique.length, reduced: 0, cached: 0, noTelemetry: 0, expired: 0, failed: 0 };
  let done = 0;
  await pool(unique, args.concurrency, async (matchId) => {
    const outFile = path.join(outDir, `${matchId}.json`);
    if (fs.existsSync(outFile)) {
      stats.cached += 1;
    } else {
      try {
        const match = await api.match(matchId);
        if (!match) {
          stats.failed += 1;
        } else {
          const url = telemetryUrlOf(match);
          if (!url) {
            stats.noTelemetry += 1;
          } else {
            const events = await api.telemetry(url);
            if (!events) {
              // 404는 보존창을 넘긴 것이다 — 일시 오류와 구분해서 센다.
              stats.expired += 1;
            } else {
              const reduced = reduceTelemetry(matchId, match.data.attributes, events);
              fs.writeFileSync(outFile, JSON.stringify(reduced), "utf8");
              stats.reduced += 1;
            }
          }
        }
      } catch (error) {
        stats.failed += 1;
        console.log(`[pubg-collect] ${matchId} 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    done += 1;
    if (done % 100 === 0) console.log(`[pubg-collect] ${done}/${unique.length} ${JSON.stringify(stats)}`);
  });

  console.log(`[pubg-collect] 완료 ${JSON.stringify(stats)}`);
  if (stats.expired > 0) {
    console.log(
      `[pubg-collect] ⚠️ 텔레메트리 만료 ${stats.expired}건 — 336시간 보존창을 넘긴 날짜가 섞여 있다.`
    );
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[pubg-collect] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
