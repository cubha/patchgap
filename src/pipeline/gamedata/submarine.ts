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
import {
  isNoteMismatchChange,
  isSubmarineChange,
  type GameDataChange,
  type GameDataDiffFile,
} from "./types";

export interface SubmarineEntity {
  readonly entityType: string;
  readonly entityKey: string;
  readonly entityName: string;
  readonly changes: readonly GameDataChange[];
}

export interface SubmarineIndex {
  /** 잠수함 변경 총수 — 화면 캡션의 재료. */
  readonly count: number;
  changesOf(entityType: string, entityKey: string): readonly GameDataChange[];
  has(entityType: string, entityKey: string): boolean;
  /** 엔티티 단위 목록. 표가 **행을 새로 만들 때** 쓴다. */
  entities(): readonly SubmarineEntity[];
}

/** `entityType:entityKey` — `DeltaRecord`와 `GameDataChange`가 같은 키 체계를 쓴다(실측 확인:
 * 챔피언 `MonkeyKing`·아이템 `6610`이 양쪽에서 동일). */
function keyOf(entityType: string, entityKey: string): string {
  return `${entityType}:${entityKey}`;
}

/**
 * 변경 목록에서 색인을 만든다. **공지된 변경은 담지 않는다.**
 *
 * 파일이 아니라 배열을 받는 형태가 따로 있는 이유: 대조표(`CompareExplorer`)는 클라이언트
 * 컴포넌트라 서버가 **메서드를 가진 색인을 넘길 수 없다**(직렬화 불가). 평문 배열만 건너가고
 * 색인은 클라이언트에서 만든다.
 */
export function buildSubmarineIndexFromChanges(
  changes: readonly GameDataChange[]
): SubmarineIndex {
  return buildIndex(changes, isSubmarineChange);
}

/**
 * **공지값 불일치** 색인 — 노트가 같은 항목을 말했는데 값이 다른 변경(2026-09-21).
 *
 * 잠수함과 **같은 모양·다른 술어**다. 화면 규칙도 같다: 지표 축 게이트와 무관하게 전량 노출하고,
 * 델타 행이 없으면 행을 새로 만든다. 실측 근거가 정확히 그 경우다 — 덩굴정령·어미 부리는 PvE
 * 몬스터라 플레이어 보드 델타가 **0건**이다. 이 색인이 없으면 두 발견이 화면에서 통째로 사라진다.
 */
export function buildNoteMismatchIndexFromChanges(
  changes: readonly GameDataChange[]
): SubmarineIndex {
  return buildIndex(changes, isNoteMismatchChange);
}

function buildIndex(
  changes: readonly GameDataChange[],
  include: (change: GameDataChange) => boolean
): SubmarineIndex {
  const byEntity = new Map<string, GameDataChange[]>();
  let count = 0;
  for (const change of changes) {
    if (!include(change)) continue;
    count += 1;
    const k = keyOf(change.entityType, change.entityKey);
    const list = byEntity.get(k);
    if (list) list.push(change);
    else byEntity.set(k, [change]);
  }
  return {
    count,
    changesOf: (entityType, entityKey) => byEntity.get(keyOf(entityType, entityKey)) ?? [],
    has: (entityType, entityKey) => byEntity.has(keyOf(entityType, entityKey)),
    entities: () =>
      [...byEntity.values()].map((list) => ({
        entityType: list[0].entityType,
        entityKey: list[0].entityKey,
        entityName: list[0].entityName,
        changes: list,
      })),
  };
}

/**
 * 표가 **행을 새로 만들어야 하는** 잠수함 엔티티 — 이미 행이 있는 것은 뺀다.
 *
 * 왜 이 함수가 따로 있는가(2026-09-21 사용자 지시): 지표 축은 게이트를 건다 — 표본 부족·효과크기
 * 바닥 미달·무변화는 `isReportableRecord`가 거르고, 그게 맞다. **잠수함은 그 게이트와 무관하다.**
 * 패치노트에 없는 수치 변경이라는 사실 자체가 발견이고, 지표가 안 움직였다는 것은 그 사실을
 * 약화시키지 않는다(오히려 "바꿨는데 효과가 없었다"는 별도의 정보다).
 *
 * 실측 근거: TFT 18.1→18.2의 잠수함 37건 중 **26건이 델타 행을 갖지 않는다**(강철나무·마트료시카
 * 모루 등 아이템 21종). 게이트를 그대로 두면 표가 그 26건을 한 번도 말하지 않는다.
 *
 * 색인의 술어와 무관하다 — 「공지값 불일치」 색인에도 그대로 쓴다(같은 이유, 더 극단적인 실측:
 * 덩굴정령·어미 부리는 델타 행이 **0건**이다).
 */
export function submarineOnlyEntities(
  index: SubmarineIndex,
  existingKeys: ReadonlySet<string>
): readonly SubmarineEntity[] {
  return index.entities().filter((e) => !existingKeys.has(keyOf(e.entityType, e.entityKey)));
}

/** 여러 게임의 diff 파일을 한 색인으로. */
export function buildSubmarineIndex(files: readonly GameDataDiffFile[]): SubmarineIndex {
  return buildSubmarineIndexFromChanges(files.flatMap((file) => file.changes));
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
