// scripts/run-cdragon.ts
// TFT 수치 스냅숏 수집 — Community Dragon 원본에서 판정에 쓰는 필드만 뽑아 커밋 가능한 크기로 남긴다.
// 실행: npm run pipeline:cdragon -- --patch 18.2 [--version 16.18] [--data-root DIR]
//
// 산출: data/cdragon/{version}/tft.json  (실측 24.6MB → 348KB)
//
// **왜 이 스크립트가 늦게 생겼나(2026-09-21)**: `data/cdragon/{16.17,16.18}`은 파이프라인 **밖에서**
// 만들어져 커밋됐다. 수치 축(F9)만 쓸 때는 두 개로 충분했는데, 노트 카탈로그까지 이 파일에
// 의존하게 되자 "패치마다 사람이 손으로 스냅숏을 늘려야 하는" 구조가 됐다. DDragon은
// `run-ddragon.ts`가 이미 패치마다 받아 온다 — 그 자리에 있어야 할 짝이 비어 있었을 뿐이다.
//
// 추출 규칙은 `src/pipeline/gamedata/cdragon.ts`가 소유하고, 그 규칙은 **커밋된 두 스냅숏을
// 그대로 재현하도록** 역산해 확정했다(키 순서까지 동일 확인). 이 스크립트는 fetch·fs만 한다.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { extractTftSnapshot, type CdragonRaw } from "../src/pipeline/gamedata/cdragon";
import { setNumberOfPatch } from "../src/pipeline/match/tft-catalog";
import { isMainModule, parseCliArgs } from "./shared/cli";

const CDRAGON_BASE = "https://raw.communitydragon.org";
const DDRAGON_VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json";

/** `16.18` 같은 라벨 — CDragon 브랜치 이름이자 산출 디렉터리 이름이다. */
export function branchOfDdragonVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length < 2) throw new Error(`DDragon 버전 형식을 읽을 수 없다: ${version}`);
  return `${parts[0]}.${parts[1]}`;
}

export function cdragonUrl(branch: string, locale: string): string {
  return `${CDRAGON_BASE}/${branch}/cdragon/tft/${locale}.json`;
}

interface CliArgs {
  patch: string;
  version: string;
  locale: string;
  dataRoot: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const raw = parseCliArgs("run-cdragon", argv, [
    { name: "patch", type: "patch", required: true },
    { name: "version", type: "string", default: "" },
    { name: "locale", type: "string", default: "ko_kr" },
    { name: "dataRoot", type: "string", default: "data" },
  ]);
  const version = String(raw.version);
  // 디렉터리 이름이 되는 값이라 형식을 강제한다 — `parseCliArgs`의 `patch` 타입이 같은 이유로
  // 존재한다(임의 문자열이 경로 조합에 그대로 흘러드는 것을 막는다).
  if (version && !/^\d{1,2}\.\d{1,2}$/.test(version)) {
    throw new Error(`run-cdragon: --version 형식이 올바르지 않습니다(예 16.18): ${version}`);
  }
  return {
    patch: String(raw.patch),
    version,
    locale: String(raw.locale),
    dataRoot: String(raw.dataRoot),
  };
}

/**
 * 버전을 안 주면 **DDragon 최신**의 major.minor를 쓴다.
 *
 * TFT 패치 번호(18.2)와 게임 버전(16.18)의 대응은 규칙이 아니라 사실이라 계산할 수 없다. 대신
 * cron은 "지금 라이브인 패치"를 받으므로 최신이 곧 정답이고, 커밋된 두 스냅숏도 그 규칙으로
 * 이름이 붙어 있다(16.17·16.18 = 당시 DDragon 최신).
 */
async function resolveBranch(given: string): Promise<string> {
  if (given) return given;
  const res = await fetch(DDRAGON_VERSIONS);
  if (!res.ok) throw new Error(`DDragon versions.json ${res.status}`);
  const versions = (await res.json()) as string[];
  const latest = versions[0];
  if (!latest) throw new Error("DDragon versions.json이 비어 있다");
  return branchOfDdragonVersion(latest);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const setNumber = setNumberOfPatch(args.patch);
  const branch = await resolveBranch(args.version);
  const url = cdragonUrl(branch, args.locale);

  console.log(`[cdragon] 가져오는 중: ${url} (Set ${setNumber})`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Community Dragon ${res.status} ${res.statusText} — ${url}`);
  const body = await res.text();
  const snapshot = extractTftSnapshot(JSON.parse(body) as CdragonRaw, setNumber);

  const units = Object.keys(snapshot.units).length;
  const items = Object.keys(snapshot.items).length;
  if (units === 0) {
    throw new Error(`[cdragon] Set ${setNumber} 유닛이 0종이다 — 세트나 버전이 어긋났다`);
  }
  const json = JSON.stringify(snapshot);
  console.log(
    `[cdragon] 원본 ${(body.length / 1e6).toFixed(1)}MB → 스냅숏 ${(json.length / 1e3).toFixed(0)}KB · ` +
      `유닛 ${units}종 · 아이템 ${items}종`
  );

  const out = path.join(args.dataRoot, "cdragon", branch, "tft.json");
  // 이미 같은 내용이면 쓰지 않는다 — 같은 패치에서 cron이 두 번 돌아도 커밋 diff가 안 생긴다.
  if (fs.existsSync(out) && fs.readFileSync(out, "utf8") === json) {
    console.log(`[cdragon] 변화 없음: ${out}`);
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json, "utf8");
  console.log(`[cdragon] 저장: ${out}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[cdragon] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
