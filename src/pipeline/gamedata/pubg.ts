// src/pipeline/gamedata/pubg.ts
// PUBG 어댑터 — 게임사가 수치 파일을 배포하지 않으므로 **경기 로그에서 선언값을 읽는다**.
//
// 왜 평균이 아니라 격자인가(2026-09-21 설계 정정):
// 피격 이벤트의 `damage`는 `기본데미지 × 부위배율 × 방어구계수 × 거리감쇠`의 곱이라 몇 개 안 되는
// **이산 격자값**에 뭉친다(실측: AK47 79발 중 고유값 14개). 기본 데미지가 바뀌면 격자 전체가 같은
// 비율로 이동하고, **격자 위치는 방어구·거리 구성이 바뀌어도 움직이지 않는다**.
//
// 평균(`weaponDamageSum / weaponDamageHits`)은 그 구성에 같이 움직인다 — 실측에서 무기 34종이
// 한꺼번에 내려가는 공통 모드(중앙값 −1.51%)가 나왔고, 그건 수치 변경의 증거가 아니라 기존
// `deltas.json`이 이미 하는 "지표가 움직였다"와 같은 종류다.
//
// 추정자는 부위별 **최대치**다. 무방어·근거리 피격이 격자의 상단이고, 그것이 곧 선언값에 가장
// 가깝다. 실측 검증: 매치 45건 × 2창에서 무기 52종 중 **51종이 1.5% 이내로 고정**됐다.

import { buildChange } from "./diff";
import { linkNotes, type NoteLike } from "./note-link";
import type { GameDataChange } from "./types";

/** 한 (무기, 부위)의 격자 요약. `top`은 최빈값 상위 몇 개(교차 검증용). */
export interface GridCell {
  readonly n: number;
  readonly max: number;
  readonly top: readonly (readonly [number, number])[];
}

/** 무기 → 부위(`damageReason`) → 격자. */
export type DamageGrid = Record<string, Record<string, GridCell>>;

export interface CompareOptions {
  /** 부위별 최소 히트 수. 못 채우면 **판정하지 않는다** — `insufficient-sample`과 같은 규율. */
  readonly minHits: number;
  /** 이 이하의 이동은 격자 고정으로 본다. 실측 기준 1.5%. */
  readonly tolerance?: number;
}

export interface GridShift {
  readonly weapon: string;
  readonly reason: string;
  readonly before: number;
  readonly after: number;
  readonly relChange: number;
  readonly nBefore: number;
  readonly nAfter: number;
}

/** 매치별 격자를 합친다 — 표본은 더하고 최대치는 최대를 취한다. */
export function mergeGrids(grids: readonly DamageGrid[]): DamageGrid {
  const out: DamageGrid = {};
  for (const grid of grids) {
    for (const [weapon, reasons] of Object.entries(grid)) {
      const target = (out[weapon] ??= {});
      for (const [reason, cell] of Object.entries(reasons)) {
        const prev = target[reason];
        if (!prev) {
          target[reason] = { n: cell.n, max: cell.max, top: cell.top };
          continue;
        }
        const counts = new Map<number, number>();
        for (const [v, c] of [...prev.top, ...cell.top]) counts.set(v, (counts.get(v) ?? 0) + c);
        target[reason] = {
          n: prev.n + cell.n,
          max: Math.max(prev.max, cell.max),
          top: [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0] - b[0])
            .slice(0, TOP_VALUES_KEPT)
            .map(([v, c]) => [v, c] as const),
        };
      }
    }
  }
  return out;
}

const DEFAULT_TOLERANCE = 0.015;

/** 병합 시 유지하는 최빈값 개수 — 리듀서(`telemetry-reduce.ts`)와 같아야 한다. */
const TOP_VALUES_KEPT = 40;

/** 유의값으로 인정하는 최소 관측 수. 표본이 얇으면 1% 하한이 무의미해진다(실측: Win94 머리 n=157에서 6회짜리가 유의값이 됐다). */
const MIN_VALUE_COUNT = 20;

/**
 * **유의 격자값** — 그 부위에서 반복 관측된 피해값들(표본의 1% 이상, 최소 3회).
 *
 * 판별자를 여기까지 끌고 온 경위(2026-09-21, 실측으로 세 번 정정):
 * ① `max` 단독 → FNFal이 172/149히트 이상치로 발화. ② `max` + 최빈 상위값 → DP12가
 * `TorsoShot`만 20.45→17.56으로 발화(다른 부위는 17.64→17.64로 **정확히 동일**, 최빈 격자도
 * 그대로였다 — 20.45는 top 8에도 없는 꼬리값이었다). ③ 최빈 1위 → ACE32 팔이 23.22(1947회)와
 * 19.35(1937회)로 **0.5% 차이 동률**이라 표본이 바뀌자 순위만 뒤집혔고, 그것을 −16.7%로 읽어
 * AK47·FNFal까지 무더기 37건이 나왔다.
 *
 * 셋 다 "어느 한 값이 움직였나"를 물었기 때문에 틀렸다. 진짜 수치 변경이면 **옛 값이 사라지고
 * 새 값이 생긴다** — 기본 데미지든 부위 배율이든 방어구 감소율이든, 곱이 바뀌면 그 자리의 관측이
 * 통째로 다른 값으로 옮겨간다. 그래서 순위도 극단도 아닌 **집합의 생존**을 본다.
 */
function significantValues(cell: GridCell): number[] {
  const floor = Math.max(MIN_VALUE_COUNT, cell.n * 0.01);
  return cell.top.filter(([, count]) => count >= floor).map(([value]) => value);
}

export function compareGrids(
  before: DamageGrid,
  after: DamageGrid,
  options: CompareOptions
): GridShift[] {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const out: GridShift[] = [];
  for (const weapon of Object.keys(after).sort()) {
    const prevReasons = before[weapon];
    if (!prevReasons) continue;
    for (const reason of Object.keys(after[weapon]).sort()) {
      const a = prevReasons[reason];
      const b = after[weapon][reason];
      if (!a || !b) continue;
      if (a.n < options.minHits || b.n < options.minHits) continue;
      const prevValues = significantValues(a);
      const nextValues = significantValues(b);
      if (prevValues.length === 0 || nextValues.length === 0) continue;

      // 옛 유의 격자값이 새 표본에도 살아 있으면 격자는 안 움직였다. 부동소수 왕복이 있으므로
      // 허용 오차 안이면 같은 값으로 본다.
      const survives = (v: number): boolean =>
        v !== 0 && nextValues.some((w) => Math.abs((w - v) / v) <= tolerance);
      const gone = prevValues.filter((v) => !survives(v));
      if (gone.length === 0) continue;

      // 사라진 값 중 **가장 흔했던 것**을 대표로 싣고(top은 빈도 내림차순), 새 격자에서 가장
      // 가까운 값을 짝으로 둔다 — 그 자리의 관측이 어디로 옮겨갔는지 보여 준다.
      const from = gone[0];
      if (from === 0) continue;
      const to = nextValues.reduce((best, w) =>
        Math.abs(w - from) < Math.abs(best - from) ? w : best
      );
      out.push({
        weapon,
        reason,
        before: from,
        after: to,
        relChange: (to - from) / from,
        nBefore: a.n,
        nAfter: b.n,
      });
    }
  }
  return out;
}

/** 부위 키 → 한국어. 노트 대조 낱말이기도 하다. */
const REASON_LABELS: Record<string, string> = {
  TorsoShot: "몸통 피해량",
  HeadShot: "머리 피해량",
  ArmShot: "팔 피해량",
  LegShot: "다리 피해량",
  PelvisShot: "골반 피해량",
  NonSpecific: "피해량",
};

/** `Item_Weapon_AK47_C` → `AK47`. 노트는 이 이름을 쓴다. */
export function weaponDisplayName(weaponKey: string): string {
  return weaponKey.replace(/^Item_Weapon_/, "").replace(/^Weap/, "").replace(/_C$/, "");
}

export function gridToChanges(
  shifts: readonly GridShift[],
  notes: readonly NoteLike[],
  patch: string
): GameDataChange[] {
  return shifts.map((shift) => {
    const entityName = weaponDisplayName(shift.weapon);
    const label = REASON_LABELS[shift.reason] ?? `${shift.reason} 피해량`;
    return buildChange({
      game: "pubg",
      patch,
      entityKey: shift.weapon,
      entityName,
      entityType: "weapon",
      field: label,
      fieldPath: `damage.${shift.reason}.max`,
      before: shift.before,
      after: shift.after,
      // **"피해량"만 받는다.** 43.1 노트가 말한 LMG 변경은 반동·조준 전환·스폰율이라 피해량 격자를
      // 설명하지 않는다 — 같은 무기가 언급됐다는 이유로 공지 처리하면 그것이 알리바이가 된다.
      matchedNoteIds: linkNotes({ entityName, fieldKeywords: ["피해량", "데미지"] }, notes),
    });
  });
}

/** PUBG 노트는 `entity` 대신 `weaponKeys`를 갖는다 — 대조기가 읽는 `NoteLike`로 편다. */
export interface PubgNoteLike {
  readonly id: string;
  readonly stat?: string | null;
  readonly weaponKeys?: readonly string[];
}

export function expandPubgNotes(_notes: readonly PubgNoteLike[]): NoteLike[] {
  throw new Error("TODO(ST-5b): weaponKeys → NoteLike 전개");
}
