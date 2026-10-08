// src/pipeline/gamedata/types.ts
// 잠수함 패치(패치노트에 없는 원본 수치 변경) 검출의 도메인 타입.
//
// **이것은 판정 상태가 아니다.** `MatchStatus`(types.ts)는 "지표가 어떻게 움직였나"를 말하고,
// 여기는 "게임사가 무엇을 바꿨나"를 말한다. 두 축은 직교한다 — 수치가 바뀌었는데 지표는
// 안 움직일 수 있고(바꿨는데 효과가 없었다), 지표가 움직였는데 수치는 그대로일 수 있다
// (메타 변화). 그래서 `MatchStatus`에 값을 더하지 않고 별도 산출물로 낸다
// (docs/plan/PLAN-submarine-patch-2026-09-21.md §3·§4).
//
// 증거 등급은 세 게임 모두 A(대조)다. LoL·TFT는 게임사가 배포한 데이터 파일을 직접 diff하고,
// PUBG는 파일이 없는 대신 경기 로그의 피해 격자를 읽는다 — 격자값은 `기본데미지 × 부위배율 ×
// 방어구계수 × 거리감쇠`의 곱이라 이산값이고, **격자 위치는 방어구·거리 구성이 바뀌어도
// 움직이지 않는다**(평균은 움직인다 — 그래서 평균을 쓰지 않는다).

import type { NoteValueMismatch, PriorNoteLink } from "./note-link";

/** 어디서 읽었는지. 화면이 근거 링크를 만들 때 쓴다. */
export interface GameDataSource {
  /** `"ddragon"` | `"cdragon"` | `"telemetry-grid"` */
  readonly kind: string;
  /** 전 패치 쪽 버전 라벨(예: `"16.17.1"`). */
  readonly from: string;
  /** 후 패치 쪽 버전 라벨(예: `"16.18.1"`). */
  readonly to: string;
}

/** 값 하나의 변경. `before`/`after`는 숫자이거나 배열 문자열(`"75/115/155"`)이다. */
export interface GameDataChange {
  /** `gdc:{game}:{to}:{entityKey}:{field}` — 결정론적이라 재생성해도 같다. */
  readonly id: string;
  /** 게임 내부 키(championId·apiName·weaponKey). 화면 링크의 재료. */
  readonly entityKey: string;
  /** 한국어 표시명. 노트 대조의 재료이기도 하다. */
  readonly entityName: string;
  /** `"champion"` | `"item"` | `"unit"` | `"weapon"` */
  readonly entityType: string;
  /** 사람이 읽는 필드명(`"기본 공격력"`·`"Q 재사용 대기시간"`·`"가격"`). */
  readonly field: string;
  /** 기계가 읽는 원본 경로(`"stats.attackdamage"`·`"spells.0.cooldownBurn"`). */
  readonly fieldPath: string;
  readonly before: number | string | null;
  readonly after: number | string | null;
  /** 숫자끼리일 때만 상대 변화. 배열 문자열이면 `null`. */
  readonly relChange: number | null;
  /** 이 변경을 말한 패치노트 항목. 비어 있으면 **잠수함 패치**. */
  readonly matchedNoteIds: readonly string[];
  /**
   * 노트가 같은 항목을 말했는데 **값이 다를 때만** 채워진다(`noteValueMismatch`).
   *
   * 잠수함(말하지 않음)과도, 공지(말했고 맞음)와도 다른 **세 번째 자리**다. 없는 경우 키 자체를
   * 두지 않는다 — 산출물 대부분이 `null`로 채워지면 커밋 diff가 읽히지 않는다.
   */
  readonly noteMismatch?: NoteValueMismatch;
  /**
   * 현재 쌍 노트엔 없지만 **직전 패치 노트가 이 값으로 바꾼다고 먼저 말한** 변경(ST-02, 2026-10-08). 게임 파일에
   * 한두 패치 늦게 실린 공지다 — 잠수함이 아니다(렝가·덩굴정령 18.3, 마오카이·마스터 이 18.4 실측). 없으면 키 자체를
   * 두지 않는다(`noteMismatch`와 같은 이유).
   */
  readonly priorNote?: PriorNoteLink;
}

export interface GameDataDiffFile {
  readonly meta: {
    readonly game: string;
    readonly from: string;
    readonly to: string;
    readonly source: GameDataSource;
    readonly generatedAt: string;
    /** 검출된 변경 총수 — 화면이 "N건 중 M건이 미공지"를 말할 때 쓴다. */
    readonly changeCount: number;
    /** 그중 노트 짝이 없는 것. */
    readonly submarineCount: number;
  };
  readonly changes: readonly GameDataChange[];
}

/**
 * 노트 짝이 없으면 잠수함 패치다. 이 술어가 정의의 **단일 소스**.
 * 직전 노트가 먼저 말한 값(`priorNote`)은 짝이 **있는** 것이다 — 지연 반영이지 잠수함이 아니다(ST-02).
 */
export function isSubmarineChange(change: GameDataChange): boolean {
  return change.matchedNoteIds.length === 0 && change.priorNote === undefined;
}

/** 직전 패치 노트가 공지한 값이 이번에 반영된 변경 — 잠수함·공지·불일치와 배타적인 네 번째 자리. */
export function isDelayedChange(change: GameDataChange): boolean {
  return change.priorNote !== undefined;
}

/**
 * 공지는 됐는데 **적힌 값이 실제와 다른** 변경. 잠수함과 **배타적**이다 — 불일치는 짝이 있어야
 * 성립하고, 잠수함은 짝이 없어야 성립한다.
 */
export function isNoteMismatchChange(change: GameDataChange): boolean {
  return change.noteMismatch !== undefined;
}
