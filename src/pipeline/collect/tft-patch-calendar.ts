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
import type { PatchRunDecisionBase } from "../types";

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

// ── 선언 축 / 관측 축 실행 계획(2026-09-28, C13·C14 — 사용자 결정 D5·D6) ─────────────────────
//
// **왜 갈랐나.** 이전 판정(`determineTftRun`, 삭제)은 7일 대기와 키 프리플라이트가 실행 **전체**를 막았다 — 그 안에
// 패치노트(선언 축)가 들어 있어 TFT 새 패치 노트가 일주일간 화면에 안 나왔고(F1), 키가 만료되면 노트까지
// 멈췄다(2026-09-28 실측: 9/26부터 매일 401 → 전 단계 스킵). 결정 8 「선언 축은 항상 최신, 관측 축이
// 인질로 잡지 않는다」 위반이다. 선언 축은 공개 자원(패치노트 웹페이지·CDragon)만 쓰므로 키가 필요 없다.
//
// **N일차의 근거(F11 실측)**: 초반 k일 관측과 이후 독립 표본의 순위상관 — 세트 중간(18.2) 3일 0.942 →
// 7일 0.961로 거의 평탄, 세트 개시(18.1)는 9일에도 잡음 기준에 못 미쳤다. 순방률·평균 등수엔 초반
// 드리프트가 없었다. 그래서 세트 중간 3일 · 세트 개시(X.1) 9일.

/** 세트 중간 패치의 첫 관측일(라이브 후 일수). */
export const TFT_OBSERVATION_DAY_MID_SET = 3;
/** 세트 개시 패치(X.1)의 첫 관측일 — 새 세트는 메타가 늦게 선다. */
export const TFT_OBSERVATION_DAY_SET_LAUNCH = 9;

/**
 * 이 패치쌍 판정 파일의 상태. `stub`은 관측 없이 선언 축만 담은 파일(`meta.observationFailed`)이고
 * **"산출물 없음"과 같게** 취급된다(관측이 스스로 갱신되도록). `observed`의 `observedUntilMs`는 관측에
 * 들어간 마지막 매치 시각이며, 기록이 없던 옛 산출물은 `null`이다.
 */
export type DeltasState = { kind: "none" } | { kind: "stub" } | { kind: "observed"; observedUntilMs: number | null };
export type TftRunMode = "skip" | "declaration" | "observation";

export interface TftPlanInput {
  nowMs: number;
  /** `notes-{to}.json`이 있는가. */
  notesExist: boolean;
  deltas: DeltasState;
  /** workflow_dispatch 수동 지정 — 캘린더 판정을 이기고 관측한다. */
  manualPatch?: string;
  /** 산출물이 있어도, N일차 전이어도 관측한다. */
  force?: boolean;
}

export interface TftRunPlan extends PatchRunDecisionBase {
  mode: TftRunMode;
  patch: string | null;
  from: string | null;
  to: string | null;
  /** 위 `TftRunDecision.staleCalendar`와 같은 뜻 — 초록불 침묵 경보. */
  staleCalendar: boolean;
  reason: string;
}

/** 세트 개시 패치(마이너 1)는 9일, 그 밖은 3일. */
export function observationDayOf(patch: string): number {
  const minor = patch.split(".")[1];
  return minor === "1" ? TFT_OBSERVATION_DAY_SET_LAUNCH : TFT_OBSERVATION_DAY_MID_SET;
}

/**
 * 워크플로 `determine` 스텝의 순수 두뇌(C13 이후). 키 판정은 여기 없다 — 관측 계획이 나왔을 때만
 * 호출부가 프리플라이트를 돌리고, 실패하면 `applyTftKeyFailure`로 강등한다. 선언 계획은 키를 안 본다.
 */
export function planTftRun(input: TftPlanInput, windows: readonly TftPatchWindow[] = TFT_PATCH_WINDOWS): TftRunPlan {
  const patch = input.manualPatch ?? liveTftPatch(input.nowMs, windows);
  const base = { patch, from: null, to: null, staleCalendar: false };
  if (patch === null) {
    return { ...base, mode: "skip", reason: `캘린더에 이 시각(${new Date(input.nowMs).toISOString()})의 라이브 패치가 없다 — no-op` };
  }
  const from = previousTftPatch(patch, windows);
  if (from === null) {
    return { ...base, to: patch, mode: "skip", reason: `${patch}의 직전 패치가 캘린더에 없다 — 대조 쌍이 없어 판정할 수 없다` };
  }
  const pair = { patch, from, to: patch };
  const w = windows.find((x) => x.patch === patch);
  const ageDays = windowAgeDays(patch, input.nowMs, windows) ?? 0;
  const n = observationDayOf(patch);
  const observedLate =
    input.deltas.kind === "observed" &&
    input.deltas.observedUntilMs !== null &&
    w !== undefined &&
    input.deltas.observedUntilMs >= w.startMs + n * DAY_MS;
  const staleCalendar = isOpenEnded(patch, windows) && input.deltas.kind === "observed" && ageDays > TFT_STALE_AFTER_DAYS;

  if (input.force === true || input.manualPatch !== undefined) {
    return { ...pair, staleCalendar, mode: "observation", reason: `수동 실행 — ${from} → ${patch} 관측` };
  }
  if (ageDays >= n) {
    if (input.deltas.kind === "observed" && observedLate) {
      return { ...pair, staleCalendar, mode: "skip", reason: `${from} → ${patch} 관측이 ${n}일차 이후 표본으로 이미 있다 — 중복 실행으로 판단해 건너뛴다` };
    }
    const why =
      input.deltas.kind === "observed"
        ? `관측 시점이 ${n}일차 이전이거나 기록이 없다 — 한 번 더 모은다`
        : `관측 산출물이 없다(${input.deltas.kind === "stub" ? "선언 축 stub만 있음" : "파일 없음"})`;
    return { ...pair, staleCalendar, mode: "observation", reason: `${patch} 라이브 ${ageDays.toFixed(1)}일째(관측 ${n}일차 이후) — ${why}` };
  }
  // N일차 전 — 관측은 아직, 선언 축만 챙긴다.
  if (input.deltas.kind === "none" || !input.notesExist) {
    return { ...pair, staleCalendar, mode: "declaration", reason: `${patch} 라이브 ${ageDays.toFixed(1)}일째 — 패치노트를 즉시 반영하고 관측은 ${n}일차부터` };
  }
  return { ...pair, staleCalendar, mode: "skip", reason: `${patch} 라이브 ${ageDays.toFixed(1)}일째 — 선언 축은 반영됐고 관측은 ${n}일차부터` };
}

/**
 * 관측 계획인데 키가 죽었을 때(401 만료·403 미승인). **실제 관측 산출물은 stub으로 덮지 않는다** —
 * 있는 관측을 지우는 것은 화면을 뒤로 돌리는 것이다. 관측도 선언도 없으면 선언(stub)으로 강등한다.
 */
export function applyTftKeyFailure(plan: TftRunPlan, deltas: DeltasState, notesExist: boolean): TftRunPlan {
  if (plan.mode !== "observation") return plan;
  if (deltas.kind === "observed") {
    return { ...plan, mode: "skip", reason: `${plan.reason} — 그러나 키가 없어 관측할 수 없다. 기존 관측을 유지한다` };
  }
  if (deltas.kind === "stub" && notesExist) {
    return { ...plan, mode: "skip", reason: `${plan.reason} — 그러나 키가 없어 관측할 수 없다. 선언 축은 이미 반영됐다` };
  }
  return { ...plan, mode: "declaration", reason: `${plan.reason} — 그러나 키가 없어 관측할 수 없다. 선언 축만 반영한다` };
}
