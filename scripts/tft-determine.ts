// scripts/tft-determine.ts
// `collect-tft.yml`의 determine 스텝 — "오늘 TFT를 수집할 것인가"를 한 번에 판정해
// GITHUB_OUTPUT으로 넘긴다.
//
// **왜 워크플로 안의 heredoc이 아닌 실파일인가.** `collect.yml`(LoL)은 임시 `.ts`를 heredoc으로
// 써서 실행하고 지운다. 그 방식은 **tsc·eslint·vitest 어느 게이트도 그 코드를 보지 못한다** —
// 수집 실행 여부를 정하는 코드가 검증 밖에 있는 셈이다. `scripts/**`는 tsconfig include 대상이라
// (CLAUDE.md §TypeScript 규칙) 실파일로 두면 타입 체크를 받고, 판정 규칙 자체는
// `planTftRun`이 순수 함수로 들고 있어 단위 테스트로 고정된다.
//
// 이 파일이 하는 일은 **I/O뿐**이다 — 판정은 `tft-patch-calendar.ts`, 권한은 `tft-preflight.ts`.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import {
  applyTftKeyFailure,
  planTftRun,
  TFT_STALE_AFTER_DAYS,
  type DeltasState,
} from "../src/pipeline/collect/tft-patch-calendar";
import { deltasStateOf } from "../src/pipeline/shared/observation-stub";
import { loadTftWindows } from "./shared/calendar";
import { runTftPreflight } from "../src/pipeline/collect/tft-preflight";
import { envValue, isMainModule, PATCH_ID_PATTERN } from "./shared/cli";
import { reportDeclaration, reportRun, reportSkip, warn, type SkipReason } from "./shared/determine-report";

/**
 * 패치 ID 형식 — `scripts/shared/cli.ts`의 `PATCH_ID_PATTERN`(`type: "patch"`와 **같은 규칙**)을 쓴다.
 *
 * 여기서 다시 검사하는 이유: 이 값은 argv가 아니라 `workflow_dispatch` 입력에서 env로 들어오므로
 * `parseCliArgs`를 거치지 않는다. 그런데 그대로 파일 경로(`deltas-{from}-{to}.json`)에 꿰어지고,
 * 이 잡은 `RIOT_API_KEY`와 `contents: write`를 들고 있다 — LoL 워크플로가 같은 이유로
 * security-auditor 지적을 받았다(2026-09-06·2026-09-17). 형식을 통과하지 못하면 즉시 죽인다.
 */
function manualPatchOf(): string | undefined {
  const raw = envValue("MANUAL_PATCH");
  if (raw === undefined) return undefined;
  if (!PATCH_ID_PATTERN.test(raw)) {
    throw new Error(`tft-determine: MANUAL_PATCH 형식이 올바르지 않다: "${raw}" (예: 18.2)`);
  }
  return raw;
}

/** 이 쌍의 판정 파일 상태 — 관측이면 보드 파일의 `observedUntil`(C8)까지 읽는다. */
export function readTftDeltasState(dataRoot: string, from: string, to: string): DeltasState {
  const dir = path.join(dataRoot, "aggregated", "tft");
  const file = path.join(dir, `deltas-${from}-${to}.json`);
  const parsed = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null;
  const state = deltasStateOf(parsed, from, to);
  if (state.kind !== "observed") return state;
  const boardsFile = path.join(dir, `boards-${to}.json`);
  const boards = fs.existsSync(boardsFile) ? (JSON.parse(fs.readFileSync(boardsFile, "utf8")) as { observedUntil?: string }) : {};
  const until = boards.observedUntil === undefined ? NaN : Date.parse(boards.observedUntil);
  return { kind: "observed", observedUntilMs: Number.isNaN(until) ? null : until };
}

/**
 * 판정 순서(2026-09-28, C13·C14): ① 캘린더로 계획(선언/관측/건너뜀) → ② **관측 계획일 때만** 키를 본다 →
 * 키가 죽었으면 `applyTftKeyFailure`로 강등(실제 관측은 유지, 없으면 선언 stub). 전에는 키 검사가 맨
 * 앞이라 401 하나로 패치노트까지 멈췄다(2026-09-26~ 실측) — 선언 축은 공개 자원만 써서 키가 필요 없다.
 */
export async function main(): Promise<void> {
  const dataRoot = envValue("TFT_DATA_ROOT") ?? "data";
  const manualPatch = manualPatchOf();
  const force = envValue("MANUAL_FORCE") === "true";
  const platform = envValue("TFT_PLATFORM") ?? "kr";
  // **TFT 전용 키를 먼저 본다.** LoL 승인 키(RIOT_API_KEY)는 TFT 엔드포인트에 403이다
  // (2026-09-20 실측 — tft-preflight.ts 헤더 표). 폴백을 남기는 이유는 제품 승인 후
  // 키가 하나로 합쳐질 수 있어서다. 그때 403이면 프리플라이트가 그대로 알려 준다.
  const apiKey = envValue("RIOT_TFT_API_KEY") ?? envValue("RIOT_API_KEY");

  const nowMs = Date.now();
  const windows = loadTftWindows(dataRoot);
  // 쌍을 먼저 알아야 산출물 상태를 읽을 수 있다 — 상태 없이 한 번 물어 쌍만 얻는다.
  const probe = planTftRun({ nowMs, notesExist: false, deltas: { kind: "none" }, manualPatch, force }, windows);
  const notesExist =
    probe.to !== null && fs.existsSync(path.join(dataRoot, "aggregated", "tft", `notes-${probe.to}.json`));
  const deltas: DeltasState =
    probe.from !== null && probe.to !== null ? readTftDeltasState(dataRoot, probe.from, probe.to) : { kind: "none" };
  let plan = planTftRun({ nowMs, notesExist, deltas, manualPatch, force }, windows);
  console.log(`[tft-determine] ${plan.reason}`);

  if (plan.staleCalendar) {
    // 초록불 침묵 경보 — 이 조건이 뜨면 대개 다음 패치가 이미 나왔다는 뜻이다.
    warn(
      `TFT 패치 캘린더가 낡았을 수 있다: ${plan.patch} 창이 열려 있는데(endMs=null) 관측 산출물이 ` +
        `${TFT_STALE_AFTER_DAYS}일 넘게 그대로다. 감시자(patch-watch.yml)가 다음 패치를 탐지했는지 확인하라.`
    );
  }

  // ② 관측 계획일 때만 키를 본다.
  let keyIssue: SkipReason | undefined;
  if (plan.mode === "observation") {
    if (!apiKey) {
      keyIssue = "key-missing";
    } else {
      const preflight = await runTftPreflight({ apiKey, platform });
      if (!preflight.proceed) {
        // 진짜 오류는 삼키지 않는다 — 조용히 스킵하면 "돌고 있다"는 착각을 만든다.
        if (preflight.fatal) throw new Error(preflight.message);
        // **401과 403은 조치가 정반대다** — 만료는 사람이 재발급해야 하고, 미승인은 사람이 할 일이 없다.
        keyIssue = preflight.kind === "product-unapproved" ? "product-unapproved" : "key-expired";
        console.log(`[tft-determine] 프리플라이트: ${preflight.message}`);
      }
    }
    if (keyIssue !== undefined) plan = applyTftKeyFailure(plan, deltas, notesExist);
  }

  if (plan.mode === "skip" || plan.from === null || plan.to === null) {
    reportSkip("tft", keyIssue ?? "no-run-condition", plan.reason);
    return;
  }
  const values = { patch: plan.patch ?? "", from: plan.from, to: plan.to };
  if (plan.mode === "declaration") {
    reportDeclaration("tft", values, keyIssue ?? "awaiting-observation", plan.reason, keyIssue);
    return;
  }
  reportRun("tft", values);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[tft-determine] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
