// src/pipeline/collect/patch-calendar.ts
// 패치별 KST 라이브 일자 캘린더 — 크롤러가 매치ID 조회 시간창(startTime/endTime)을 좁히는
// 데 쓰는 휴리스틱이다. 시간창은 후보 축소용일 뿐이며 최종 컷은 항상
// canonicalPatch(match.info.gameVersion) === patch로 한다(실제 배포는 수요일 새벽~오전이라
// 라이브 일자를 KST 00:00으로 가정해도 그 날짜 이전 매치를 취급하지 않는 한 안전하다).

import type { PatchId } from "../types";

export interface PatchCalendarEntry {
  /** 패치 라이브 일자(KST), "YYYY-MM-DD" 형식. */
  liveKst: string;
}

/**
 * 손으로 적은 **기저** 캘린더. 2026-09-21부터 새 패치는 감시자(`patch-watch.yml`)가
 * `data/patch-calendar/lol.json`에 적고, 소비자는 둘을 합친 `loadLolCalendar()`를 본다 —
 * 즉 **이 상수는 더 이상 전체 목록이 아니다**. 여기 직접 적으면 오버레이보다 우선한다.
 */
export const PATCH_CALENDAR: Record<PatchId, PatchCalendarEntry> = {
  "26.16": { liveKst: "2026-08-13" },
  "26.17": { liveKst: "2026-08-27" },
  "26.18": { liveKst: "2026-09-10" },
  "26.19": { liveKst: "2026-09-24" },
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 00:00 "YYYY-MM-DD" → epoch seconds(UTC). */
function kstMidnightToEpochSec(dateKst: string): number {
  const utcMs = Date.parse(`${dateKst}T00:00:00Z`) - KST_OFFSET_MS;
  return Math.floor(utcMs / 1000);
}

/** 캘린더 키를 정렬해 patch 바로 다음 패치 ID를 찾는다. 마지막 패치면 null. */
function nextPatchOf(patch: PatchId, calendar: Record<PatchId, PatchCalendarEntry>): PatchId | null {
  const keys = Object.keys(calendar).sort();
  const idx = keys.indexOf(patch);
  if (idx === -1 || idx === keys.length - 1) return null;
  return keys[idx + 1];
}

export interface PatchWindow {
  startTime: number;
  endTime: number;
}

/**
 * patch의 매치ID 조회 후보 시간창을 계산한다: startTime=해당 패치 라이브(KST 00:00),
 * endTime=다음 패치 라이브(캘린더에 다음 패치가 없으면 nowMs()). PATCH_CALENDAR에 없는
 * patch를 넘기면 throw한다(무근거 시간창을 임의로 만들지 않는다).
 */
export function patchWindow(
  patch: PatchId,
  nowMs: () => number = Date.now,
  /** 기본은 기저 상수. 감시자가 채우는 오버레이까지 보려면 호출부가 병합본을 넘긴다
   * (`scripts/shared/calendar.ts`의 `loadLolCalendar`). */
  calendar: Record<PatchId, PatchCalendarEntry> = PATCH_CALENDAR
): PatchWindow {
  const entry = calendar[patch];
  if (!entry) {
    throw new Error(`patch-calendar: unknown patch "${patch}" — PATCH_CALENDAR에 등록 필요`);
  }
  const startTime = kstMidnightToEpochSec(entry.liveKst);
  const next = nextPatchOf(patch, calendar);
  const endTime = next ? kstMidnightToEpochSec(calendar[next].liveKst) : Math.floor(nowMs() / 1000);
  return { startTime, endTime };
}

/**
 * 마지막 패치가 이만큼 지나도록 다음 패치가 캘린더에 없으면 **낡았다고 본다**.
 *
 * LoL 주기는 실측 **정확히 14일**(8/13 · 8/27 · 9/10 · 9/24)이다. 그 1.5배를 쓴다 —
 * TFT(15일 주기 → 22일)와 같은 비율이다. 매일 울면 아무도 안 보므로 정상 구간은 조용해야 한다.
 */
export const LOL_STALE_AFTER_DAYS = 21;

export interface LolRunInput {
  /** 오늘(KST) `YYYY-MM-DD`. */
  todayKst: string;
  calendar: Record<PatchId, PatchCalendarEntry>;
  /** `data/aggregated/{patch}/summary.json`이 이미 있나. */
  hasOutputs: boolean;
  manualPatch?: string;
  manualFrom?: string;
  manualTo?: string;
  force?: boolean;
}

export interface LolRunDecision {
  shouldRun: boolean;
  patch: string | null;
  from: string | null;
  to: string | null;
  staleCalendar: boolean;
  reason: string;
}

/** `26.9` < `26.18` — 문자열 정렬로는 뒤집힌다. */
function comparePatchId(a: string, b: string): number {
  const [aMajor, aMinor] = a.split(".").map(Number);
  const [bMajor, bMinor] = b.split(".").map(Number);
  return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor;
}

function daysBetweenKst(fromKst: string, toKst: string): number {
  return (Date.parse(`${toKst}T00:00:00Z`) - Date.parse(`${fromKst}T00:00:00Z`)) / 86_400_000;
}

/**
 * 오늘 수집을 돌려야 하나 — `collect.yml`의 heredoc이 하던 판정을 **검증 받는 자리로** 옮긴 것이다.
 * 순수 함수라 단위 테스트가 고정한다(TFT `determineTftRun`·PUBG `determinePubgRun`과 같은 자리).
 */
export function determineLolRun(input: LolRunInput): LolRunDecision {
  const sorted = Object.keys(input.calendar).sort(comparePatchId);
  const last = sorted[sorted.length - 1] ?? null;
  const staleCalendar =
    last !== null && daysBetweenKst(input.calendar[last].liveKst, input.todayKst) > LOL_STALE_AFTER_DAYS;

  const prevOf = (patch: string): string => {
    const idx = sorted.indexOf(patch);
    return idx > 0 ? sorted[idx - 1] : patch;
  };

  // 수동 지정은 라이브일과 무관하게 돌고 **중복 가드를 타지 않는다**(재수집이 그 목적이다).
  if (input.manualPatch) {
    const patch = input.manualPatch;
    return {
      shouldRun: true,
      patch,
      from: input.manualFrom ?? prevOf(patch),
      to: input.manualTo ?? patch,
      staleCalendar,
      reason: `수동 실행 — patch=${patch}`,
    };
  }

  const found = sorted.find((p) => input.calendar[p].liveKst === input.todayKst) ?? null;
  if (found === null) {
    return {
      shouldRun: false,
      patch: null,
      from: null,
      to: null,
      staleCalendar,
      reason: staleCalendar
        ? `오늘(KST ${input.todayKst}) 라이브 패치 없음 — 그런데 마지막 등록이 ${last}다. 캘린더가 낡았을 수 있다`
        : `오늘(KST ${input.todayKst}) PATCH_CALENDAR에 등록된 신규 패치 라이브 없음`,
    };
  }

  if (input.hasOutputs && input.force !== true) {
    return {
      shouldRun: false,
      patch: found,
      from: null,
      to: null,
      staleCalendar,
      reason: `${found} 산출물이 이미 있다 — 이번 주 수집은 중복 실행으로 판단해 건너뜀`,
    };
  }

  return {
    shouldRun: true,
    patch: found,
    from: input.manualFrom ?? prevOf(found),
    to: input.manualTo ?? found,
    staleCalendar,
    reason: `patch=${found} 수집(라이브일)`,
  };
}
