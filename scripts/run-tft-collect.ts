// scripts/run-tft-collect.ts
// TFT 원본 수집 진입점.
// 실행: npm run pipeline:tft-collect -- --target 2500
//       [--tiers challenger,grandmaster] [--seed-limit N] [--smoke] [--data-root DIR]
//
// **키는 `RIOT_TFT_API_KEY`를 먼저 본다**(없으면 `RIOT_API_KEY`). 분리해 둔 이유는 TFT 접근이
// 24시간짜리 개발 키로 열릴 수 있는데, 그걸 `RIOT_API_KEY`에 덮어쓰면 만료되는 순간 LoL 크론이
// 같이 죽기 때문이다. 리밋 자체는 **키 단위**라, 두 변수에 같은 키를 넣으면 예산도 공유된다.
//
// `--smoke`는 아주 작게(플레이어 5명·패치당 25매치) 돌려 **응답 스키마와 패치 분포만 확인**한다.
// 본 수집 전에 이걸 먼저 돌린다 — 예산이 가장 비싼 단계라 헛돌면 시간이 통째로 날아간다.

import "dotenv/config";

import { createTftClient, type TftTier } from "../src/pipeline/collect/tft-client";
import { crawlTft } from "../src/pipeline/collect/tft-crawler";
import { TFT_PATCH_WINDOWS as PATCH_WINDOWS } from "../src/pipeline/collect/tft-patch-calendar";
import { isMainModule, parseCliArgs } from "./shared/cli";

const VALID_TIERS: readonly TftTier[] = ["challenger", "grandmaster", "master"];

// 패치 창 상수는 `src/pipeline/collect/tft-patch-calendar.ts`가 소유한다(2026-09-20 승격).
// **워크플로 `determine` 스텝이 같은 상수를 읽어야** 하는데, 스크립트 안에 있으면 CI가 규칙을
// 다시 적게 되고 두 곳이 조용히 갈라진다. 기존 import 경로를 깨지 않으려고 여기서 재수출한다.
export { TFT_PATCH_WINDOWS } from "../src/pipeline/collect/tft-patch-calendar";

interface CliArgs {
  target: number;
  tiers?: TftTier[];
  seedLimit?: number;
  idsPerPlayer: number;
  smoke: boolean;
  dataRoot: string;
  platform: string;
  region: string;
}

function parseTiers(raw: string): TftTier[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const tier = VALID_TIERS.find((valid) => valid === t);
      if (!tier) throw new Error(`run-tft-collect: 알 수 없는 --tiers 값 "${t}" (challenger|grandmaster|master)`);
      return tier;
    });
}

export function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-tft-collect", argv, [
    { name: "target", type: "number", default: 2500 },
    { name: "tiers", type: "string" },
    { name: "seedLimit", type: "number" },
    { name: "idsPerPlayer", type: "number", default: 200 },
    { name: "smoke", type: "boolean", default: false },
    { name: "dataRoot", type: "string", default: "data" },
    { name: "platform", type: "string", default: "kr" },
    { name: "region", type: "string", default: "asia" },
  ]);

  const target = Number(raw.target);
  if (!Number.isInteger(target) || target <= 0) {
    throw new Error(`run-tft-collect: --target은 양의 정수여야 한다 (받은 값: ${String(raw.target)})`);
  }
  const idsPerPlayer = Number(raw.idsPerPlayer);
  if (!Number.isInteger(idsPerPlayer) || idsPerPlayer <= 0 || idsPerPlayer > 200) {
    throw new Error(`run-tft-collect: --ids-per-player는 1~200 (받은 값: ${String(raw.idsPerPlayer)})`);
  }
  const seedLimit = raw.seedLimit === undefined ? undefined : Number(raw.seedLimit);
  if (seedLimit !== undefined && (!Number.isInteger(seedLimit) || seedLimit <= 0)) {
    throw new Error(`run-tft-collect: --seed-limit은 양의 정수여야 한다`);
  }

  return {
    target,
    tiers: typeof raw.tiers === "string" ? parseTiers(raw.tiers) : undefined,
    seedLimit,
    idsPerPlayer,
    smoke: raw.smoke === true,
    dataRoot: String(raw.dataRoot),
    platform: String(raw.platform),
    region: String(raw.region),
  };
}

/** `RIOT_TFT_API_KEY` → `RIOT_API_KEY` 순. 둘 다 없으면 조용히 넘어가지 않고 던진다. */
export function resolveApiKey(source: Partial<NodeJS.ProcessEnv> = process.env): string {
  const key = source.RIOT_TFT_API_KEY?.trim() || source.RIOT_API_KEY?.trim();
  if (!key) {
    throw new Error("run-tft-collect: RIOT_TFT_API_KEY(또는 RIOT_API_KEY)가 없다 — .env를 확인한다.");
  }
  return key;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = resolveApiKey();

  const target = args.smoke ? 25 : args.target;
  const seedLimit = args.smoke ? 5 : (args.seedLimit ?? 400);
  const outDir = `${args.dataRoot}/raw/tft`;

  console.log(
    `[tft-collect] ${args.smoke ? "스모크" : "본 수집"} · 패치당 ${target}매치 · 시드 ${seedLimit}명 · ${outDir}`
  );

  const client = createTftClient({ apiKey, platform: args.platform, region: args.region });
  const startedAt = Date.now();
  try {
    const result = await crawlTft({
      client,
      windows: PATCH_WINDOWS,
      targetPerPatch: target,
      tiers: args.tiers,
      seedLimit,
      idsPerPlayer: args.idsPerPlayer,
      outDir,
      onProgress: (e) => {
        if (e.phase === "match") console.log(`  적재 ${e.stored} · 창 밖 ${e.skipped}`);
        else if (e.detail) console.log(`  [${e.phase}] ${e.detail}`);
      },
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(`\n[tft-collect] 완료 (${elapsed}s)`);
    console.log(`  시드 ${result.seeds}명 · 조회 ${result.requested}건 · 창 밖 ${result.skipped}건`);
    for (const [patch, n] of Object.entries(result.storedByPatch)) {
      console.log(`  ${patch}: ${n}매치`);
    }
    console.log(`  큐 불일치로 버림: ${result.offQueue}건`);
    console.log(`  game_version 분포: ${JSON.stringify(result.versionHistogram)}`);

    // 스모크의 목적은 "돌았다"가 아니라 **두 패치가 다 모이는가**다 — 하나라도 0이면 대조가
    // 성립하지 않으므로 그 사실을 크게 알린다(자동으로 실패시키지는 않는다; 표본이 작아서
    // 우연히 0일 수도 있다).
    const empty = Object.entries(result.storedByPatch).filter(([, n]) => n === 0);
    if (empty.length > 0) {
      console.warn(
        `\n  ⚠ 표본 0인 패치: ${empty.map(([p]) => p).join(", ")} — before/after 대조가 성립하지 않는다. ` +
          `시드·ID 수를 늘리거나 그 패치가 매치 이력에서 이미 밀려났는지 확인한다.`
      );
    }
  } finally {
    await client.dispose();
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[tft-collect] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
