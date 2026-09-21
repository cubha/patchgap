// src/pipeline/gamedata/submarine.ts
// 수치 축을 표시 계층에 얹는다. **`MatchStatus`는 건드리지 않는다**(제약).
//
// 두 축은 직교한다:
//   지표 축(MatchStatus)  — 승률·픽률이 움직였나          · 통계 추론
//   수치 축(GameDataDiff) — 데미지·쿨타임·가격이 바뀌었나 · 문서 대조
//
// 겹치면 수치 축이 이긴다. 근거는 중요도가 아니라 증거 등급이다 — 통계가 "움직였다"고 말하는 것과
// 게임사 데이터가 "바꿨다"고 말하는 것을 같은 줄에 둘 수 없다.
//
// **가장 중요한 귀결**: 지표가 하나도 안 움직여도(`no-change`) 수치가 바뀌었으면 발견이다.
// 기존 파이프라인은 그 행을 `isNoiseStatus`로 지우므로 화면에 아예 나오지 않았다.

import type { DeltaRecord } from "../types";
import { displayStatus, type DisplayStatus } from "../shared/display-status";
import { isSubmarineChange, type GameDataChange, type GameDataDiffFile } from "./types";

export interface SubmarineIndex {
  /** 잠수함 변경 총수 — 화면 캡션의 재료. */
  readonly count: number;
  changesOf(entityType: string, entityKey: string): readonly GameDataChange[];
  has(entityType: string, entityKey: string): boolean;
}

/** `entityType:entityKey` — `DeltaRecord`와 `GameDataChange`가 같은 키 체계를 쓴다(실측 확인:
 * 챔피언 `MonkeyKing`·아이템 `6610`이 양쪽에서 동일). */
function keyOf(entityType: string, entityKey: string): string {
  return `${entityType}:${entityKey}`;
}

/** 여러 게임의 diff 파일을 한 색인으로. **공지된 변경은 담지 않는다.** */
export function buildSubmarineIndex(files: readonly GameDataDiffFile[]): SubmarineIndex {
  const byEntity = new Map<string, GameDataChange[]>();
  let count = 0;
  for (const file of files) {
    for (const change of file.changes) {
      if (!isSubmarineChange(change)) continue;
      count += 1;
      const k = keyOf(change.entityType, change.entityKey);
      const list = byEntity.get(k);
      if (list) list.push(change);
      else byEntity.set(k, [change]);
    }
  }
  return {
    count,
    changesOf: (entityType, entityKey) => byEntity.get(keyOf(entityType, entityKey)) ?? [],
    has: (entityType, entityKey) => byEntity.has(keyOf(entityType, entityKey)),
  };
}

/**
 * 표시 키. `hasSubmarine`이면 지표 축 판정을 **덮어쓴다**.
 *
 * 덮어쓰는 것이 정보 손실이 아닌 이유: 원래 상태는 `record.status`에 그대로 남아 있고, 상세 화면은
 * 두 축을 나란히 보여준다("수치가 바뀌었다" + "지표는 이렇게 움직였다"). 배지 1종 = 상태 1개라는
 * 화면 규약(UX-BRIEF §2-1 9번)을 지키려면 배지 자리에서는 하나를 골라야 한다.
 */
export function displayStatusWithGameData(
  record: DeltaRecord,
  hasSubmarine: boolean,
  qAlpha?: number
): DisplayStatus {
  if (hasSubmarine) return "submarine";
  return displayStatus(record, qAlpha);
}
