// src/pipeline/aggregate/pubg-accuracy.ts
// PUBG 명중률 재현 — PLAN-pubg-gate-2026-09-16.md §8 반증표를 커밋 코드로 되살린다.
// 순수 함수만(파일 I/O 금지).
//
// **⚠️ 이 모듈은 출하 축이 아니다.** §8이 이미 실측으로 반증했다 — 반동 너프를 받은
// LMG 3종(RPD -1.8%·M249 -1.4%·MG3 +4.6%)이 대조군(AK47 -7.1%·HK416 -11.9%, 반동
// 변경 없음)보다 **덜** 움직였다. 방향이 반대다. 교란원은 봇 비율 변화(31.6%→27.5%,
// 봇 상대 명중률이 사람 상대보다 높다)로 추정된다. 정규화(`pubg-weapon-key.ts`)는
// 이 교란을 전혀 제거하지 못한다 — 정규화의 산출물은 이 반증표의 코드 재현성과
// N-1~N-3 결함 수정이지, 명중률 축의 부활이 아니다(PLAN-pubg-normalization-
// 2026-09-17.md §2-1). 반동·ADS 축을 되살리려면 `LogPlayerAttack`의 연사 간격·
// 탄착군 같은 새 신호 설계가 필요하고, 그건 이 루프의 범위 밖이다.
// `pubg-delta.ts`의 판정(`MatchStatus`)에는 절대 연결하지 않는다 — 방법론 페이지에
// "시도했고 버린 축"으로만, 이 파일이 만드는 수치와 함께 노출한다.
//
// **ST-3(텔레메트리 리듀서의 `Weap*` 필터 누락)를 여기서 흡수한다**: provenance
// 파이썬(`telemetry.py`)은 실제로 돌아간 코드의 기록이라 고치지 않는다(재현 불가가
// 된다). 대신 이미 리듀스된 `weaponAttacks`·`weaponDamageHits`를 소비하는 이 계층에서
// `weaponKind`가 `firearm`이 아닌 키를 걸러 — 투척물·장비·근접이 명중률 계산에
// 섞이지 않는다.
import type { Interval } from "../types";
import { canonicalWeaponKey, weaponKind } from "./pubg-weapon-key";
import { weaponDisplayName, wilson } from "./pubg-weapons";

/** `PubgReducedMatch`의 부분집합 — 명중률 계산에 필요한 두 필드만 받는다. */
export interface PubgAccuracyInput {
  weaponAttacks: Record<string, number>;
  weaponDamageHits: Record<string, number>;
}

export interface PubgAccuracyStat {
  weaponKey: string;
  weaponName: string;
  attacks: number;
  hits: number;
  /** hits ÷ attacks. attacks가 0이면 0(나눗셈 폭발 방지, "관측 없음"과 동치). */
  accuracy: number;
  accuracyCi: Interval;
}

/** 비무기(투척물·장비·근접) 키를 걸러 정준키로 합산한다 — 스킨 변종도 베이스로 접힌다. */
function accumulateFirearms(
  matches: readonly PubgAccuracyInput[],
  field: "weaponAttacks" | "weaponDamageHits"
): Map<string, number> {
  const acc = new Map<string, number>();
  for (const m of matches) {
    for (const [key, count] of Object.entries(m[field])) {
      if (weaponKind(key) !== "firearm") continue;
      const canonical = canonicalWeaponKey(key);
      acc.set(canonical, (acc.get(canonical) ?? 0) + count);
    }
  }
  return acc;
}

export function accuracyByWeapon(matches: readonly PubgAccuracyInput[]): PubgAccuracyStat[] {
  const attacks = accumulateFirearms(matches, "weaponAttacks");
  const hits = accumulateFirearms(matches, "weaponDamageHits");

  const keys = new Set([...attacks.keys(), ...hits.keys()]);
  const rows: PubgAccuracyStat[] = [...keys].map((weaponKey) => {
    const a = attacks.get(weaponKey) ?? 0;
    const h = hits.get(weaponKey) ?? 0;
    return {
      weaponKey,
      weaponName: weaponDisplayName(weaponKey),
      attacks: a,
      hits: h,
      accuracy: a > 0 ? h / a : 0,
      accuracyCi: a > 0 ? wilson(h, a) : ([0, 0] as Interval),
    };
  });

  rows.sort((x, y) => y.attacks - x.attacks);
  return rows;
}
