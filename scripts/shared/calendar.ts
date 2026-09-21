// scripts/shared/calendar.ts
// 패치 캘린더 로딩의 **fs 쪽 절반**. 병합 규칙은 순수 모듈 `src/pipeline/collect/calendar-overlay.ts`가
// 소유하고, 여기는 `data/patch-calendar/{game}.json`을 읽어 그 규칙에 먹인다.
//
// 기저 상수(`PATCH_CALENDAR`·`TFT_PATCH_WINDOWS`·`PUBG_PATCH_WINDOWS`)는 **그대로 둔다** —
// 사람이 적은 기록이고, 그 파일의 단위 테스트도 건드리지 않는다. 감시자
// (`scripts/patch-watch.ts`)가 쓰는 것은 오버레이뿐이다.
import fs from "node:fs";
import path from "node:path";

import {
  mergeLolCalendar,
  mergePubgWindows,
  mergeTftWindows,
} from "../../src/pipeline/collect/calendar-overlay";
import { PATCH_CALENDAR, type PatchCalendarEntry } from "../../src/pipeline/collect/patch-calendar";
import { TFT_PATCH_WINDOWS } from "../../src/pipeline/collect/tft-patch-calendar";
import type { TftPatchWindow } from "../../src/pipeline/collect/tft-crawler";
import {
  PUBG_PATCH_WINDOWS,
  type PubgPatchWindow,
} from "../../src/pipeline/collect/pubg/patch-calendar";

export type CalendarGame = "lol" | "tft" | "pubg";

export function overlayPath(game: CalendarGame, dataRoot = "data"): string {
  return path.join(dataRoot, "patch-calendar", `${game}.json`);
}

/** 오버레이가 없거나 비어 있으면 기저 그대로다 — 이게 평상시다. */
function readOverlay<T>(game: CalendarGame, dataRoot: string, fallback: T): T {
  const file = overlayPath(game, dataRoot);
  if (!fs.existsSync(file)) return fallback;
  const text = fs.readFileSync(file, "utf8").trim();
  if (text === "") return fallback;
  return JSON.parse(text) as T;
}

export function loadLolCalendar(dataRoot = "data"): Record<string, PatchCalendarEntry> {
  return mergeLolCalendar(
    PATCH_CALENDAR,
    readOverlay<Record<string, PatchCalendarEntry>>("lol", dataRoot, {})
  );
}

export function loadTftWindows(dataRoot = "data"): TftPatchWindow[] {
  return mergeTftWindows(TFT_PATCH_WINDOWS, readOverlay<TftPatchWindow[]>("tft", dataRoot, []));
}

export function loadPubgWindows(dataRoot = "data"): PubgPatchWindow[] {
  return mergePubgWindows(PUBG_PATCH_WINDOWS, readOverlay<PubgPatchWindow[]>("pubg", dataRoot, []));
}

/** 오버레이에 항목을 더한다(감시자 전용). 병합이 통과할 때만 쓴다 — 검증은 순수 규칙이 한다. */
export function appendOverlay(game: CalendarGame, entry: unknown, dataRoot = "data"): void {
  const file = overlayPath(game, dataRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (game === "lol") {
    const current = readOverlay<Record<string, PatchCalendarEntry>>("lol", dataRoot, {});
    const next = { ...current, ...(entry as Record<string, PatchCalendarEntry>) };
    loadLolCalendarWith(next); // 병합 규칙을 먼저 통과시킨다 — 실패하면 파일을 안 쓴다.
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return;
  }
  const current = readOverlay<unknown[]>(game, dataRoot, []);
  const next = [...current, entry];
  if (game === "tft") mergeTftWindows(TFT_PATCH_WINDOWS, next as TftPatchWindow[]);
  else mergePubgWindows(PUBG_PATCH_WINDOWS, next as PubgPatchWindow[]);
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function loadLolCalendarWith(overlay: Record<string, PatchCalendarEntry>): void {
  mergeLolCalendar(PATCH_CALENDAR, overlay);
}
