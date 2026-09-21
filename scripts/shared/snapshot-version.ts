// scripts/shared/snapshot-version.ts
// 수치 스냅숏(F9) 버전 해소의 **fs 쪽 절반**. 고르는 규칙은 순수 모듈
// `src/pipeline/gamedata/snapshot-version.ts`가 갖고, 여기는 디스크를 읽어 그 규칙에 먹인다.
//
// 이 파일이 생긴 이유(2026-09-21): F9를 cron에 올리면서 `run-gamedata-diff`와 `run-tft-notes`가
// **같은 질문**("이 패치의 CDragon 추출본은 어느 버전인가")을 하게 됐다. 둘이 각자 답을 만들면
// 다음 세트에서 한쪽만 틀린다 — `run-tft-notes`에 있던 구현을 그대로 이리 옮겼다.
import fs from "node:fs";
import path from "node:path";

import {
  diffFileEndingAt,
  diffFileStartingAt,
  newestVersion,
} from "../../src/pipeline/gamedata/snapshot-version";
import type { GameDataDiffFile } from "../../src/pipeline/gamedata/types";
import { setNumberOfPatch } from "../../src/pipeline/match/tft-catalog";

function listDir(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

/**
 * 그 패치의 세트를 담은 CDragon 추출본 중 가장 새 버전. **세트를 확인한다** — 디렉터리 이름만
 * 보고 최신을 집으면 세트가 넘어간 직후 다음 세트의 수치로 이번 패치를 판정한다.
 */
export function resolveCdragonVersion(dataRoot: string, patch: string): string {
  const dir = path.join(dataRoot, "cdragon");
  const want = `TFTSet${setNumberOfPatch(patch)}`;
  const ofSet = listDir(dir).filter((version) => {
    const file = path.join(dir, version, "tft.json");
    if (!fs.existsSync(file)) return false;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { set?: string };
    return parsed.set === want;
  });
  const picked = newestVersion(ofSet);
  if (!picked) {
    throw new Error(
      `${want} CDragon 추출본이 ${dir}에 없다 — 수치 스냅숏(scripts/run-cdragon.ts)을 먼저 받아야 한다`
    );
  }
  return picked;
}

/** 가장 새 DDragon 스냅숏. `champion.json`이 있는 디렉터리만 후보다(받다 만 것 제외). */
export function resolveDdragonVersion(dataRoot: string): string {
  const dir = path.join(dataRoot, "ddragon");
  const complete = listDir(dir).filter((version) =>
    fs.existsSync(path.join(dir, version, "champion.json"))
  );
  const picked = newestVersion(complete);
  if (!picked) {
    throw new Error(`DDragon 스냅숏이 ${dir}에 없다 — scripts/run-ddragon.ts를 먼저 돌려야 한다`);
  }
  return picked;
}

/**
 * 이미 커밋된 산출물이 **그 패치의 게임 버전을 어떻게 적어 뒀는지** 되읽는다. 없으면 `null`.
 *
 * 패치 번호와 게임 버전의 대응을 새로 저장하지 않는 이유가 이것이다: 지난 실행이 이미 그 사실을
 * 산출물에 적어 커밋했다. 한 패치는 **양쪽 어느 쌍에든** 있을 수 있어 둘 다 본다 —
 * `{x}_{patch}.json`의 `source.to`, 또는 `{patch}_{y}.json`의 `source.from`.
 */
export function recordedVersionOf(dataRoot: string, game: string, patch: string): string | null {
  const dir = path.join(dataRoot, "aggregated", "gamedata", game);
  const files = listDir(dir);
  const asTo = diffFileEndingAt(files, patch);
  if (asTo) return readMeta(path.join(dir, asTo)).source.to || null;
  const asFrom = diffFileStartingAt(files, patch);
  if (asFrom) return readMeta(path.join(dir, asFrom)).source.from || null;
  return null;
}

function readMeta(file: string): GameDataDiffFile["meta"] {
  const meta = (JSON.parse(fs.readFileSync(file, "utf8")) as GameDataDiffFile).meta;
  if (!meta?.source) throw new Error(`${file}에 meta.source가 없다 — 산출물이 손상됐다`);
  return meta;
}

/**
 * 이번 쌍의 `versionFrom`. 기록이 없으면 **던진다** — 조용히 최신 두 개를 짝지으면 엉뚱한 쌍을
 * 대조한 결과가 "잠수함 0건"으로 보인다.
 */
export function resolvePreviousSnapshotVersion(
  dataRoot: string,
  game: string,
  from: string
): string {
  const recorded = recordedVersionOf(dataRoot, game, from);
  if (!recorded) {
    throw new Error(
      `${game} ${from}의 게임 버전이 기록된 산출물이 ` +
        `${path.join(dataRoot, "aggregated", "gamedata", game)}에 없다 — ` +
        `--version-from으로 직접 주거나 그 쌍을 먼저 만들어야 한다`
    );
  }
  return recorded;
}
