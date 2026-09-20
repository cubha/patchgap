// src/pipeline/aggregate/tft-boards.ts
// TFT 집계 — **순수 함수만**(디렉토리 규칙: aggregate/*는 파일 I/O 금지).
// 입력 `TftMatchSlim[]` → 출력 `TftEntityStat[]`.
//
// **분모가 무엇인가**가 이 파일의 전부다. TFT는 한 판에 참가자 8명이고 각자 보드를 들고 있으므로
// "등장률"의 분모는 매치가 아니라 **참가자**다(= 보드 수). LoL의 픽률이 "경기당 10슬롯 중 하나"인
// 것과 달리 TFT 유닛은 한 보드에 여러 개가 동시에 설 수 있어 제로섬이 아니다 — 그래서 픽률과
// 같은 절대 바닥을 쓰지 않고 상대 바닥을 쓴다(`EFFECT_SIZE_FLOORS.playRate` 주석 참고).
//
// **같은 보드에 같은 유닛이 둘 이상** 있을 수 있다(2성/3성은 한 칸이지만, 서로 다른 칸에 같은
// 유닛을 놓기도 한다). 등장률은 "그 유닛을 **쓴 보드 수**"라 보드 단위로 중복을 없앤다 —
// 없애지 않으면 등장률이 1을 넘는다.
import { wilsonInterval } from "./stats";
import type { Interval, TftMatchSlim } from "../types";

/** 등장률 최소 표본 — 이 미만이면 하류가 `insufficient-sample`로 떨어뜨린다. */
export const TFT_MIN_BOARDS = 200;

export type TftEntityKind = "unit" | "trait" | "item";

export interface TftEntityStat {
  kind: TftEntityKind;
  /** 원천 키(예: "DA_18_Rakan"). 표시명은 카탈로그 조인이 붙인다. */
  key: string;
  /** 이 엔티티가 등장한 보드 수. */
  boards: number;
  /** 전체 보드 수 대비 비율. */
  playRate: number;
  /** 등장한 보드 중 4등 이내 비율. 표본이 모자라면 `ci`가 null이다. */
  top4Rate: number;
  top4Ci: Interval | null;
  /** 등장한 보드의 평균 등수(1~8, **작을수록 좋다**). */
  avgPlacement: number;
  /**
   * 등수의 표본표준편차(n-1). 보드가 1개면 `null` — 0으로 두면 하류의 평균차 p값이
   * 분모 0으로 **무한 확신**을 갖게 된다.
   */
  placementSd: number | null;
}

export interface TftAggregate {
  patch: string;
  matches: number;
  /** 분모 — 참가자(보드) 수. */
  boards: number;
  units: TftEntityStat[];
  traits: TftEntityStat[];
  items: TftEntityStat[];
  /** 매치 평균 지표 — 패치 단위 요약(LoL `PatchSummary`와 같은 자리). */
  summary: {
    avgGameLengthSec: number;
    avgLastRound: number;
  };
}

interface Acc {
  boards: number;
  top4: number;
  placementSum: number;
  /** 제곱합 — 한 번 훑어 분산을 내기 위한 누적값. */
  placementSqSum: number;
}

function bump(map: Map<string, Acc>, key: string, placement: number): void {
  const cur = map.get(key) ?? { boards: 0, top4: 0, placementSum: 0, placementSqSum: 0 };
  cur.boards += 1;
  if (placement <= 4) cur.top4 += 1;
  cur.placementSum += placement;
  cur.placementSqSum += placement * placement;
  map.set(key, cur);
}

/** 표본표준편차(n-1). 보드가 2개 미만이면 정의되지 않으므로 null. */
function sampleSd(acc: Acc): number | null {
  if (acc.boards < 2) return null;
  const mean = acc.placementSum / acc.boards;
  const variance = (acc.placementSqSum - acc.boards * mean * mean) / (acc.boards - 1);
  return Math.sqrt(Math.max(0, variance));
}

function finish(map: Map<string, Acc>, kind: TftEntityKind, totalBoards: number): TftEntityStat[] {
  const out: TftEntityStat[] = [];
  for (const [key, acc] of map) {
    out.push({
      kind,
      key,
      boards: acc.boards,
      playRate: totalBoards === 0 ? 0 : acc.boards / totalBoards,
      top4Rate: acc.boards === 0 ? 0 : acc.top4 / acc.boards,
      // 표본이 모자라면 구간을 **주지 않는다** — 좁은 구간을 지어내면 하류가 유의하다고 읽는다.
      top4Ci: acc.boards >= TFT_MIN_BOARDS ? wilsonInterval(acc.top4, acc.boards) : null,
      avgPlacement: acc.boards === 0 ? 0 : acc.placementSum / acc.boards,
      placementSd: sampleSd(acc),
    });
  }
  // 등장률 내림차순 — 표시 정렬은 하류(판정 우선순위)가 다시 하지만, 산출물 자체가
  // 사람이 읽을 수 있어야 한다.
  out.sort((a, z) => z.boards - a.boards || a.key.localeCompare(z.key));
  return out;
}

export function aggregateTftBoards(matches: readonly TftMatchSlim[], patch: string): TftAggregate {
  const units = new Map<string, Acc>();
  const traits = new Map<string, Acc>();
  const items = new Map<string, Acc>();

  let boards = 0;
  let lengthSum = 0;
  let lastRoundSum = 0;

  for (const match of matches) {
    lengthSum += match.gameLengthSec;
    for (const p of match.participants) {
      boards += 1;
      lastRoundSum += p.lastRound;
      // 보드 단위 중복 제거 — 같은 유닛을 두 칸에 놓아도 "쓴 보드"는 하나다.
      for (const key of new Set(p.unitIds)) bump(units, key, p.placement);
      for (const key of new Set(p.itemIds)) bump(items, key, p.placement);
      for (const key of new Set(p.traits.map((t) => t.name))) bump(traits, key, p.placement);
    }
  }

  return {
    patch,
    matches: matches.length,
    boards,
    units: finish(units, "unit", boards),
    traits: finish(traits, "trait", boards),
    items: finish(items, "item", boards),
    summary: {
      avgGameLengthSec: matches.length === 0 ? 0 : lengthSum / matches.length,
      avgLastRound: boards === 0 ? 0 : lastRoundSum / boards,
    },
  };
}
