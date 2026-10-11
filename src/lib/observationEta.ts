// src/lib/observationEta.ts
// 「관측은 언제부터인가」(PLAN-home-observed-pair ST-3, 2026-10-09). 선언만 쌍(관측 stub)의 배너·안내가 날짜 없이
// "관측 대기"라고만 하면 사람은 대기와 고장을 구별하지 못한다 — 10/8 TFT 18.4 선언 뷰가 "꼬라지"로 읽힌 이유 중 하나.
//
// 날짜는 **파이프라인이 실제로 쓰는 규칙** 그대로 계산한다: 캘린더 창 시작(`loadTftWindows`와 같은 합성: 상수 + 감시자
// 오버레이) + 관측 N일차(`observationDayOf` — F11 실측) 이후 **첫 cron**(collect-tft.yml, 매일 21:00 UTC). 계산 불가(창 없음)면
// null — 날짜를 지어내지 않는다. cron 시각 상수는 테스트가 워크플로 파일과 대조한다(산문·상수가 갈리면 날짜가 조용히 틀린다).
import path from "node:path";

import { mergeTftWindows } from "@/pipeline/collect/calendar-overlay";
import type { TftPatchWindow } from "@/pipeline/collect/tft-crawler";
import { TFT_PATCH_WINDOWS, observationDayOf } from "@/pipeline/collect/tft-patch-calendar";
import { readJsonIfExists } from "@/pipeline/shared/json-file";
import type { ObservationFailure } from "@/pipeline/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `.github/workflows/collect-tft.yml`의 `cron: "0 21 * * *"` — 06:00 KST. */
export const TFT_COLLECT_CRON_HOUR_UTC = 21;

/** 임계 시각 이후(같으면 포함) 첫 "매일 HH:00 UTC". */
export function nextCronAfter(thresholdMs: number, hourUtc: number): number {
  const d = new Date(thresholdMs);
  const sameDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourUtc);
  return sameDay >= thresholdMs ? sameDay : sameDay + DAY_MS;
}

/**
 * 웹이 보는 TFT 패치 창 — `scripts/shared/calendar.ts#loadTftWindows`와 같은 합성(상수 + `data/patch-calendar/tft.json`).
 * lib가 scripts를 import하지 않으려고 복제했다 — 드리프트는 테스트가 두 출력의 deep-equal로 잡는다(observationEta.test).
 */
export function loadTftWindowsForWeb(): TftPatchWindow[] {
  const overlay = readJsonIfExists<TftPatchWindow[]>(path.resolve(process.cwd(), "data", "patch-calendar", "tft.json")) ?? [];
  return mergeTftWindows(TFT_PATCH_WINDOWS, overlay);
}

/** 그 패치의 첫 관측 실행 시각(ISO). 캘린더에 없으면 null. */
export function tftObservationEta(patch: string, windows: readonly TftPatchWindow[] = loadTftWindowsForWeb()): string | null {
  const w = windows.find((x) => x.patch === patch);
  if (!w) return null;
  const threshold = w.startMs + observationDayOf(patch) * DAY_MS;
  return new Date(nextCronAfter(threshold, TFT_COLLECT_CRON_HOUR_UTC)).toISOString();
}

/** 「10/10(토) 06:00 KST」 — 사람이 읽는 예정 시각. */
export function etaLabelKst(iso: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("month")}/${get("day")}(${get("weekday")}) ${hour}:${get("minute")} KST`;
}

/** 화면이 말하는 관측 일정 — `first`: 「첫 관측은 X 예정」, `next`: 「다음 수집은 X 예정」. */
export interface ObservationSchedule {
  kind: "first" | "next";
  /** 「10/10(토) 06:00 KST」 */
  label: string;
}

/**
 * 관측 stub의 일정(2026-10-11). 대기(`awaiting-observation`)·수집 중(`collecting`)이면 **늘** 다음 실행 시각을 말한다 — 전에는 예정이
 * 지나면 null이 되어 화면이 「표본이 쌓이면」만 말했고(75분 마감 부분 수집, 10/10~11), 사람은 수집 중과 고장을 가를 수 없었다.
 *  - 대기 + 예정이 빌드 시각 이후 → `first`(예정 시각). 예정이 지났으면 → `next`(빌드 이후 첫 cron — 그 실행이 관측을 다시 시도한다).
 *  - 수집 중 → `next`(다음 cron이 `ids-seen`으로 이어 받는다).
 *  - 키 만료·크래시 등 → null(날짜가 아니라 조치가 답이다). 캘린더에 없는 패치의 대기도 null(날짜를 지어내지 않는다).
 */
export function tftObservationSchedule(
  failure: ObservationFailure,
  patch: string,
  nowMs: number = Date.now(),
  windows: readonly TftPatchWindow[] = loadTftWindowsForWeb()
): ObservationSchedule | null {
  const next = (): ObservationSchedule => ({
    kind: "next",
    label: etaLabelKst(new Date(nextCronAfter(nowMs, TFT_COLLECT_CRON_HOUR_UTC)).toISOString()),
  });
  if (failure.reason === "collecting") return next();
  if (failure.reason !== "awaiting-observation") return null;
  const planned = tftObservationEta(patch, windows);
  if (planned === null) return null;
  return Date.parse(planned) > nowMs ? { kind: "first", label: etaLabelKst(planned) } : next();
}
