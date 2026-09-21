// src/pipeline/gamedata/diff.ts
// 게임 무관 diff 엔진 — 어댑터(lol·tft·pubg)가 값 맵을 주면 변경 레코드를 만든다.
//
// 순수 함수만 둔다(aggregate/* 와 같은 규율) — fetch·fs는 어댑터와 스크립트의 몫이다.

import type { GameDataChange } from "./types";

/** 값 하나. 숫자이거나 레벨별 배열 문자열(`"75/115/155"`)이거나 없음. */
export type GameDataValue = number | string | null;

export interface ValueDiff {
  readonly key: string;
  readonly before: GameDataValue;
  readonly after: GameDataValue;
}

/**
 * 상대 변화. **숫자끼리일 때만** 낸다.
 *
 * 레벨별 배열(`"75/115/155/195/235" ⇒ "70/110/150/190/230"`)을 한 숫자로 요약하면 거짓말이 된다 —
 * 레벨마다 변화율이 다르고, 어느 레벨을 대표로 삼을지는 이 층이 결정할 문제가 아니다. 화면은
 * `before`/`after` 원문을 그대로 보여주고 %는 생략한다(무근거 문장은 회색 원칙의 연장).
 */
export function relativeChange(before: GameDataValue, after: GameDataValue): number | null {
  if (typeof before !== "number" || typeof after !== "number") return null;
  if (before === 0) return null;
  return (after - before) / before;
}

/** `gdc:{game}:{patch}:{entityKey}:{fieldPath}` — 결정론적이라 재생성해도 화면 링크가 유지된다. */
export function changeId(game: string, patch: string, entityKey: string, fieldPath: string): string {
  return `gdc:${game}:${patch}:${entityKey}:${fieldPath}`;
}

/**
 * 두 값 맵의 차이. **한쪽에만 있는 키도 변경이다** — 아이템이 스탯을 갈아끼우면
 * (실측 26.17 리글의 랜턴: 공격력 25 → 없음, 공격 속도 없음 → 0.3) 그 형태로 온다.
 * 없는 쪽은 `null`로 채운다.
 *
 * 키를 정렬해 내보내는 이유: 산출물이 실행마다 흔들리면 커밋 diff가 의미를 잃는다.
 */
export function diffValueMap(
  before: Readonly<Record<string, GameDataValue | undefined>>,
  after: Readonly<Record<string, GameDataValue | undefined>>
): ValueDiff[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const out: ValueDiff[] = [];
  for (const key of [...keys].sort()) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (a === b) continue;
    out.push({ key, before: a, after: b });
  }
  return out;
}

export interface BuildChangeInput {
  readonly game: string;
  readonly patch: string;
  readonly entityKey: string;
  readonly entityName: string;
  readonly entityType: string;
  readonly field: string;
  readonly fieldPath: string;
  readonly before: GameDataValue;
  readonly after: GameDataValue;
  readonly matchedNoteIds: readonly string[];
}

export function buildChange(input: BuildChangeInput): GameDataChange {
  return {
    id: changeId(input.game, input.patch, input.entityKey, input.fieldPath),
    entityKey: input.entityKey,
    entityName: input.entityName,
    entityType: input.entityType,
    field: input.field,
    fieldPath: input.fieldPath,
    before: input.before,
    after: input.after,
    relChange: relativeChange(input.before, input.after),
    matchedNoteIds: [...input.matchedNoteIds],
  };
}
