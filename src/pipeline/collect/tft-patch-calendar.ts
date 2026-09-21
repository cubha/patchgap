// src/pipeline/collect/tft-patch-calendar.ts
// TFT 패치 캘린더 — LoL `patch-calendar.ts`와 **같은 자리·같은 성격**(수기 상수)이다.
//
// **왜 수기인가.** TFT 매치 응답의 `game_version`은 항상 `"TFT Unreal Version ?.?.?.?"`로 비어
// 있다(2026-09-20 실측, 400명 전수). 즉 매치만 봐서는 어느 패치인지 알 수 없고, 구분의 유일한
// 기준이 **공식 패치노트 발행 시각**이다. 노트 인덱스를 크롤링해 자동 발견하는 것이 궁극적
// 해법이지만, 그 전까지는 이 상수가 Ground Truth다 — 새 패치가 나오면 여기 한 줄을 추가한다.
//
// **이 파일이 `scripts/`가 아니라 `src/pipeline/collect/`에 있는 이유**: 워크플로의 `determine`
// 스텝이 읽어야 한다. 스크립트 안에 두면 CI가 같은 규칙을 다시 적게 되고, 그러면 두 곳이
// 조용히 갈라진다(이 저장소가 반복해서 고쳐 온 결함군 — `shared/headline.ts` 헤더 참고).
import type { TftPatchWindow } from "./tft-crawler";

/**
 * 패치 창 — 공식 패치노트 발행 시각(2026-09-20 실측). `endMs: null`이 "지금 라이브"다.
 *
 * 2026-09-21부터 새 패치는 감시자(`patch-watch.yml`)가 `data/patch-calendar/tft.json`에 적고,
 * 소비자는 둘을 합친 `loadTftWindows()`를 본다 — **이 상수는 더 이상 전체 목록이 아니다**.
 * 위 헤더가 "궁극적 해법"이라 적어 둔 자동 발견이 그것이다(다만 인덱스를 크롤링하지 않고
 * 다음 후보 URL의 존재와 `datePublished`만 본다).
 */
export const TFT_PATCH_WINDOWS: readonly TftPatchWindow[] = [
  { patch: "18.1", startMs: Date.parse("2026-08-25T18:00:00Z"), endMs: Date.parse("2026-09-09T18:00:00Z") },
  { patch: "18.2", startMs: Date.parse("2026-09-09T18:00:00Z"), endMs: null },
];

/**
 * 패치가 라이브된 뒤 **이만큼 지나야** 수집한다.
 *
 * 왜 필요한가(실측): TFT 표본은 KR Master+ 래더라 하루 약 227매치씩만 쌓인다
 * (18.2 = 11일에 2,496매치). 패치 당일에 수집하면 새 패치 구간이 사실상 비어 판정이
 * 전부 `insufficient-sample`로 떨어진다. LoL은 하루 1만 매치가 나와 이 문제가 없다 —
 * 같은 cron 설계를 그대로 가져오면 TFT에서만 조용히 빈 판정을 낸다.
 */
export const TFT_MIN_LIVE_DAYS = 7;

/**
 * 열린 창이 이보다 오래 열려 있으면 **캘린더가 낡았다고 본다**.
 *
 * 관측 주기는 15일(18.1 8/25 → 18.2 9/9)이다. 그 1.5배를 넘도록 다음 패치가 캘린더에
 * 안 들어왔다면 사람이 갱신을 잊은 것이다. 단순히 "열린 창 + 산출물 있음"으로 잡으면
 * **정상 정상상태가 매일 경보를 울린다**(패치 직후부터 다음 패치까지가 전부 그 상태다).
 */
export const TFT_STALE_AFTER_DAYS = 22;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 그 패치 창이 열린 지 며칠 됐나. 캘린더에 없으면 null. */
export function windowAgeDays(patch: string, nowMs: number, windows: readonly TftPatchWindow[] = TFT_PATCH_WINDOWS): number | null {
  const w = windows.find((x) => x.patch === patch);
  return w ? (nowMs - w.startMs) / DAY_MS : null;
}

/** 그 시각에 라이브인 패치. 경계는 **시작 포함·끝 배제**라 한 시각이 두 패치에 속하지 않는다. */
export function liveTftPatch(nowMs: number, windows: readonly TftPatchWindow[] = TFT_PATCH_WINDOWS): string | null {
  for (const w of windows) {
    if (nowMs >= w.startMs && (w.endMs === null || nowMs < w.endMs)) return w.patch;
  }
  return null;
}

/** 직전 패치 — 판정은 쌍으로만 성립하므로 이게 null이면 수집해도 대조할 것이 없다. */
export function previousTftPatch(patch: string, windows: readonly TftPatchWindow[] = TFT_PATCH_WINDOWS): string | null {
  const idx = windows.findIndex((w) => w.patch === patch);
  return idx > 0 ? windows[idx - 1].patch : null;
}

/** 끝이 안 닫힌 창인가. 캘린더 스테일 감지의 재료다(단독으로는 결함이 아니다). */
export function isOpenEnded(patch: string, windows: readonly TftPatchWindow[] = TFT_PATCH_WINDOWS): boolean {
  const w = windows.find((x) => x.patch === patch);
  return w ? w.endMs === null : false;
}

export interface TftRunInput {
  nowMs: number;
  /** 이 패치쌍의 판정 산출물이 이미 있는가(`aggregated/tft/deltas-{from}-{to}.json`). */
  hasOutputs: boolean;
  /** workflow_dispatch 수동 지정 — 캘린더 판정을 이긴다. */
  manualPatch?: string;
  /** 산출물이 있어도, 표본 대기 중이어도 다시 돌린다. */
  force?: boolean;
  /** 표본 대기 일수 오버라이드(테스트·수동 실행용). 기본 `TFT_MIN_LIVE_DAYS`. */
  minLiveDays?: number;
}

export interface TftRunDecision {
  shouldRun: boolean;
  patch: string | null;
  from: string | null;
  to: string | null;
  /**
   * **초록불 침묵 경보.** 열린 창(`endMs: null`)의 산출물이 이미 있다는 것은 대개
   * "다음 패치가 나왔는데 `TFT_PATCH_WINDOWS`를 아무도 안 고쳤다"는 뜻이다. 그 상태로 두면
   * 워크플로가 **영원히 초록불로 스킵**하고 사람은 정기 수집이 도는 줄 안다 — 실패보다 나쁘다.
   */
  staleCalendar: boolean;
  reason: string;
}

/**
 * 워크플로 `determine` 스텝의 순수 두뇌. I/O(산출물 존재 확인)는 호출부가 하고, 여기서는
 * 판정만 한다 — 그래야 이 규칙이 단위 테스트로 고정된다.
 *
 * 캘린더 밖 시각은 **실패가 아니라 no-op**이다(LoL `determine`과 같은 규약). 패치가 없는 주에
 * 빨간 X가 뜨면 진짜 실패와 구분되지 않는다.
 */
export function determineTftRun(input: TftRunInput, windows: readonly TftPatchWindow[] = TFT_PATCH_WINDOWS): TftRunDecision {
  const patch = input.manualPatch ?? liveTftPatch(input.nowMs, windows);
  if (patch === null) {
    return {
      shouldRun: false,
      patch: null,
      from: null,
      to: null,
      staleCalendar: false,
      reason: `캘린더에 이 시각(${new Date(input.nowMs).toISOString()})의 라이브 패치가 없다 — no-op`,
    };
  }

  const from = previousTftPatch(patch, windows);
  const ageDays = windowAgeDays(patch, input.nowMs, windows);
  const stale =
    isOpenEnded(patch, windows) && input.hasOutputs && ageDays !== null && ageDays > TFT_STALE_AFTER_DAYS;

  if (from === null) {
    return {
      shouldRun: false,
      patch,
      from: null,
      to: patch,
      staleCalendar: stale,
      reason: `${patch}의 직전 패치가 캘린더에 없다 — 대조 쌍이 없어 판정할 수 없다`,
    };
  }

  // 표본 대기 — 패치 직후엔 새 구간이 거의 비어 있어 수집해도 판정이 서지 않는다.
  // 수동 지정(`manualPatch`)과 `force`는 이 게이트를 넘는다: 사람이 의도적으로 부른 것이다.
  const minLive = input.minLiveDays ?? TFT_MIN_LIVE_DAYS;
  if (
    input.force !== true &&
    input.manualPatch === undefined &&
    ageDays !== null &&
    ageDays < minLive
  ) {
    return {
      shouldRun: false,
      patch,
      from,
      to: patch,
      staleCalendar: stale,
      reason:
        `${patch}가 라이브된 지 ${ageDays.toFixed(1)}일 — 표본이 쌓일 시간(${minLive}일)이 아직 부족하다. ` +
        `KR Master+ 래더는 하루 약 227매치라 지금 수집하면 판정이 전부 표본부족으로 떨어진다`,
    };
  }

  if (input.hasOutputs && input.force !== true) {
    return {
      shouldRun: false,
      patch,
      from,
      to: patch,
      staleCalendar: stale,
      reason: stale
        ? `${from} → ${patch} 산출물이 이미 있는데 ${patch} 창이 아직 열려 있다 — ` +
          `캘린더가 낡았을 수 있다. 다음 패치를 TFT_PATCH_WINDOWS에 추가하라`
        : `${from} → ${patch} 산출물이 이미 있다 — 중복 실행으로 판단해 건너뛴다`,
    };
  }

  return {
    shouldRun: true,
    patch,
    from,
    to: patch,
    staleCalendar: stale,
    reason: `${from} → ${patch} 수집·판정을 실행한다`,
  };
}
