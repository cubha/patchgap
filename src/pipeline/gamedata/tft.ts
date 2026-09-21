// src/pipeline/gamedata/tft.ts
// TFT 어댑터 — Community Dragon이 배포한 세트 데이터를 패치 간 diff한다.
//
// 왜 Community Dragon인가(SCOPE §3, 2026-09-21 사용자 승인): Data Dragon의 `tft-champion.json`은
// 이름·아이콘·cost뿐이라 **수치가 아예 없다**(실측). 유닛 `stats`·`ability.variables`를 주는 공식
// 소스가 존재하지 않는다. 비공식 미러이므로 빌드 타임에만 부르고, 수치 필드만 뽑아
// `data/cdragon/{version}/tft.json`에 커밋한다 — 미러가 사라져도 과거 판정은 남는다.
//
// LoL 어댑터와 다른 점 하나: **float32 잡음을 걸러야 한다.** CDragon은 게임 내부 float32를 그대로
// 내보내서 `0.039999961853027344` 같은 값이 나온다. 끝자리 차이를 수치 변경으로 읽으면 잠수함이
// 수십 건 허위로 생긴다.

import { buildChange, type GameDataValue } from "./diff";
import { linkNotes, type NoteLike } from "./note-link";
import type { GameDataChange } from "./types";

export interface CdragonUnit {
  readonly name: string | null;
  readonly cost: number | null;
  readonly stats: Record<string, number>;
  /** 스킬 변수 — 이름이 있는 것만(해시 키 `{0f6cb861}`는 화면에 쓸 수 없다). */
  readonly ability: Record<string, unknown>;
}

export interface CdragonItem {
  readonly name: string | null;
  readonly effects: Record<string, number>;
}

export interface CdragonSnapshot {
  readonly version: string;
  readonly set: string;
  readonly units: Record<string, CdragonUnit>;
  readonly items: Record<string, CdragonItem>;
}

/**
 * 같은 값으로 볼 것인가. float32 왕복 오차를 흡수한다.
 *
 * 상대 오차 1e-6을 쓴다 — float32의 유효 정밀도(약 7자리)보다 한 자리 느슨해서 잡음은 전부 먹고,
 * 실제 밸런스 변경(가장 작은 것이 0.12 → 0.14 수준)은 절대 먹지 않는다.
 */
export function sameNumber(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return true;
  return Math.abs(a - b) / scale < 1e-6;
}

/** 스킬 변수 값은 스칼라이거나 레벨별 배열이다. 배열은 문자열로 접어 원문을 보존한다. */
function abilityValue(raw: unknown): GameDataValue {
  if (typeof raw === "number") return raw;
  if (Array.isArray(raw)) {
    const nums = raw.filter((v): v is number => typeof v === "number");
    if (nums.length === 0) return null;
    return nums.map((v) => Number(v.toFixed(4))).join("/");
  }
  return null;
}

/** 스킬 변수 이름이 해시(`{0f6cb861}`)면 사람에게 보여줄 수 없다 — 화면 밖으로 뺀다. */
function isHashName(name: string): boolean {
  return /^\{[0-9a-f]+\}$/.test(name);
}

/** CDragon 통계 키 → (표시 라벨, 노트 대조 낱말). 여기 없는 키는 판정하지 않는다. */
const UNIT_STAT_LABELS: Record<string, readonly [string, readonly string[]]> = {
  hp: ["체력", ["체력"]],
  damage: ["공격력", ["공격력", "피해량"]],
  armor: ["방어력", ["방어력"]],
  magicResist: ["마법 저항력", ["마법 저항력", "마저"]],
  attackSpeed: ["공격 속도", ["공격 속도"]],
  mana: ["최대 마나", ["마나"]],
  initialMana: ["시작 마나", ["마나"]],
  critChance: ["치명타 확률", ["치명타"]],
  critMultiplier: ["치명타 배수", ["치명타"]],
  range: ["사거리", ["사거리"]],
};

export function diffTft(
  before: CdragonSnapshot,
  after: CdragonSnapshot,
  notes: readonly NoteLike[],
  patch: string
): GameDataChange[] {
  const out: GameDataChange[] = [];

  const push = (
    entityKey: string,
    entityName: string,
    entityType: string,
    field: string,
    fieldPath: string,
    b: GameDataValue,
    a: GameDataValue,
    keywords: readonly string[]
  ) => {
    out.push(
      buildChange({
        game: "tft",
        patch,
        entityKey,
        entityName,
        entityType,
        field,
        fieldPath,
        before: b,
        after: a,
        matchedNoteIds: linkNotes({ entityName, fieldKeywords: keywords }, notes),
      })
    );
  };

  for (const key of Object.keys(after.units).sort()) {
    const prev = before.units[key];
    const next = after.units[key];
    if (!prev || !next) continue;
    const name = next.name;
    if (!name) continue;

    if (prev.cost !== next.cost) {
      push(key, name, "unit", "비용", "cost", prev.cost, next.cost, ["비용", "골드"]);
    }

    for (const stat of Object.keys(next.stats).sort()) {
      const a = prev.stats[stat];
      const b = next.stats[stat];
      if (typeof a !== "number" || typeof b !== "number") continue;
      if (sameNumber(a, b)) continue;
      const label = UNIT_STAT_LABELS[stat];
      if (!label) continue;
      push(key, name, "unit", label[0], `stats.${stat}`, a, b, label[1]);
    }

    for (const varName of Object.keys(next.ability).sort()) {
      if (isHashName(varName)) continue;
      const a = abilityValue(prev.ability[varName]);
      const b = abilityValue(next.ability[varName]);
      if (a === null || b === null || a === b) continue;
      if (typeof a === "number" && typeof b === "number" && sameNumber(a, b)) continue;
      // 스킬 변수는 노트가 어떤 낱말로 부르는지 알 수 없다(CDragon `Damage`를 노트는 "구체당
      // 스킬 피해량"이라 부른다) — 엔티티 언급만으로 공지 판정한다. LoL effectBurn과 같은
      // 이유·같은 방향이되, TFT는 스킬 축(Q~R)조차 없어 `entityMatchSuffices`를 쓴다.
      out.push(
        buildChange({
          game: "tft",
          patch,
          entityKey: key,
          entityName: name,
          entityType: "unit",
          field: `스킬 ${varName}`,
          fieldPath: `ability.${varName}`,
          before: a,
          after: b,
          matchedNoteIds: linkNotes(
            { entityName: name, fieldKeywords: [], entityMatchSuffices: true },
            notes
          ),
        })
      );
    }
  }

  for (const key of Object.keys(after.items).sort()) {
    const prev = before.items[key];
    const next = after.items[key];
    if (!prev || !next) continue;
    const name = next.name;
    if (!name) continue;
    for (const effect of Object.keys(next.effects).sort()) {
      if (isHashName(effect)) continue;
      const a = prev.effects[effect];
      const b = next.effects[effect];
      if (typeof a !== "number" || typeof b !== "number") continue;
      if (sameNumber(a, b)) continue;
      push(key, name, "item", `효과 ${effect}`, `effects.${effect}`, a, b, [effect]);
    }
  }

  return out;
}
