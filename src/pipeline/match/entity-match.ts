// src/pipeline/match/entity-match.ts
// F4 1단(결정론): 패치노트 항목 ↔ 델타를 엔티티 ID 블로킹 + 방향 정합 스코어로 짝짓는다.
//
// 블로킹 키: PatchNoteItem.entity(한글) → ddragon 챔피언/아이템(byKoName) → 그 ddragon
// id(챔피언)/itemId(아이템) → DeltaRecord.entityKey와 대조. 같은 엔티티에 노트 항목이 여럿이면
// (예: 챔피언 스킬 3줄 변경) 엔티티 단위로 하나의 노트 묶음으로 본다 — DeltaRecord.entityKey가
// 챔피언 전체 지표(pickRate/banRate/winRate/포지션별)에서 공유되므로 자연히 같은 묶음에 걸린다.
//
// 방향 정합: 노트 방향(buff/nerf 다수결, adjust/unknown은 무시하고 tally, 전부 무시되거나 동률이면
// "neutral") vs 관측 델타 부호(픽률·밴률·승률·채택률 상승 = "up", 그 외 "down"/"flat")를 비교한다.
// lane/objective/summary 엔티티는 패치노트에 대응 엔티티명이 없어 매칭 대상에서 제외한다.

import type { DeltaRecord, PatchNoteItem } from "../types";
import { isCoreNote } from "../shared/mode-scope";
import type { DdragonData } from "./ddragon";

export type NoteDirectionMajority = "buff" | "nerf" | "neutral";
export type DirectionAgreement = "consistent" | "inconsistent" | "neutral";

export interface EntityMatchInfo {
  /** 이 엔티티에 걸린 패치노트 항목 id 전부(문서 순서). */
  noteIds: string[];
  directionAgreement: DirectionAgreement;
}

export interface EntityMatchOutcome {
  /** DeltaRecord.id → 매칭 정보. 매칭 안 된 델타는 키 자체가 없다. */
  matches: Map<string, EntityMatchInfo>;
  /**
   * ddragon 챔피언/아이템 어디에도 매핑되지 않은 패치노트 엔티티명(한글, 중복 제거·정렬) —
   * ST-08 배치 지시 "매핑 실패 목록을 반환(보고에 포함)"에 대응. champion/item 섹션 노트만
   * 대상(system/other 섹션은 애초에 엔티티 매핑 대상이 아니라 집계하지 않는다).
   */
  mappingFailures: string[];
}

function noteMajorityDirection(notes: readonly PatchNoteItem[]): NoteDirectionMajority {
  let buff = 0;
  let nerf = 0;
  for (const note of notes) {
    if (note.direction === "buff") buff += 1;
    else if (note.direction === "nerf") nerf += 1;
    // adjust/unknown은 방향 다수결에서 기권(집계에서 제외) — PLAN "adjust는 중립" 지시.
  }
  if (buff === nerf) return "neutral";
  return buff > nerf ? "buff" : "nerf";
}

type ObservedDirection = "up" | "down" | "flat";

function observedDirection(delta: DeltaRecord): ObservedDirection {
  if (delta.delta === null || delta.delta === 0) return "flat";
  return delta.delta > 0 ? "up" : "down";
}

/**
 * 노트 다수결 방향과 관측 델타 부호를 비교한다. "픽률·밴률·승률·채택률 상승 = +"(PLAN ③ ST-08
 * 행) 원칙을 모든 챔피언/아이템 비율 지표에 균일 적용한다 — 밴률은 PLAN이 명시하지 않았지만
 * (구현 결정) 같은 "상승=긍정 반응" 방향으로 일관 처리한다(밴률 전용 반전 규칙 없음).
 */
function directionAgreement(
  noteDirection: NoteDirectionMajority,
  observed: ObservedDirection
): DirectionAgreement {
  if (noteDirection === "neutral" || observed === "flat") return "neutral";
  if (noteDirection === "buff" && observed === "up") return "consistent";
  if (noteDirection === "nerf" && observed === "down") return "consistent";
  return "inconsistent";
}

/** entityType(champion|item) + ddragon key로 노트를 묶기 위한 내부 키. */
function bucketKey(entityType: "champion" | "item", key: string): string {
  return `${entityType}:${key}`;
}

/**
 * 패치노트 항목과 델타를 1단(결정론)으로 짝짓는다. 순수 함수 — 네트워크·파일 I/O 없음(ddragon은
 * 이미 로드된 객체를 주입받는다).
 */
export function matchDeterministic(
  notes: readonly PatchNoteItem[],
  deltas: readonly DeltaRecord[],
  ddragon: DdragonData
): EntityMatchOutcome {
  const notesByEntityBucket = new Map<string, PatchNoteItem[]>();
  const mappingFailures = new Set<string>();

  for (const note of notes) {
    // 2026-09-19: 짝짓기 자격 게이트. 다른 게임 모드(LoL 클래식·아수라장·아레나)의 노트는 우리가
    // 집계하는 소환사의 협곡 데이터와 인과가 없다 — 26.18 클래식 피오라 65줄이 section="champion"
    // 으로 재분류돼 SR 피오라 델타와 짝지어진 것이 이 게이트가 없어서 생긴 결함이었다.
    // mappingFailures에도 넣지 않는다(SR 대상이 아니므로 "매핑 실패"가 아니다).
    if (!isCoreNote(note)) continue;
    if (note.section === "champion") {
      const champion = ddragon.champions.byKoName(note.entity);
      if (!champion) {
        mappingFailures.add(note.entity);
        continue;
      }
      const key = bucketKey("champion", champion.id);
      const bucket = notesByEntityBucket.get(key) ?? [];
      bucket.push(note);
      notesByEntityBucket.set(key, bucket);
    } else if (note.section === "item") {
      const candidates = ddragon.items.byKoName(note.entity);
      if (candidates.length === 0) {
        mappingFailures.add(note.entity);
        continue;
      }
      // 아이템 한글명은 게임 모드 간 충돌할 수 있어(예: 아레나 전용 변형) 후보 전부에 노트를
      // 걸어둔다 — 실제로 존재하는 델타(entityKey)만 아래에서 매칭되므로 무해하다.
      for (const candidate of candidates) {
        const key = bucketKey("item", String(candidate.id));
        const bucket = notesByEntityBucket.get(key) ?? [];
        bucket.push(note);
        notesByEntityBucket.set(key, bucket);
      }
    }
    // section === "system" | "other"는 챔피언/아이템 엔티티가 아니라 블로킹 대상이 아니다.
  }

  const matches = new Map<string, EntityMatchInfo>();
  for (const delta of deltas) {
    if (delta.entityType !== "champion" && delta.entityType !== "item") continue;
    const bucket = notesByEntityBucket.get(bucketKey(delta.entityType, delta.entityKey));
    if (!bucket || bucket.length === 0) continue;

    const noteDirection = noteMajorityDirection(bucket);
    const observed = observedDirection(delta);
    matches.set(delta.id, {
      noteIds: bucket.map((note) => note.id),
      directionAgreement: directionAgreement(noteDirection, observed),
    });
  }

  return { matches, mappingFailures: Array.from(mappingFailures).sort() };
}
