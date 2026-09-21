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
            .slice(0, 8)
            .map(([v, c]) => [v, c] as const),
        };
      }
    }
  }
  return out;
}

const DEFAULT_TOLERANCE = 0.015;

/** 최빈값 중 가장 높은 값. 격자 상단의 **안정적인** 대리값이다(절대 최대치와 달리 이상치에 둔감). */
function topMax(cell: GridCell): number | null {
  if (cell.top.length === 0) return null;
  let max = 0;
  for (const [value] of cell.top) if (value > max) max = value;
  return max === 0 ? null : max;
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
      if (a.max === 0) continue;
      const relChange = (b.max - a.max) / a.max;
      if (Math.abs(relChange) <= tolerance) continue;

      // **두 추정자가 함께 움직여야 한다.** `max`는 표본이 커질수록 커지는 편향 추정자라
      // 이상치 하나로 발화한다(실측: FNFal 51.93 → 56.59이 172/149히트에서 나왔다).
      // `top`의 최댓값은 **최빈값 중 가장 높은 것**이라 극단값에 훨씬 둔감하다 — 둘이 같은
      // 방향으로 함께 이동할 때만 격자가 실제로 옮겨간 것으로 본다.
      const modeA = topMax(a);
      const modeB = topMax(b);
      if (modeA === null || modeB === null || modeA === 0) continue;
      const modeChange = (modeB - modeA) / modeA;
      if (Math.abs(modeChange) <= tolerance) continue;
      if (Math.sign(modeChange) !== Math.sign(relChange)) continue;
      out.push({
        weapon,
        reason,
        before: a.max,
        after: b.max,
        relChange,
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
