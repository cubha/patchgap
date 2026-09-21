// src/pipeline/gamedata/pubg.ts
// PUBG 어댑터 — 게임사가 수치 파일을 배포하지 않으므로 **경기 로그에서 선언값을 읽는다**.
//
// 피격 이벤트의 `damage`는 `기본데미지 × 부위배율 × 방어구계수 × 거리감쇠`의 곱이다. 기본 데미지나
// 부위 배율이 바뀌면 **그 부위의 피해 분포 전체가 같은 비율로 옮겨간다** — 방어구·거리 구성이
// 바뀌면 분포의 *모양*(빈도)은 달라져도 *위치*(값)는 그대로다. 판별자는 그 차이만 본다.
//
// 왜 "분포 이동"인가(2026-09-21, 규칙 5종을 실측으로 폐기한 뒤 통계를 바꿨다):
//   ① max 단독 → 이상치 1발에 발화(FNFal). ② max+최빈 → 꼬리값 유무에 발화(DP12).
//   ③ 최빈 순위 → 0.5% 차 동률이 뒤집혀 발화(ACE32, −16.7% 37건). ④ 유의값 집합 생존 → top 8
//   절단에 밀린 값을 "사라짐"으로 읽음(VSS). ⑤ 절단을 40으로 늘려도 → UMP처럼 격자값이
//   26.46/26.45/26.44…로 **연속**인 무기에서 하한 경계 효과. 다섯 개 전부 "어느 한 값이 움직였나"를
//   물었기 때문에 틀렸다. 여기서는 값을 로그 구간(0.4%)으로 접은 히스토그램 두 개를 겹쳐 보고,
//   **구간을 통째로 밀었을 때 겹침이 얼마나 늘어나는가**(이동 이득 D)로 판정한다.
//
// 실측 보정(전량 5,079매치, 부위별 120히트 이상 셀):
//   - 무변화 대조군(같은 패치를 무작위 반반으로 가른 것, 381셀): D 최대 0.021
//   - 실제 42.3→43.1(191셀): D 최대 0.027
//   - 합성 변경(×1.03·×0.97·×1.10, 191셀): D 중앙값 0.42 · 5분위 0.13 · 최소 0.02
// 임계 0.10은 무변화 최대의 4.8배다. 검출력이 낮은 것은 산탄총(Saiga12·DP12·Sawnoff)과
// 발사기(PanzerFaust) — 펠릿 합산·폭발 감쇠로 분포가 연속이라 3% 이동이 겹침을 별로 줄이지
// 않는다. **놓칠 수는 있어도 지어내지는 않는다**(무변화 대조군에서 임계를 넘은 셀 0).

import { canonicalWeaponKey } from "../aggregate/pubg-weapon-key";
import { weaponDisplayName } from "../aggregate/pubg-weapons";
import { buildChange } from "./diff";
import { linkedNotes, noteValueMismatch, type NoteLike } from "./note-link";
import type { GameDataChange } from "./types";

/** 한 (무기, 부위)의 격자 요약. `top`은 최빈값 상위 `TOP_VALUES_KEPT`개. */
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
  /** 이동 이득 임계(기본 `MIN_SHIFT_GAIN`). 테스트 외에는 바꾸지 않는다. */
  readonly minGain?: number;
}

export interface GridShift {
  readonly weapon: string;
  readonly reason: string;
  /** 대표값 — 이동 전 최빈 격자값과 그 짝. 화면이 "28.8 → 30.24"로 말한다. */
  readonly before: number;
  readonly after: number;
  readonly relChange: number;
  readonly nBefore: number;
  readonly nAfter: number;
  /** 진단 — 밀기 전 겹침, 민 뒤 겹침, 민 거리(비율). 산출물에는 싣지 않고 로그가 읽는다. */
  readonly overlapBefore: number;
  readonly overlapAfter: number;
  readonly shiftRatio: number;
}

/** 병합 시 유지하는 최빈값 개수 — 리듀서(`telemetry-reduce.ts`)와 같아야 한다. */
const TOP_VALUES_KEPT = 40;

/** 로그 구간 폭 ≈ 0.4%. 피해값은 소수 둘째 자리라 한 격자값은 항상 같은 구간에 떨어진다. */
const LOG_BIN = 0.004;

/** 탐색하는 최대 이동(구간 수) — ±120구간 ≈ ±48%. 그보다 큰 변경은 무기 재작업이고 노트가 말한다. */
const MAX_SHIFT_BINS = 120;

/** 이동으로 인정하는 최소 거리 — 3구간 ≈ 1.2%. 그 아래는 반올림·부동소수 왕복이다. */
const MIN_SHIFT_BINS = 3;

/** 이동 이득 임계. 무변화 대조군 최대(0.021)의 4.8배 — 위 실측 보정 참조. */
const MIN_SHIFT_GAIN = 0.1;

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

/** 값 → 로그 구간 인덱스. */
function binOf(value: number): number {
  return Math.round(Math.log(value) / LOG_BIN);
}

/** 격자를 로그 구간 확률 분포로 접는다(총합 1). 0 이하 값은 피해가 아니다. */
function toBins(cell: GridCell): Map<number, number> {
  const counts = new Map<number, number>();
  let total = 0;
  for (const [value, count] of cell.top) {
    if (value <= 0 || count <= 0) continue;
    const k = binOf(value);
    counts.set(k, (counts.get(k) ?? 0) + count);
    total += count;
  }
  const out = new Map<number, number>();
  for (const [k, c] of counts) out.set(k, c / total);
  return out;
}

/** 두 분포의 겹침(히스토그램 교집합) — `after`를 `shift`구간 민 상태로. 1이면 동일, 0이면 서로소. */
function overlap(
  before: ReadonlyMap<number, number>,
  after: ReadonlyMap<number, number>,
  shift: number
): number {
  let sum = 0;
  for (const [k, p] of before) sum += Math.min(p, after.get(k + shift) ?? 0);
  return sum;
}

/**
 * 격자 이동 검정.
 *
 * 1. 두 격자를 로그 구간 분포로 접는다.
 * 2. 밀지 않은 겹침 `o0`와, ±`MAX_SHIFT_BINS` 안에서 겹침이 최대가 되는 이동 `s*`·겹침 `o*`를 찾는다.
 * 3. `|s*| ≥ MIN_SHIFT_BINS`이고 `o* − o0 ≥ minGain`이면 이동이다.
 *
 * 값 하나가 아니라 분포 전체를 쓰므로 이상치·꼬리값·동률 순위·절단에 흔들리지 않는다. 빈도만
 * 달라진 표본은 `s=0`이 최선이라 이득이 0이다.
 */
export function compareGrids(
  before: DamageGrid,
  after: DamageGrid,
  options: CompareOptions
): GridShift[] {
  const minGain = options.minGain ?? MIN_SHIFT_GAIN;
  const out: GridShift[] = [];
  for (const weapon of Object.keys(after).sort()) {
    const prevReasons = before[weapon];
    if (!prevReasons) continue;
    for (const reason of Object.keys(after[weapon]).sort()) {
      const a = prevReasons[reason];
      const b = after[weapon][reason];
      if (!a || !b) continue;
      if (a.n < options.minHits || b.n < options.minHits) continue;

      const pb = toBins(a);
      const pa = toBins(b);
      if (pb.size === 0 || pa.size === 0) continue;

      const o0 = overlap(pb, pa, 0);
      let bestShift = 0;
      let bestOverlap = o0;
      for (let s = -MAX_SHIFT_BINS; s <= MAX_SHIFT_BINS; s += 1) {
        if (s === 0) continue;
        const o = overlap(pb, pa, s);
        if (o > bestOverlap) {
          bestOverlap = o;
          bestShift = s;
        }
      }
      if (Math.abs(bestShift) < MIN_SHIFT_BINS || bestOverlap - o0 < minGain) continue;

      // 대표값: 이동 전 최빈 격자값 → 민 자리(±1구간)에서 가장 흔한 이동 후 값. 화면은 이 두 수를
      // 보여 주고, 비율은 그 둘에서 계산한다(구간 폭 0.4%의 양자화를 대표값에 싣지 않기 위해).
      const from = a.top[0][0];
      const targetBin = binOf(from) + bestShift;
      const candidate = b.top.find(([v]) => v > 0 && Math.abs(binOf(v) - targetBin) <= 1);
      const to = candidate ? candidate[0] : from * Math.exp(bestShift * LOG_BIN);
      out.push({
        weapon,
        reason,
        before: from,
        after: to,
        relChange: (to - from) / from,
        nBefore: a.n,
        nAfter: b.n,
        overlapBefore: o0,
        overlapAfter: bestOverlap,
        shiftRatio: Math.exp(bestShift * LOG_BIN),
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

/**
 * 격자 키(`WeapAK47_C`)와 노트 키(`Item_Weapon_AK47_C`)를 **판정표와 같은 정준키·표기명**으로 접는다.
 * 판정 행(`PubgDeltaRow.weaponKey`)과 잠수함 변경(`GameDataChange.entityKey`)이 같은 키를 써야
 * 화면이 두 축을 한 행에서 합칠 수 있다(LoL의 `MonkeyKing`·아이템 `6610`과 같은 규약). 표기명도
 * 같은 함수라 FNFal이 여기서만 "FNFal"로 불리지 않는다(사이트는 "SLR").
 */
function pubgEntity(key: string): { entityKey: string; entityName: string } {
  const entityKey = canonicalWeaponKey(key);
  return { entityKey, entityName: weaponDisplayName(entityKey) };
}

/** PUBG 노트는 `entity` 대신 `weaponKeys`를 갖는다 — 대조기가 읽는 `NoteLike`로 편다. */
export interface PubgNoteLike {
  readonly id: string;
  readonly stat?: string | null;
  readonly weaponKeys?: readonly string[];
}

/**
 * 노트 1건 × 무기 N개 → `NoteLike` N개. 엔티티 이름은 격자 쪽과 같은 표시명 규칙을 쓴다
 * (`Item_Weapon_RPD_C`와 `WeapRPD_C`가 둘 다 `RPD`가 된다). 무기가 없는 노트는 대조 대상이 아니다.
 *
 * 이 전개가 없으면 `entity: null`인 PUBG 노트는 어떤 무기와도 짝이 안 맞아 **모든 변경이 잠수함**이
 * 된다 — 공지된 변경을 미공지로 부르는 쪽의 오탐이다(2026-09-21 실측: 43.1 노트 5건 전부 entity null).
 */
export function expandPubgNotes(notes: readonly PubgNoteLike[]): NoteLike[] {
  return notes.flatMap((note) =>
    (note.weaponKeys ?? []).map((key) => ({
      id: note.id,
      entity: pubgEntity(key).entityName,
      skill: null,
      stat: note.stat ?? null,
    }))
  );
}

export function gridToChanges(
  shifts: readonly GridShift[],
  notes: readonly NoteLike[],
  patch: string
): GameDataChange[] {
  return shifts.map((shift) => {
    const { entityKey, entityName } = pubgEntity(shift.weapon);
    const label = REASON_LABELS[shift.reason] ?? `${shift.reason} 피해량`;
    const linked = linkedNotes({ entityName, fieldKeywords: ["피해량", "데미지"] }, notes);
    return buildChange({
      game: "pubg",
      patch,
      entityKey,
      entityName,
      entityType: "weapon",
      field: label,
      fieldPath: `damage.${shift.reason}`,
      before: shift.before,
      after: shift.after,
      // **"피해량"만 받는다.** 43.1 노트가 말한 LMG 변경은 반동·조준 전환·스폰율·차량 피해 배수라
      // 플레이어 피해 격자를 설명하지 않는다 — 같은 무기가 언급됐다는 이유로 공지 처리하면 그것이
      // 알리바이가 된다. "차량 피해 배수"는 "피해량"을 포함하지 않으므로 걸리지 않는다.
      matchedNoteIds: linked.map((l) => l.note.id),
      noteMismatch: noteValueMismatch(linked, shift.before, shift.after),
    });
  });
}
