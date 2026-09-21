// scripts/lol-determine.ts
// LoL 수집 실행 여부 판정 — `collect.yml`의 `determine` 스텝 진입점.
//
// **이 파일이 왜 생겼나(2026-09-21).** 같은 판정이 워크플로 안 heredoc으로 있었다. 그러면
// tsc·eslint·vitest 어느 게이트도 그 코드를 보지 못한다 — 수집 실행 여부를 정하는 코드가 검증
// 밖에 있었다는 뜻이다(TFT·PUBG는 처음부터 실파일이다). 판정 규칙은
// `src/pipeline/collect/patch-calendar.ts`의 `determineLolRun`이 순수 함수로 갖고 단위 테스트가
// 고정한다. 이 파일은 env를 읽고 출력을 쓰는 얇은 껍데기다.
//
// 캘린더는 **기저 상수 + 감시자 오버레이** 병합본을 본다(`scripts/shared/calendar.ts`).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { determineLolRun } from "../src/pipeline/collect/patch-calendar";
import { isMainModule } from "./shared/cli";
import { loadLolCalendar } from "./shared/calendar";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** GitHub Actions 출력 한 묶음. 로컬 실행(=GITHUB_OUTPUT 없음)에서는 stdout으로만 찍는다. */
function emit(values: Record<string, string>): void {
  const body = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `${body}\n`);
  console.log(`[lol-determine] ${body.replace(/\n/g, " ")}`);
}

/** Actions 로그에 접히지 않는 경고로 남긴다(로컬에서는 평문). */
function warn(message: string): void {
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `[warning] ${message}`);
}

function trimmed(name: string): string | undefined {
  const v = (process.env[name] ?? "").trim();
  return v.length > 0 ? v : undefined;
}

/**
 * 패치 ID 형식 — `scripts/shared/cli.ts`의 `type: "patch"`와 같은 규칙이다. 이 값은 argv가 아니라
 * `workflow_dispatch` 입력에서 env로 들어와 `parseCliArgs`를 거치지 않는데, 그대로 파일 경로
 * (`data/aggregated/{patch}/…`)에 꿰어지고 이 잡은 `RIOT_API_KEY`와 `contents: write`를 들고 있다
 * (security-auditor 2026-09-06·2026-09-17 지적과 같은 자리). 통과 못 하면 즉시 죽인다.
 */
const PATCH_ID_PATTERN = /^\d{2}\.\d{1,2}$/;

function checkedPatch(name: string): string | undefined {
  const value = trimmed(name);
  if (value !== undefined && !PATCH_ID_PATTERN.test(value)) {
    throw new Error(`${name}이 패치 ID 형식이 아니다(예 26.19): ${JSON.stringify(value)}`);
  }
  return value;
}

export function todayKst(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function main(): void {
  const dataRoot = trimmed("PATCHGAP_DATA_ROOT") ?? "data";
  const calendar = loadLolCalendar(dataRoot);
  const manualPatch = checkedPatch("MANUAL_PATCH");
  const manualFrom = checkedPatch("MANUAL_FROM");
  const manualTo = checkedPatch("MANUAL_TO");
  const force = trimmed("MANUAL_FORCE") === "true";
  const today = todayKst();

  // 산출물 존재 확인만 여기서 한다(파일 I/O) — 어떤 패치인지는 캘린더가 정한다.
  const probe = determineLolRun({ todayKst: today, calendar, hasOutputs: false, manualPatch, manualFrom, manualTo, force });
  const hasOutputs =
    probe.patch !== null &&
    fs.existsSync(path.join(process.cwd(), dataRoot, "aggregated", probe.patch, "summary.json"));

  const decision = determineLolRun({ todayKst: today, calendar, hasOutputs, manualPatch, manualFrom, manualTo, force });
  console.log(`[lol-determine] ${decision.reason}`);

  if (decision.staleCalendar) {
    // 초록불 침묵 경보 — LoL에만 이게 없어서, 캘린더가 마르면 매주 목요일 조용히 아무것도 안 했다.
    warn(
      `LoL 패치 캘린더가 낡았을 수 있다 — 마지막 등록 패치가 주기(14일)를 한참 넘겼다. ` +
        `data/patch-calendar/lol.json(감시자) 또는 PATCH_CALENDAR에 다음 패치를 추가하라. ` +
        `추가하지 않으면 이 워크플로는 계속 초록불로 스킵한다.`
    );
  }

  if (!decision.shouldRun || decision.from === null || decision.to === null) {
    emit({ should_run: "false" });
    return;
  }
  emit({ should_run: "true", patch: decision.patch ?? "", from: decision.from, to: decision.to });
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    console.error(`[lol-determine] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
