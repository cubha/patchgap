// src/lib/gamedata.ts
// 잠수함 패치 산출물(F9) 로더 — 빌드 타임에만 읽는다(정적 export, 런타임 외부 호출 0).
//
// 판정 산출물(`data/aggregated/deltas/*`)과 **섞지 않는다**. 두 축은 직교하고, 이 파일이 없어도
// 사이트는 그대로 뜬다(게임마다 어댑터 준비 시점이 다르다 — TFT는 SCOPE 갱신 대기 중).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "@/pipeline/shared/paths";
import type { GameDataChange, GameDataDiffFile } from "@/pipeline/gamedata/types";
import { isSubmarineChange } from "@/pipeline/gamedata/types";

export function gameDataDiffFile(game: string, from: string, to: string, dataRoot = DATA_ROOT): string {
  return path.join(dataRoot, "aggregated", "gamedata", game, `${from}_${to}.json`);
}

/** 없으면 `null` — 그 게임·그 쌍은 화면에서 이 섹션이 통째로 빠진다(PUBG 출하 게이트와 같은 규약). */
export function loadGameDataDiff(
  game: string,
  from: string,
  to: string,
  dataRoot = DATA_ROOT
): GameDataDiffFile | null {
  const file = gameDataDiffFile(game, from, to, dataRoot);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as GameDataDiffFile;
}

export interface SubmarineSummary {
  /** 노트에 없는 수치 변경 — 이게 잠수함 패치다. */
  readonly submarines: GameDataDiffFile["changes"];
  /** 검출된 수치 변경 전체(공지된 것 포함). "N건 중 M건" 문장의 분모. */
  readonly changeCount: number;
  readonly source: GameDataDiffFile["meta"]["source"];
}

export function summarizeGameData(file: GameDataDiffFile | null): SubmarineSummary | null {
  if (!file) return null;
  return {
    submarines: file.changes.filter(isSubmarineChange),
    changeCount: file.meta.changeCount,
    source: file.meta.source,
  };
}

/**
 * 한 엔티티의 잠수함 변경만. 상세 화면(「패치노트가 말하지 않은 것」 구획)이 쓴다.
 *
 * 색인(`buildSubmarineIndexFromChanges`)을 쓰지 않는 이유: 상세는 엔티티 **하나**만 보므로
 * Map을 세울 이유가 없고, 서버 컴포넌트에서 한 번 훑는 편이 읽기 쉽다.
 */
export function submarineChangesFor(
  file: GameDataDiffFile | null,
  entityType: string,
  entityKey: string
): readonly GameDataChange[] {
  if (!file) return [];
  return file.changes.filter(
    (c) => isSubmarineChange(c) && c.entityType === entityType && c.entityKey === entityKey
  );
}
