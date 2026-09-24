// scripts/shared/aggregated-latest.ts
// **화면이 보는 최신 패치**를 디스크에서 읽는다 — 판정 규칙은 `staleness.ts`(순수)가 갖고,
// 이 파일은 I/O만 한다(이 저장소의 determine 스크립트들과 같은 분리).
//
// 세 게임의 산출물 경로·파일명이 다르다. 통일된 것은 **`meta.to`** 하나뿐이라 그것을 키로 삼는다:
//
//   lol   data/aggregated/deltas/{from}_{to}.json     ← `.notify.json`은 브리핑 발송본이라 제외
//   tft   data/aggregated/tft/deltas-{from}-{to}.json
//   pubg  data/aggregated/pubg/deltas.json            ← 파일이 하나라 이름에 패치가 없다
//
// **파일명에서 패치를 긁지 않는 이유**: PUBG는 이름에 패치가 없고(`deltas.json` 고정), LoL·TFT는
// 구분자가 서로 다르다(`_` vs `-`). 이름 파싱을 세 벌 두면 그중 하나가 반드시 어긋난다 —
// 내용이 이미 답을 갖고 있으므로 내용을 읽는다.

import fs from "node:fs";
import path from "node:path";

import { latestPatchId, type StalenessGame } from "../../src/pipeline/collect/staleness";

interface DeltasMetaFile {
  meta?: { to?: unknown };
}

/** 파일 하나에서 `meta.to`를 꺼낸다. 깨진 파일은 **조용히 건너뛴다** — 감시자를 죽이지 않는다. */
function metaToOf(file: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DeltasMetaFile;
    const to = parsed.meta?.to;
    return typeof to === "string" && to.length > 0 ? to : null;
  } catch {
    return null;
  }
}

function filesIn(dir: string, keep: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(keep)
    .map((name) => path.join(dir, name));
}

/** 그 게임의 집계 산출물 중 최신 `meta.to`. 산출물이 없으면 `null`. */
export function aggregatedLatestOf(game: StalenessGame, dataRoot = "data"): string | null {
  const root = path.join(dataRoot, "aggregated");
  let files: string[];
  switch (game) {
    case "lol":
      // `.notify.json`은 디스코드 발송본이라 같은 쌍을 두 번 세게 만든다(값은 같아도 의미가 다르다).
      files = filesIn(path.join(root, "deltas"), (n) => n.endsWith(".json") && !n.endsWith(".notify.json"));
      break;
    case "tft":
      files = filesIn(path.join(root, "tft"), (n) => n.startsWith("deltas-") && n.endsWith(".json"));
      break;
    case "pubg":
      files = [path.join(root, "pubg", "deltas.json")].filter((f) => fs.existsSync(f));
      break;
  }
  const tos = files.map(metaToOf).filter((v): v is string => v !== null);
  return latestPatchId(tos);
}
