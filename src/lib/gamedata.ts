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
import { isNoteMismatchChange, isSubmarineChange } from "@/pipeline/gamedata/types";
import {
  buildNoteMismatchIndexFromChanges,
  buildSubmarineIndexFromChanges,
  type SubmarineEntity,
} from "@/pipeline/gamedata/submarine";

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
  /**
   * **대상 단위** 묶음(2026-09-21 사용자 지시). 화면이 세는 단위는 값이 아니라 **대상**이다 —
   * "대상 27종 · 값 33개"처럼 둘을 나란히 쓰면 어느 쪽이 발견의 크기인지 헷갈린다.
   * 대상별 값 개수는 그 대상의 **행 안에서** 말한다(표는 "외 N건", 상세는 전부 나열).
   */
  readonly entities: readonly SubmarineEntity[];
  /**
   * 노트가 말했는데 **값이 어긋난** 대상(2026-09-21). 잠수함과 **다른 발견**이라 같은 줄에
   * 세지 않는다 — 하나로 뭉치면 "말하지 않았다"와 "말했는데 틀렸다" 중 하나는 거짓말이 된다.
   */
  readonly mismatches: readonly SubmarineEntity[];
  /** 검출된 수치 변경 전체(공지된 것 포함). 0건 증명 문장의 분모. */
  readonly changeCount: number;
  readonly source: GameDataDiffFile["meta"]["source"];
}

export function summarizeGameData(file: GameDataDiffFile | null): SubmarineSummary | null {
  if (!file) return null;
  const submarines = file.changes.filter(isSubmarineChange);
  return {
    submarines,
    entities: buildSubmarineIndexFromChanges(submarines).entities(),
    mismatches: buildNoteMismatchIndexFromChanges(file.changes).entities(),
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

/** 한 엔티티의 **공지값 불일치**만. 상세 「패치노트 대조」 카드가 쓴다. */
export function noteMismatchChangesFor(
  file: GameDataDiffFile | null,
  entityType: string,
  entityKey: string
): readonly GameDataChange[] {
  if (!file) return [];
  return file.changes.filter(
    (c) => isNoteMismatchChange(c) && c.entityType === entityType && c.entityKey === entityKey
  );
}

/**
 * 홈 「미공지 Gap」 탭이 세는 **수치 축 대상 수** — 잠수함 + 공지값 불일치.
 *
 * 함수로 두는 이유: 세 홈이 같은 식을 각자 쓰고 있었고, 2026-09-21에 수치 축이 두 갈래가 되자
 * 세 곳을 전부 고쳐야 했다. 다음에 갈래가 늘어도 여기만 고치면 된다.
 */
export function gameDataEntityCount(summary: SubmarineSummary | null): number {
  if (!summary) return 0;
  return summary.entities.length + summary.mismatches.length;
}
