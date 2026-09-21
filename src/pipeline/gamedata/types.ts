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

/** 노트 짝이 없으면 잠수함 패치다. 이 술어가 정의의 **단일 소스**. */
export function isSubmarineChange(change: GameDataChange): boolean {
  return change.matchedNoteIds.length === 0;
}
