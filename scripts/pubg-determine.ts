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

import { determinePubgRun } from "../src/pipeline/collect/pubg/patch-calendar";
import { isMainModule } from "./shared/cli";

function emit(values: Record<string, string>): void {
  const body = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `${body}\n`);
  console.log(`[pubg-determine] ${body.replace(/\n/g, " ")}`);
}

function warn(message: string): void {
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `[warning] ${message}`);
}

function trimmed(name: string): string | undefined {
  const v = (process.env[name] ?? "").trim();
  return v.length > 0 ? v : undefined;
}

export function main(): void {
  const dataRoot = trimmed("PUBG_DATA_ROOT") ?? "data";
  const force = trimmed("MANUAL_FORCE") === "true";

  if (!trimmed("PUBG_API_KEY")) {
    warn("PUBG_API_KEY 미설정 — PUBG 수집을 건너뛴다.");
    emit({ should_run: "false" });
    return;
  }

  // 산출물 존재 확인만 여기서 한다(파일 I/O) — 어떤 쌍인지는 캘린더가 정한다.
  const probe = determinePubgRun({ nowMs: Date.now(), outputsExist: false, force });
  const deltasFile = path.join(dataRoot, "aggregated", "pubg", "deltas.json");
  let outputsExist = false;
  if (probe.to !== null && fs.existsSync(deltasFile)) {
    // PUBG는 산출물이 `deltas.json` **하나**라 파일 존재만으로는 "이번 패치쌍을 돌았나"를
    // 알 수 없다(이전 쌍의 파일도 같은 이름이다). meta의 패치쌍을 보고 판단한다.
    try {
      const meta = (JSON.parse(fs.readFileSync(deltasFile, "utf8")) as { meta?: { from?: string; to?: string } }).meta;
      outputsExist = meta?.from === probe.from && meta?.to === probe.to;
    } catch {
      outputsExist = false;
    }
  }

  const decision = determinePubgRun({ nowMs: Date.now(), outputsExist, force });
  console.log(`[pubg-determine] ${decision.reason}`);

  if (decision.staleCalendar) {
    warn(
      `PUBG 패치 캘린더가 낡았을 수 있다: 마지막 항목(${decision.to})이 너무 오래됐다. ` +
        `src/pipeline/collect/pubg/patch-calendar.ts의 PUBG_PATCH_WINDOWS에 다음 패치를 추가하라 — ` +
        `추가하지 않으면 이 워크플로는 계속 초록불로 스킵한다.`
    );
  }

  if (!decision.shouldRun || decision.from === null || decision.to === null) {
    emit({ should_run: "false" });
    return;
  }
  // 수기 노트가 들어왔나 — 없으면 수집만 하고 집계는 보류한다(위 헤더 참고).
  const notesFile = path.join(dataRoot, "aggregated", "pubg", `notes-${decision.to}.json`);
  const notesReady = fs.existsSync(notesFile);
  if (!notesReady) {
    warn(
      `PUBG ${decision.to} 패치노트가 없다(${notesFile}). 텔레메트리는 336시간 안에만 받을 수 ` +
        `있으므로 **수집은 진행**하고 집계·판정·브리핑은 보류한다. 노트를 수기로 넣은 뒤 ` +
        `\`gh workflow run collect-pubg.yml -f force=true\`로 다시 돌린다.`
    );
  }

  emit({
    should_run: "true",
    notes_ready: notesReady ? "true" : "false",
    from: decision.from,
    to: decision.to,
    days: [...decision.before, ...decision.after].join(","),
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
