// src/pipeline/gamedata/lol.ts
// LoL 어댑터 — Data Dragon이 배포한 원본 수치를 패치 간 diff한다.
//
// **모드 스코프 게이트가 이 파일의 핵심이다.** `item.json`은 소환사의 협곡뿐 아니라 칼바람·아레나·
// 기타 모드의 아이템을 전부 담는다. 2026-09-21 실측에서 후보 5종이 잡혔는데 **전부 협곡 밖**이었다
// (도미닉 경의 인사·필멸자의 운명 = maps 30, 리글의 랜턴·야생의 섬광 = maps 12/453, 폭풍갈퀴
// 칼바람판 = maps 30). 이 저장소는 같은 축에서 한 번 크게 틀린 적이 있다 — 패치노트 h2 「클래식」을
// 소환사의 협곡으로 오귀속해 판정 126건이 그 위에 서 있었다(`modeScope` 신설로 차단).
//
// 스킬 수치(`effectBurn`)는 인덱스의 의미를 DDragon이 알려주지 않는다(`effect[1]`이 피해량인지
// 슬로우인지 모른다). 그래서 스킬 축 변경은 **그 스킬을 언급한 노트가 하나라도 있으면 공지로
// 본다** — 보수적으로 틀리는 쪽(잠수함을 덜 찾는 쪽)을 고른다. 근거 없이 "잠수함이다"라고
// 말하는 것이 이 프로젝트에서 더 큰 잘못이다.

import { buildChange, diffValueMap, type GameDataValue } from "./diff";
import { linkedNotes, noteValueMismatch, type NoteLike } from "./note-link";
import type { GameDataChange } from "./types";

/** 소환사의 협곡. `item.json`의 `maps` 키. */
const SUMMONERS_RIFT = "11";

interface DdragonChampion {
  readonly name: string;
  readonly stats: Record<string, number>;
}

interface DdragonItem {
  readonly name: string;
  readonly maps?: Record<string, boolean>;
  readonly gold?: { readonly total?: number };
  readonly stats?: Record<string, number>;
}

interface DdragonSpell {
  readonly cooldownBurn?: string;
  readonly costBurn?: string;
  readonly rangeBurn?: string;
  readonly effectBurn?: readonly (string | null)[];
}

interface DdragonChampionDetail {
  readonly spells?: readonly DdragonSpell[];
}

export interface DdragonSnapshot {
  readonly version: string;
  /** `champion.json`의 `data` — 챔피언 요약(기본 능력치 포함). */
  readonly champions: Record<string, DdragonChampion>;
  /** `item.json`의 `data`. */
  readonly items: Record<string, DdragonItem>;
  /** `champion/{Id}.json`의 `data[Id]` — 스킬 수치. 없으면 스킬 축을 건너뛴다. */
  readonly spells: Record<string, DdragonChampionDetail>;
}

/** 기본 능력치 키 → (표시 라벨, 노트 대조 낱말). 여기 없는 키는 판정하지 않는다. */
const CHAMPION_STAT_LABELS: Record<string, readonly [string, readonly string[]]> = {
  hp: ["기본 체력", ["체력"]],
  hpperlevel: ["기본 체력 증가량", ["체력"]],
  mp: ["기본 마나", ["마나"]],
  mpperlevel: ["기본 마나 증가량", ["마나"]],
  movespeed: ["기본 이동 속도", ["이동 속도"]],
  armor: ["기본 방어력", ["방어력"]],
  armorperlevel: ["기본 방어력 증가량", ["방어력"]],
  spellblock: ["기본 마법 저항력", ["마법 저항력"]],
  spellblockperlevel: ["기본 마법 저항력 증가량", ["마법 저항력"]],
  attackrange: ["기본 사거리", ["사거리"]],
  hpregen: ["기본 체력 재생", ["체력 재생"]],
  hpregenperlevel: ["기본 체력 재생 증가량", ["체력 재생"]],
  mpregen: ["기본 마나 재생", ["마나 재생"]],
  mpregenperlevel: ["기본 마나 재생 증가량", ["마나 재생"]],
  crit: ["기본 치명타", ["치명타"]],
  critperlevel: ["기본 치명타 증가량", ["치명타"]],
  attackdamage: ["기본 공격력", ["공격력"]],
  attackdamageperlevel: ["기본 공격력 증가량", ["공격력"]],
  attackspeed: ["기본 공격 속도", ["공격 속도"]],
  attackspeedperlevel: ["기본 공격 속도 증가량", ["공격 속도"]],
};

/** 아이템 스탯 키 → (표시 라벨, 노트 대조 낱말). */
const ITEM_STAT_LABELS: Record<string, readonly [string, readonly string[]]> = {
  FlatHPPoolMod: ["체력", ["체력"]],
  FlatMPPoolMod: ["마나", ["마나"]],
  FlatPhysicalDamageMod: ["공격력", ["공격력"]],
  FlatMagicDamageMod: ["주문력", ["주문력"]],
  FlatArmorMod: ["방어력", ["방어력"]],
  FlatSpellBlockMod: ["마법 저항력", ["마법 저항력"]],
  PercentAttackSpeedMod: ["공격 속도", ["공격 속도"]],
  FlatCritChanceMod: ["치명타 확률", ["치명타"]],
  PercentLifeStealMod: ["생명력 흡수", ["생명력 흡수", "흡혈"]],
  FlatMovementSpeedMod: ["이동 속도", ["이동 속도"]],
  PercentMovementSpeedMod: ["이동 속도", ["이동 속도"]],
  FlatHPRegenMod: ["체력 재생", ["체력 재생"]],
};

const SPELL_KEYS = ["Q", "W", "E", "R"] as const;
const SPELL_FIELD_LABELS: Record<string, readonly [string, readonly string[]]> = {
  cooldownBurn: ["재사용 대기시간", ["재사용 대기시간", "쿨"]],
  costBurn: ["소모량", ["소모량"]],
  rangeBurn: ["사거리", ["사거리"]],
};

/**
 * `effectBurn` 한 칸의 값. **`"0"`은 값이 아니라 미사용 슬롯**이다 — DDragon이 쓰지 않는 칸을
 * 그렇게 채운다(실측: 노틸러스 Q = `[null, "70/115/160/205/250", "0", "0.5"]`, 인덱스 2가 그것).
 */
function slotValue(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  return raw === "0" ? null : raw;
}

/** 협곡에서 쓸 수 있는 아이템인가. `maps`가 없으면 판정 불가이므로 **제외**한다(보수적). */
export function isRiftItem(item: DdragonItem): boolean {
  return item.maps?.[SUMMONERS_RIFT] === true;
}

export function diffLol(
  before: DdragonSnapshot,
  after: DdragonSnapshot,
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
    keywords: readonly string[],
    skillKey?: string
  ) => {
    const linked = linkedNotes({ entityName, fieldKeywords: keywords, skillKey }, notes);
    out.push(
      buildChange({
        game: "lol",
        patch,
        entityKey,
        entityName,
        entityType,
        field,
        fieldPath,
        before: b,
        after: a,
        matchedNoteIds: linked.map((l) => l.note.id),
        noteMismatch: noteValueMismatch(linked, b, a),
      })
    );
  };

  for (const id of Object.keys(after.champions).sort()) {
    const prev = before.champions[id];
    const next = after.champions[id];
    if (!prev || !next) continue;

    for (const d of diffValueMap(prev.stats, next.stats)) {
      const label = CHAMPION_STAT_LABELS[d.key];
      if (!label) continue;
      push(id, next.name, "champion", label[0], `stats.${d.key}`, d.before, d.after, label[1]);
    }

    const prevSpells = before.spells[id]?.spells ?? [];
    const nextSpells = after.spells[id]?.spells ?? [];
    for (let i = 0; i < Math.min(prevSpells.length, nextSpells.length, SPELL_KEYS.length); i += 1) {
      const key = SPELL_KEYS[i];
      const p = prevSpells[i];
      const n = nextSpells[i];

      for (const field of Object.keys(SPELL_FIELD_LABELS)) {
        const pv = (p as Record<string, unknown>)[field];
        const nv = (n as Record<string, unknown>)[field];
        if (typeof pv !== "string" && typeof nv !== "string") continue;
        if (pv === nv) continue;
        const [label, keywords] = SPELL_FIELD_LABELS[field];
        push(
          id,
          next.name,
          "champion",
          `${key} ${label}`,
          `spells.${i}.${field}`,
          typeof pv === "string" ? pv : null,
          typeof nv === "string" ? nv : null,
          keywords,
          key
        );
      }

      // effectBurn은 인덱스 의미를 알 수 없다(위 헤더) — 스킬 언급만으로 공지 판정한다.
      const pe = p.effectBurn ?? [];
      const ne = n.effectBurn ?? [];
      for (let j = 0; j < Math.max(pe.length, ne.length); j += 1) {
        const pv = slotValue(pe[j]);
        const nv = slotValue(ne[j]);
        if (pv === nv) continue;
        // 한쪽이 빈 슬롯이면 값 변경이 아니라 **배열 재배치**다(스킬 개편). 실측 26.17 트런들에서
        // 슬롯 5개가 통째로 "0"이 됐고, 그것을 "0으로 너프됐다"로 읽으면 잠수함 5건이 허위로 생긴다.
        if (pv === null || nv === null) continue;
        push(id, next.name, "champion", `${key} 수치`, `spells.${i}.effect.${j}`, pv, nv, [], key);
      }
    }
  }

  for (const id of Object.keys(after.items).sort()) {
    const prev = before.items[id];
    const next = after.items[id];
    if (!prev || !next) continue;
    if (!isRiftItem(next)) continue; // 모드 스코프 게이트 — 위 헤더 참고

    const pg = prev.gold?.total ?? null;
    const ng = next.gold?.total ?? null;
    if (pg !== ng) {
      push(id, next.name, "item", "가격", "gold.total", pg, ng, ["가격", "골드"]);
    }
    for (const d of diffValueMap(prev.stats ?? {}, next.stats ?? {})) {
      const label = ITEM_STAT_LABELS[d.key];
      if (!label) continue;
      push(id, next.name, "item", label[0], `stats.${d.key}`, d.before, d.after, label[1]);
    }
  }

  return out;
}
