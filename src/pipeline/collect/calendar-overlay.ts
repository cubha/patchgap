// src/pipeline/collect/calendar-overlay.ts
// 패치 캘린더 **기저 상수 + 오버레이** 병합 규칙(2026-09-21). 순수 함수만 — fs는
// `scripts/shared/calendar.ts`가 갖는다.
//
// 왜 오버레이인가: 캘린더 갱신을 무인화하면 "봇이 무엇을 쓰는가"가 위험의 전부가 된다.
// 봇이 TypeScript를 쓰면 오작동 시 타입 오류로 파이프라인 전체가 서고 롤백이 diff 되돌리기다.
// 데이터 파일이면 롤백이 **파일 비우기**고, 잘못된 값도 아래 검증에 걸려 애초에 안 들어간다.
//
// 세 규칙이 전부다:
//   ① **형식** — 패치 ID·날짜·라벨이 정규식을 통과해야 한다(경로·셸로 흘러드는 값이다).
//   ② **단조** — 마지막 항목보다 확실히 뒤인 것만 받는다. 감시자가 오탐하거나 같은 패치를
//      두 번 봐도 과거를 소급해 수집 구간을 흔들지 못한다.
//   ③ **기저 우선** — 사람이 적은 값은 오버레이가 덮지 못한다.

import type { PatchCalendarEntry } from "./patch-calendar";
import type { TftPatchWindow } from "./tft-crawler";
import type { PubgPatchWindow } from "./pubg/patch-calendar";

const PATCH_ID = /^\d{2}\.\d{1,2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** PUBG 텔레메트리 라벨 — `pc-2018-43`. 연도 자리는 레거시 상수라 변하지 않는다. */
const TELEMETRY_LABEL = /^pc-\d{4}-\d+$/;

/** `26.9` < `26.18` — 문자열 비교로는 뒤집힌다. */
function comparePatchId(a: string, b: string): number {
  const [aMajor, aMinor] = a.split(".").map(Number);
  const [bMajor, bMinor] = b.split(".").map(Number);
  return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor;
}

function assertPatchId(patch: string): void {
  if (!PATCH_ID.test(patch)) {
    throw new Error(`캘린더 오버레이: 패치 ID 형식이 아니다 — ${JSON.stringify(patch)}`);
  }
}

function assertMonotonic(what: string, lastKey: string | null, nextKey: string): void {
  if (lastKey !== null && comparePatchId(nextKey, lastKey) <= 0) {
    throw new Error(
      `캘린더 오버레이: ${what} ${nextKey}가 마지막 항목 ${lastKey}보다 뒤가 아니다 — 단조 위반`
    );
  }
}

/** LoL — 기저 Record에 뒤 패치만 더한다. */
export function mergeLolCalendar(
  base: Record<string, PatchCalendarEntry>,
  overlay: Record<string, PatchCalendarEntry>
): Record<string, PatchCalendarEntry> {
  const merged: Record<string, PatchCalendarEntry> = { ...base };
  const entries = Object.entries(overlay).sort(([a], [z]) => comparePatchId(a, z));
  for (const [patch, entry] of entries) {
    assertPatchId(patch);
    if (!DATE_ONLY.test(entry?.liveKst ?? "")) {
      throw new Error(`캘린더 오버레이: ${patch}의 liveKst가 YYYY-MM-DD가 아니다`);
    }
    // 기저 우선 — 사람이 적은 값은 덮지 않는다(③).
    if (Object.prototype.hasOwnProperty.call(base, patch)) continue;
    const keys = Object.keys(merged).sort(comparePatchId);
    assertMonotonic("LoL 패치", keys[keys.length - 1] ?? null, patch);
    merged[patch] = { liveKst: entry.liveKst };
  }
  return merged;
}

/**
 * TFT — 새 창을 이으면서 **직전 열린 창을 닫는다**. 창이 끊기면 `liveTftPatch`가 그 사이
 * 시각에 `null`을 돌려주고 수집이 조용히 멈추므로, 닫는 일을 사람 손에 남기지 않는다.
 */
export function mergeTftWindows(
  base: readonly TftPatchWindow[],
  overlay: readonly TftPatchWindow[]
): TftPatchWindow[] {
  const merged: TftPatchWindow[] = base.map((w) => ({ ...w }));
  for (const next of [...overlay].sort((a, z) => a.startMs - z.startMs)) {
    assertPatchId(next.patch);
    if (!Number.isFinite(next.startMs)) {
      throw new Error(`캘린더 오버레이: TFT ${next.patch}의 startMs가 숫자가 아니다`);
    }
    if (merged.some((w) => w.patch === next.patch)) {
      throw new Error(`캘린더 오버레이: TFT ${next.patch}는 이미 캘린더에 있다`);
    }
    const last = merged[merged.length - 1];
    if (last && next.startMs <= last.startMs) {
      throw new Error(
        `캘린더 오버레이: TFT ${next.patch}의 시작이 ${last.patch}보다 뒤가 아니다 — 단조 위반`
      );
    }
    if (last) last.endMs = next.startMs;
    merged.push({ patch: next.patch, startMs: next.startMs, endMs: null });
  }
  return merged;
}

/** PUBG — 형식·단조만 본다. 마이너 쌍(같은 라벨)도 날짜 창이 가르므로 받는다. */
export function mergePubgWindows(
  base: readonly PubgPatchWindow[],
  overlay: readonly PubgPatchWindow[]
): PubgPatchWindow[] {
  const merged: PubgPatchWindow[] = base.map((w) => ({ ...w }));
  for (const next of [...overlay].sort((a, z) => a.liveFrom.localeCompare(z.liveFrom))) {
    assertPatchId(next.patch);
    if (!TELEMETRY_LABEL.test(next.telemetryPatch ?? "")) {
      throw new Error(
        `캘린더 오버레이: PUBG ${next.patch}의 telemetryPatch가 pc-YYYY-N 형식이 아니다 — ` +
          JSON.stringify(next.telemetryPatch)
      );
    }
    if (!DATE_ONLY.test(next.liveFrom ?? "")) {
      throw new Error(`캘린더 오버레이: PUBG ${next.patch}의 liveFrom이 YYYY-MM-DD가 아니다`);
    }
    const last = merged[merged.length - 1];
    if (last) {
      assertMonotonic("PUBG 패치", last.patch, next.patch);
      if (next.liveFrom <= last.liveFrom) {
        throw new Error(
          `캘린더 오버레이: PUBG ${next.patch}의 liveFrom이 ${last.patch}보다 뒤가 아니다 — 단조 위반`
        );
      }
      // 같은 텔레메트리 라벨(마이너 쌍)을 **받는다**(2026-09-21 정정). 라벨은 메이저까지만
      // 담지만 비교 구간을 가르는 것은 **날짜**다 — 판정 축(`selectMatches`)도 수치 축
      // (`run-gamedata-diff` runPubg)도 「라벨 AND 날짜」로 거르므로 43.1 → 43.2가 성립한다.
    }
    merged.push({ ...next });
  }
  return merged;
}
