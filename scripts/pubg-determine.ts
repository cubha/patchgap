// scripts/pubg-determine.ts
// `collect-pubg.yml`의 determine 스텝 — "오늘 PUBG를 수집할 것인가"를 판정해 GITHUB_OUTPUT으로 넘긴다.
// `tft-determine.ts`와 같은 자리·같은 규약이다(실파일이라 tsc·eslint가 본다).
//
// 이 파일이 하는 일은 **I/O뿐**이다 — 판정 규칙은 `collect/pubg/patch-calendar.ts`의 순수 함수가
// 들고 있고 단위 테스트가 그것을 고정한다.
//
// **패치노트는 사람이 넣는다.** PUBG 공지에는 LoL·TFT 같은 구조화 마크업이 없어 파서가 없고,
// `data/aggregated/pubg/notes-{to}.json`은 수기 입력이다(그 파일의 `meta.authoring`이 그 사실을
// 적고 있다). 그래서 이 스텝은 판정을 **둘로 나눈다**:
//   should_run    — 수집(텔레메트리 축약). 336시간 창이 닫히면 **영영 못 받으므로** 노트를
//                   기다리지 않는다.
//   notes_ready   — 집계·판정·브리핑. 노트가 들어와 있을 때만 돈다.
// 수집만 돌고 집계가 보류되면 축약본은 Actions 캐시에 남는다(매치당 3KB라 1,200건이 4MB다).
//
// **PUBG에는 프리플라이트가 없다.** TFT는 키가 24시간마다 만료되고 제품 승인이 걸려 있어 싼 호출
// 하나로 "오늘 돌 수 있나"를 먼저 물었지만, PUBG 키는 만료가 없고 제품 승인 개념도 없다. 대신
// **보존창**이 그 자리를 대신한다 — 창을 넘겼으면 돌아도 빈손이므로 캘린더가 미리 막는다.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { planPubgRun } from "../src/pipeline/collect/pubg/patch-calendar";
import { deltasStateOf } from "../src/pipeline/shared/observation-stub";
import { loadPubgWindows } from "./shared/calendar";
import { isMainModule } from "./shared/cli";
import { reportDeclaration, reportRun, reportSkip, warn, type SkipReason } from "./shared/determine-report";

function trimmed(name: string): string | undefined {
  const v = (process.env[name] ?? "").trim();
  return v.length > 0 ? v : undefined;
}

/**
 * 판정(2026-09-28, C13·C14): 관측(수확 창 규칙 그대로)은 `planPubgRun`이 정하고, 그 앞단에 **선언 축**을
 * 얹는다 — 수기 노트가 들어와 있고 이 쌍의 산출물이 없으면 **즉시** 관측 stub을 쓴다. 전에는 비교 구간이
 * 닫힐 때(패치+7일)까지 실행 전체가 스킵돼 노트가 일주일간 화면에 안 나왔다(결정 8 위반).
 * stub은 산출물로 치지 않는다 — 쌍이 같은 stub이 수확을 영원히 막으면 초록불로 멈춘다.
 */
export function main(): void {
  const dataRoot = trimmed("PUBG_DATA_ROOT") ?? "data";
  const force = trimmed("MANUAL_FORCE") === "true";
  const hasKey = trimmed("PUBG_API_KEY") !== undefined;

  // 캘린더도 **같은 dataRoot**에서 읽는다 — 산출물만 옮기고 캘린더는 기본 경로에서 읽으면
  // 테스트·모사에서 두 쪽이 다른 세계를 본다.
  const windows = loadPubgWindows(dataRoot);
  const nowMs = Date.now();
  const probe = planPubgRun({ nowMs, notesExist: false, deltas: { kind: "none" }, force }, windows);
  const dir = path.join(dataRoot, "aggregated", "pubg");
  const notesExist = probe.to !== null && fs.existsSync(path.join(dir, `notes-${probe.to}.json`));
  // PUBG는 산출물이 `deltas.json` **하나**라 파일 존재만으로는 "이번 쌍을 돌았나"를 알 수 없다 —
  // meta 쌍을 보고, stub이면 산출물이 아니다(`deltasStateOf`).
  const deltasFile = path.join(dir, "deltas.json");
  let parsed: unknown = null;
  try {
    parsed = fs.existsSync(deltasFile) ? (JSON.parse(fs.readFileSync(deltasFile, "utf8")) as unknown) : null;
  } catch {
    parsed = null;
  }
  const deltas = probe.from !== null && probe.to !== null ? deltasStateOf(parsed, probe.from, probe.to) : { kind: "none" as const };
  let plan = planPubgRun({ nowMs, notesExist, deltas, force }, windows);
  console.log(`[pubg-determine] ${plan.reason}`);

  if (plan.staleCalendar) {
    warn(
      `PUBG 패치 캘린더가 낡았을 수 있다: 마지막 항목(${plan.to})이 너무 오래됐다. ` +
        `감시자(patch-watch.yml)가 다음 패치를 탐지했는지 확인하라 — 안 됐으면 이 워크플로는 계속 초록불로 스킵한다.`
    );
  }

  // 키는 관측에만 필요하다. 없으면 선언으로 강등(노트가 있고 산출물이 없을 때만).
  let keyIssue: SkipReason | undefined;
  if (plan.mode === "observation" && !hasKey) {
    keyIssue = "key-missing";
    plan =
      deltas.kind === "none" && notesExist
        ? { ...plan, mode: "declaration", reason: `${plan.reason} — PUBG_API_KEY가 없어 관측은 못 한다` }
        : { ...plan, mode: "skip" };
  }

  if (plan.mode === "skip" || plan.from === null || plan.to === null) {
    reportSkip("pubg", keyIssue ?? "no-run-condition", plan.reason);
    return;
  }
  if (plan.mode === "declaration") {
    // 보존창을 넘긴 쌍이면 관측은 영영 불가다 — stub 사유가 그 사실을 말한다.
    reportDeclaration(
      "pubg",
      { from: plan.from, to: plan.to },
      keyIssue ?? (plan.windowLost ? "window-lost" : "awaiting-observation"),
      plan.reason,
      keyIssue
    );
    return;
  }
  // 수기 노트가 들어왔나 — 없으면 수집만 하고 집계는 보류한다(위 헤더 참고).
  if (!plan.notesReady) {
    warn(
      `PUBG ${plan.to} 패치노트가 없다(notes-${plan.to}.json). 텔레메트리는 336시간 안에만 받을 수 ` +
        `있으므로 **수집은 진행**하고 집계·판정·브리핑은 보류한다. 노트를 수기로 넣은 뒤 ` +
        `\`gh workflow run collect-pubg.yml -f force=true\`로 다시 돌린다.`
    );
  }
  reportRun("pubg", {
    notes_ready: plan.notesReady ? "true" : "false",
    from: plan.from,
    to: plan.to,
    // 텔레메트리 라벨(`pc-2018-43`)도 내보낸다 — 워크플로의 표본 가드가 이 값으로 센다.
    // 워크플로에 박아 두면 다음 패치에서 그 한 줄만 갱신을 놓쳐 표본이 조용히 0으로 세어진다.
    telemetry_from: plan.telemetryFrom ?? "",
    telemetry_to: plan.telemetryTo ?? "",
    days: [...plan.before, ...plan.after].join(","),
  });
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    console.error(`[pubg-determine] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
