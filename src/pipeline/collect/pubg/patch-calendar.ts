// src/pipeline/collect/pubg/patch-calendar.ts
// PUBG 패치 달력과 "오늘 수집을 돌려야 하나" 판정 — TFT의 `tft-patch-calendar.ts`와 같은 자리다.
//
// **왜 수기 상수인가.** PUBG는 패치 라벨(`pc-2018-43`)을 텔레메트리 안에서만 노출하고, 패치
// 게시 시각을 주는 API가 없다. 공지 크롤링은 파서 하나를 더 만드는 일이고, 패치 주기가 월 1회
// (아래 실측)라 상수 한 줄을 갱신하는 편이 정직하고 싸다. **갱신 누락은 알람으로 잡는다**
// (`staleCalendar`) — 마지막 패치가 열린 채 너무 오래 지나면 달력이 낡았다고 말한다.
//
// 실측 주기(2026-09-16 조사): 41.1 4/8 · 41.2 5/12 · 42.1 6/16 · 42.2 7/13 · 42.3 8/11 ·
// 43.1 9/9 → 약 4~5주 간격. 다음은 대략 10/8 전후다.
//
// **336시간 보존창이 일정을 지배한다.** 텔레메트리는 매치 생성 후 14일이면 사라지므로, 비교
// 구간의 **가장 오래된 날**이 창 안에 있을 때 수집해야 한다. 아래 창 정의에서 그 날은
// `patch-5`이고, 따라서 수집 가능 구간은 `patch+7 … patch+9` 사흘뿐이다:
//   - `patch+7` 이전에는 after 창(`patch+2 … patch+6`)의 마지막 날이 아직 끝나지 않았다.
//   - `patch+9` 이후에는 before 창의 첫날(`patch-5`)이 336시간을 넘겨 CDN에서 사라진다.
// 그래서 워크플로는 **매일** 돌고 이 판정이 사흘 중 하루를 고른다(놓치면 그 패치는 영영 못 쓴다).

/** 패치 1건 — 라이브 시작 날짜(UTC)와 텔레메트리 패치 라벨. */
export interface PubgPatchWindow {
  /** 화면·파일명에 쓰는 표기(`43.1`). */
  patch: string;
  /** 텔레메트리 `LogMatchDefinition`이 주는 라벨(`pc-2018-43`). 집계가 이걸로 거른다. */
  telemetryPatch: string;
  /** 라이브 시작일(UTC, `YYYY-MM-DD`). */
  liveFrom: string;
}

/**
 * 손으로 적은 **기저** 창. 감시자(`patch-watch.yml`)가 `data/patch-calendar/pubg.json`에 더하고
 * 소비자는 `loadPubgWindows()`로 합쳐 본다.
 *
 * **감시자가 잡을 수 있는 것은 메이저 상승뿐이다** — 텔레메트리 라벨이 `pc-2018-43`처럼
 * 메이저까지만 담아 43.1 → 43.2를 구분하지 못한다(그리고 넣어서도 안 된다: 두 창의 라벨이
 * 같으면 피해 격자가 한 배열로 붕괴해 대조가 언제나 0건이 된다). 마이너는 손으로 적는다.
 */
export const PUBG_PATCH_WINDOWS: readonly PubgPatchWindow[] = [
  { patch: "42.3", telemetryPatch: "pc-2018-42", liveFrom: "2026-08-11" },
  { patch: "43.1", telemetryPatch: "pc-2018-43", liveFrom: "2026-09-09" },
];

/** 비교 구간 정의(PLAN §6-2·§6-3) — 각 5일, 경계 2일(patch·patch+1) 제외. */
export const WINDOW_DAYS = 5;
/** 패치 당일과 다음 날은 롤아웃 시차가 미검증이라 양쪽에서 뺀다. */
export const BOUNDARY_DAYS = 2;
/** 수집 가능 구간의 시작·끝(패치일로부터 며칠째인가). 위 헤더의 336시간 계산 결과다. */
export const HARVEST_EARLIEST_DAY = WINDOW_DAYS + BOUNDARY_DAYS; // patch+7
export const HARVEST_LATEST_DAY = 9;
/**
 * 이 일수를 넘도록 새 패치가 안 들어오면 달력이 낡은 것으로 본다.
 *
 * 70 → **35**(2026-09-21). 70일은 주기(27~35일 실측)의 두 배라 **너무 늦게 운다** — 43.1(9/9)
 * 기준 11/18에 우는데, 다음 패치의 수집 창(`patch+7 … patch+9`)은 10월 중순에 이미 닫힌다.
 * 놓친 패치쌍은 텔레메트리 336시간 보존 때문에 **영영 못 만든다**.
 *
 * PUBG는 감시자(`patch-watch.yml`)가 **탐지할 수 없는 유일한 게임**이라(텔레메트리 라벨이
 * 메이저까지만 담고 공지 사이트는 SPA라 404도 200을 준다) 이 경보가 사람에게 가는 유일한 신호다.
 * 관측 최대 간격(35일)에 맞춰, 그보다 길어지면 곧바로 말하게 한다.
 */
export const STALE_AFTER_DAYS = 35;

const DAY_MS = 86_400_000;

function toUtcMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** `YYYY-MM-DD` 문자열로 되돌린다(UTC 기준). */
export function toDayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * 비교 구간의 날짜 집합.
 *
 * before = `patch-5 … patch-1`, after = `patch+2 … patch+6`. 두 창은 **정확히 7일 차이**라
 * 요일이 저절로 맞는다 — 주말 비중이 달라지면 플레이어 구성 차이가 패치 효과와 섞이므로
 * (PLAN §6-2) 요일 정렬은 선택이 아니라 요구사항이고, 이 정의는 그것을 산술로 보장한다.
 */
export function comparisonWindows(liveFrom: string): { before: string[]; after: string[] } {
  const base = toUtcMs(liveFrom);
  const before: string[] = [];
  const after: string[] = [];
  for (let i = WINDOW_DAYS; i >= 1; i -= 1) before.push(toDayString(base - i * DAY_MS));
  for (let i = BOUNDARY_DAYS; i < BOUNDARY_DAYS + WINDOW_DAYS; i += 1) after.push(toDayString(base + i * DAY_MS));
  return { before, after };
}

export interface PubgRunInput {
  nowMs: number;
  /** 이미 산출물이 있는가(같은 패치쌍을 두 번 돌지 않는다). */
  outputsExist: boolean;
  /** 수동 실행 — 판정을 건너뛰고 돌린다. */
  force?: boolean;
}

export interface PubgRunDecision {
  shouldRun: boolean;
  from: string | null;
  to: string | null;
  telemetryFrom: string | null;
  telemetryTo: string | null;
  before: string[];
  after: string[];
  reason: string;
  /** 달력이 낡았다는 신호 — 초록불 침묵을 막는 알람. */
  staleCalendar: boolean;
}

/** 패치일로부터 며칠째인가(UTC 일 단위, 패치 당일 = 0). */
export function daysSincePatch(liveFrom: string, nowMs: number): number {
  return Math.floor((nowMs - toUtcMs(liveFrom)) / DAY_MS);
}

/**
 * 오늘 수집을 돌려야 하는지 판정한다.
 *
 * 돌리지 않을 이유를 **말하게** 한다 — 조용한 스킵은 "정기 수집이 돌고 있다"는 착각을 만들고,
 * 그것이 이 저장소가 반복해서 고쳐 온 결함군이다.
 */
export function determinePubgRun(
  input: PubgRunInput,
  windows: readonly PubgPatchWindow[] = PUBG_PATCH_WINDOWS
): PubgRunDecision {
  const latest = windows[windows.length - 1];
  const previous = windows[windows.length - 2];
  const empty: Omit<PubgRunDecision, "reason" | "shouldRun" | "staleCalendar"> = {
    from: null,
    to: null,
    telemetryFrom: null,
    telemetryTo: null,
    before: [],
    after: [],
  };

  if (!latest || !previous) {
    return { ...empty, shouldRun: false, reason: "패치 달력에 비교할 쌍이 없다", staleCalendar: true };
  }

  const age = daysSincePatch(latest.liveFrom, input.nowMs);
  const staleCalendar = age > STALE_AFTER_DAYS;
  const { before, after } = comparisonWindows(latest.liveFrom);
  const pair = {
    from: previous.patch,
    to: latest.patch,
    telemetryFrom: previous.telemetryPatch,
    telemetryTo: latest.telemetryPatch,
    before,
    after,
  };

  if (input.force) {
    return { ...pair, shouldRun: true, reason: `수동 실행(force) — ${previous.patch} → ${latest.patch}`, staleCalendar };
  }
  if (input.outputsExist) {
    return {
      ...pair,
      shouldRun: false,
      reason: `${previous.patch} → ${latest.patch} 산출물이 이미 있다 — 중복 실행으로 판단해 건너뛴다`,
      staleCalendar,
    };
  }
  if (age < HARVEST_EARLIEST_DAY) {
    return {
      ...pair,
      shouldRun: false,
      reason: `${latest.patch} 라이브 ${age}일째 — 비교 구간(patch+${BOUNDARY_DAYS}…+${BOUNDARY_DAYS + WINDOW_DAYS - 1})이 아직 안 닫혔다`,
      staleCalendar,
    };
  }
  if (age > HARVEST_LATEST_DAY) {
    return {
      ...pair,
      shouldRun: false,
      reason:
        `${latest.patch} 라이브 ${age}일째 — 336시간 보존창을 넘겨 before 구간(${before[0]})의 ` +
        `텔레메트리가 사라졌다. 이 패치쌍은 수집 불가다`,
      staleCalendar,
    };
  }
  return { ...pair, shouldRun: true, reason: `${previous.patch} → ${latest.patch} 수집(라이브 ${age}일째)`, staleCalendar };
}
