// scripts/run-collect.ts
// F1 파이프라인 진입점 — dotenv 로드 후 crawlPatch 호출.
// 실행: npm run pipeline:collect -- --patch 26.17 --target 10000
//       [--tiers challenger,grandmaster] [--seed-limit N] [--dry-run]

import "dotenv/config";
import { loadEnv } from "../src/pipeline/shared/env";
import { createRiotClient, type LeagueTier } from "../src/pipeline/collect/riot-client";
import { crawlPatch } from "../src/pipeline/collect/crawler";
import { patchWindow } from "../src/pipeline/collect/patch-calendar";
import { loadLolCalendar } from "./shared/calendar";
import { isMainModule, parseCliArgs } from "./shared/cli";

const VALID_TIERS: readonly LeagueTier[] = ["challenger", "grandmaster", "master"];

interface CliArgs {
  patch: string;
  target: number;
  tiers?: LeagueTier[];
  seedLimit?: number;
  dryRun: boolean;
}

function parseTiers(raw: string): LeagueTier[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const tier = VALID_TIERS.find((valid) => valid === t);
      if (!tier) {
        throw new Error(`run-collect: invalid --tiers value "${t}" (challenger|grandmaster|master)`);
      }
      return tier;
    });
}

function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-collect", argv, [
    { name: "patch", type: "patch", required: true },
    { name: "target", type: "number", default: 10000 },
    { name: "tiers", type: "string" },
    { name: "seedLimit", type: "number" },
    { name: "dryRun", type: "boolean", default: false },
  ]);

  const patch = raw.patch as string;
  const target = raw.target as number;
  const seedLimit = raw.seedLimit as number | undefined;
  const tiersRaw = raw.tiers as string | undefined;
  const dryRun = raw.dryRun as boolean;

  if (target <= 0) {
    throw new Error(`run-collect: --target must be a positive number (got "${target}")`);
  }
  if (seedLimit !== undefined && seedLimit <= 0) {
    throw new Error(`run-collect: --seed-limit must be a positive number (got "${seedLimit}")`);
  }
  const tiers = tiersRaw !== undefined ? parseTiers(tiersRaw) : undefined;

  const calendar = loadLolCalendar();
  if (!Object.prototype.hasOwnProperty.call(calendar, patch)) {
    throw new Error(
      `run-collect: --patch "${patch}" is not registered in PATCH_CALENDAR ` +
        `(${Object.keys(calendar).join(", ")}) — crawlPatch would throw on this patch anyway, ` +
        `checked here so --dry-run catches it too.`
    );
  }

  return { patch, target, tiers, seedLimit, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(
    `[run-collect] patch=${args.patch} target=${args.target}` +
      (args.tiers ? ` tiers=${args.tiers.join(",")}` : "") +
      (args.seedLimit !== undefined ? ` seedLimit=${args.seedLimit}` : "") +
      (args.dryRun ? " (dry-run)" : "")
  );

  if (args.dryRun) {
    console.log("[run-collect] --dry-run: 인자 검증만 수행하고 실제 수집은 건너뜁니다.");
    return;
  }

  const env = loadEnv();
  const client = createRiotClient({
    apiKey: env.RIOT_API_KEY,
    platform: "kr",
    region: "asia",
  });

  const abortController = new AbortController();
  const onSigint = (): void => {
    console.log("\n[run-collect] SIGINT 수신 — 현재 처리 중인 매치까지 마치고 정상 종료합니다.");
    abortController.abort();
  };
  process.on("SIGINT", onSigint);

  try {
    const result = await crawlPatch(client, {
      patch: args.patch,
      // 시간창을 **여기서** 계산해 넘긴다 — crawler가 스스로 부르면 기저 상수만 보고,
      // 감시자가 오버레이에 넣은 새 패치는 "등록 안 됨"으로 던진다.
      window: patchWindow(args.patch, Date.now, loadLolCalendar()),
      target: args.target,
      tiers: args.tiers,
      seedLimit: args.seedLimit,
      signal: abortController.signal,
      onProgress: (snapshot) => {
        console.log(
          `[run-collect] ${snapshot.collected}/${snapshot.target} · seen=${snapshot.seen} · ` +
            `${snapshot.rateMatchesPerMin.toFixed(1)} matches/min`
        );
      },
    });
    console.log(
      `[run-collect] 완료 — collected=${result.collected} skippedVersion=${result.skippedVersion} ` +
        `skippedSeen=${result.skippedSeen} errors=${result.errors}`
    );
  } finally {
    process.off("SIGINT", onSigint);
    await client.dispose();
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error("run-collect 실패:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
