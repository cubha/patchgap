// scripts/tft-determine.ts
// `collect-tft.yml`의 determine 스텝 — "오늘 TFT를 수집할 것인가"를 한 번에 판정해
// GITHUB_OUTPUT으로 넘긴다.
//
// **왜 워크플로 안의 heredoc이 아닌 실파일인가.** `collect.yml`(LoL)은 임시 `.ts`를 heredoc으로
// 써서 실행하고 지운다. 그 방식은 **tsc·eslint·vitest 어느 게이트도 그 코드를 보지 못한다** —
// 수집 실행 여부를 정하는 코드가 검증 밖에 있는 셈이다. `scripts/**`는 tsconfig include 대상이라
// (CLAUDE.md §TypeScript 규칙) 실파일로 두면 타입 체크를 받고, 판정 규칙 자체는
// `determineTftRun`이 순수 함수로 들고 있어 단위 테스트로 고정된다.
//
// 이 파일이 하는 일은 **I/O뿐**이다 — 판정은 `tft-patch-calendar.ts`, 권한은 `tft-preflight.ts`.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { determineTftRun } from "../src/pipeline/collect/tft-patch-calendar";
import { loadTftWindows } from "./shared/calendar";
import { runTftPreflight } from "../src/pipeline/collect/tft-preflight";
import { isMainModule } from "./shared/cli";

/** GitHub Actions 출력 한 묶음. 로컬 실행(=GITHUB_OUTPUT 없음)에서는 stdout으로만 찍는다. */
function emit(values: Record<string, string>): void {
  const body = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `${body}\n`);
  console.log(`[tft-determine] ${body.replace(/\n/g, " ")}`);
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
 * 패치 ID 형식 — `scripts/shared/cli.ts`의 `type: "patch"`와 **같은 규칙**이다.
 *
 * 여기서 다시 검사하는 이유: 이 값은 argv가 아니라 `workflow_dispatch` 입력에서 env로 들어오므로
 * `parseCliArgs`를 거치지 않는다. 그런데 그대로 파일 경로(`deltas-{from}-{to}.json`)에 꿰어지고,
 * 이 잡은 `RIOT_API_KEY`와 `contents: write`를 들고 있다 — LoL 워크플로가 같은 이유로
 * security-auditor 지적을 받았다(2026-09-06·2026-09-17). 형식을 통과하지 못하면 즉시 죽인다.
 */
const PATCH_ID_PATTERN = /^\d{2}\.\d{1,2}$/;

function manualPatchOf(): string | undefined {
  const raw = trimmed("MANUAL_PATCH");
  if (raw === undefined) return undefined;
  if (!PATCH_ID_PATTERN.test(raw)) {
    throw new Error(`tft-determine: MANUAL_PATCH 형식이 올바르지 않다: "${raw}" (예: 18.2)`);
  }
  return raw;
}

export async function main(): Promise<void> {
  const dataRoot = trimmed("TFT_DATA_ROOT") ?? "data";
  const manualPatch = manualPatchOf();
  const force = trimmed("MANUAL_FORCE") === "true";
  const platform = trimmed("TFT_PLATFORM") ?? "kr";
  // **TFT 전용 키를 먼저 본다.** LoL 승인 키(RIOT_API_KEY)는 TFT 엔드포인트에 403이다
  // (2026-09-20 실측 — tft-preflight.ts 헤더 표). 폴백을 남기는 이유는 제품 승인 후
  // 키가 하나로 합쳐질 수 있어서다. 그때 403이면 프리플라이트가 그대로 알려 준다.
  const apiKey = trimmed("RIOT_TFT_API_KEY") ?? trimmed("RIOT_API_KEY");

  // ① 권한을 먼저 본다. 캘린더가 "돌아야 한다"고 해도 키가 죽어 있으면 수집 루프
  //    한가운데서 죽을 뿐이다 — 들어가기 전에 싼 호출 하나로 판별한다.
  if (!apiKey) {
    warn("RIOT_TFT_API_KEY·RIOT_API_KEY 둘 다 미설정 — TFT 수집을 건너뛴다.");
    emit({ should_run: "false" });
    return;
  }
  const preflight = await runTftPreflight({ apiKey, platform });
  if (!preflight.proceed) {
    if (preflight.fatal) {
      // 진짜 오류는 삼키지 않는다 — 조용히 스킵하면 "돌고 있다"는 착각을 만든다.
      throw new Error(preflight.message);
    }
    warn(preflight.message);
    emit({ should_run: "false" });
    return;
  }

  // ② 캘린더 판정. 산출물 존재 확인만 여기서 하고(파일 I/O) 규칙은 순수 함수가 갖는다.
  const nowMs = Date.now();
  const windows = loadTftWindows();
  const probe = determineTftRun({ nowMs, hasOutputs: false, manualPatch, force }, windows);
  const hasOutputs =
    probe.from !== null &&
    probe.to !== null &&
    fs.existsSync(path.join(dataRoot, "aggregated", "tft", `deltas-${probe.from}-${probe.to}.json`));

  const decision = determineTftRun({ nowMs, hasOutputs, manualPatch, force }, windows);
  console.log(`[tft-determine] ${decision.reason}`);

  if (decision.staleCalendar) {
    // 초록불 침묵 경보 — 이 조건이 뜨면 대개 다음 패치가 이미 나왔다는 뜻이다.
    warn(
      `TFT 패치 캘린더가 낡았을 수 있다: ${decision.patch} 창이 열려 있는데(endMs=null) ` +
        `산출물이 이미 있다. src/pipeline/collect/tft-patch-calendar.ts의 TFT_PATCH_WINDOWS에 ` +
        `다음 패치를 추가하라 — 추가하지 않으면 이 워크플로는 계속 초록불로 스킵한다.`
    );
  }

  if (!decision.shouldRun || decision.from === null || decision.to === null) {
    emit({ should_run: "false" });
    return;
  }
  emit({ should_run: "true", patch: decision.patch ?? "", from: decision.from, to: decision.to });
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[tft-determine] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
