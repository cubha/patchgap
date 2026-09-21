// src/pipeline/gamedata/cdragon.ts
// Community Dragon TFT 원본 → **수치 스냅숏**. 순수 함수만 둔다(fetch·fs는 `scripts/run-cdragon.ts`).
//
// 원본은 버전당 **24.6MB**다(실측 2026-09-21: `raw.communitydragon.org/16.18/cdragon/tft/ko_kr.json`
// = 24,634,529B). 커밋할 수 없으므로 판정에 쓰는 필드만 남겨 348KB로 줄인다 — 미러가 사라져도
// 과거 판정은 재현된다.
//
// **추출 규칙은 지어낸 것이 아니라 역산한 것이다.** `data/cdragon/{16.17,16.18}/tft.json` 두 개가
// 파이프라인 밖에서 먼저 만들어져 커밋돼 있었고, 이 파일은 그 두 개를 그대로 재현하도록 썼다
// (키 집합·값 모두 일치 확인). 그래서 기존 산출물과 새 산출물이 같은 계약 위에 선다.
import type { CdragonItem, CdragonUnit } from "./tft";

/** 디스크에 남는 모양. `version`은 파일 경로가 이미 말하므로 담지 않는다. */
export interface CdragonSnapshotFile {
  readonly set: string;
  readonly units: Record<string, CdragonUnit>;
  readonly items: Record<string, CdragonItem>;
}

/** 원본에서 **읽는 부분만** 적는다 — 나머지 필드(아이콘·설명·역할·특성)는 읽지 않는다. */
export interface CdragonRaw {
  readonly sets?: Record<
    string,
    {
      readonly champions?: readonly {
        readonly apiName?: string;
        readonly name?: string;
        readonly cost?: number;
        readonly stats?: Record<string, unknown>;
        readonly ability?: {
          readonly variables?: readonly { readonly name?: string; readonly value?: unknown }[];
        };
      }[];
    }
  >;
  readonly items?: readonly {
    readonly apiName?: string;
    readonly name?: string;
    readonly effects?: Record<string, unknown>;
  }[];
}

/**
 * 아이템을 남길 것인가 — **숫자 effect가 하나라도 있어야** 한다.
 *
 * 실측(16.18): `effects`를 가진 2,737개 중 18개가 `{"Gold": null}`처럼 값이 전부 `null`인
 * 자리표시자다(상점 제시문·증강 설명용). 수치 축은 숫자를 diff하므로 그 18개는 영원히 할 말이
 * 없고, 담아 두면 노트 카탈로그 쪽에 **이름만 있는 유령 엔티티**를 늘린다.
 */
function hasNumericEffect(effects: Record<string, unknown> | undefined): boolean {
  if (!effects) return false;
  return Object.values(effects).some((v) => typeof v === "number");
}

/**
 * 숫자만 남긴 사본. **`null`인 자리는 키째 버린다.**
 *
 * 역산으로 확인한 규칙이다(실측 16.17·16.18): 커밋된 스냅숏의 `TFT9_SLIME_Crab`에는 `hp`가 아예
 * 없는데 원본에는 `"hp": null`이 있다. PvE 몬스터처럼 그 스탯이 정의되지 않은 유닛이 있고,
 * `null`을 남기면 diff가 "값이 사라졌다/생겼다"로 읽어 **패치마다 허위 변경**을 낸다
 * (`diffValueMap` 헤더: 한쪽에만 있는 키도 변경이다).
 */
function numericOnly(source: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    if (typeof value === "number") out[key] = value;
  }
  return out;
}

/** 숫자 effect만 통과시킨 사본. 해시 이름(`{857f7819}`)은 **거르지 않는다** — 화면에 내보낼지는
 *  `diffTft`의 `isHashName`이 정하고, 스냅숏은 원본을 보존하는 자리다. */
const numericEffects = numericOnly;

/**
 * 한 세트의 수치만 뽑는다. 세트가 없으면 **던진다** — 조용히 빈 스냅숏을 쓰면 다음 단계가
 * "변경 0건"으로 초록을 내고, 그게 이 저장소에서 가장 위험한 실패 형태다.
 *
 * 유닛 순서는 **원본 순서 그대로** 둔다. 정렬하면 기존 커밋본과 키 순서가 달라져 파일 전체가
 * diff로 뜨고, 순서 자체는 아무 의미도 갖지 않는다(소비자는 전부 키로 찾는다).
 */
export function extractTftSnapshot(raw: CdragonRaw, setNumber: number): CdragonSnapshotFile {
  const set = raw.sets?.[String(setNumber)];
  if (!set?.champions) {
    throw new Error(`CDragon 원본에 Set ${setNumber}이 없다 — 세트 번호나 버전을 확인하라`);
  }

  const units: Record<string, CdragonUnit> = {};
  for (const champion of set.champions) {
    const key = champion.apiName;
    if (!key) continue;
    const ability: Record<string, unknown> = {};
    for (const variable of champion.ability?.variables ?? []) {
      if (variable.name === undefined) continue;
      ability[variable.name] = variable.value;
    }
    units[key] = {
      name: champion.name ?? null,
      cost: champion.cost ?? null,
      stats: numericOnly(champion.stats),
      ability,
    };
  }

  const items: Record<string, CdragonItem> = {};
  for (const item of raw.items ?? []) {
    const key = item.apiName;
    if (!key || !hasNumericEffect(item.effects)) continue;
    items[key] = { name: item.name ?? null, effects: numericEffects(item.effects ?? {}) };
  }

  return { set: `TFTSet${setNumber}`, units, items };
}
