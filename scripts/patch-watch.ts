// scripts/patch-watch.ts
// 패치 감시자 — 새 패치가 나왔는지 보고, 나왔으면 **캘린더 오버레이에 한 줄 적는다**.
// 실행: npx tsx scripts/patch-watch.ts [--game lol|tft|pubg|all] [--dry-run] [--data-root DIR]
//
// **왜 수집 잡 밖에 있나(2026-09-21).** 이 스크립트는 저장소에 커밋을 만드는 유일한 자동화다.
// 오작동의 대가가 크므로 세 수집 경로와 물리적으로 분리한다 — 감시자가 틀려도 수집·판정·배포는
// 안 다치고, 롤백은 오버레이 파일을 비우는 것이다(TypeScript를 쓰지 않는 이유).
//
// **날짜는 추측하지 않는다.** 패치노트 페이지의 `datePublished`가 정확한 값을 준다. LoL만 한 겹
// 더 있다 — 그건 기사 발행 시각이라 KR 라이브일보다 하루 이를 수 있어 `lolLiveKstOf`를 거친다
// (커밋된 26.16·26.17·26.18 세 건을 전부 복원하는 것이 그 함수의 합격 기준이다).
//
// **PUBG는 마이너를 탐지할 수 없다.** 텔레메트리 라벨이 메이저까지만 담는다(`pc-2018-43`).
// 다른 둘처럼 생겼지만 성질이 다르고, 그 한계를 아래 로그가 매번 말한다.
import "dotenv/config";
import fs from "node:fs";

import { comparePatchId } from "../src/pipeline/collect/calendar-overlay";
import {
  extractDatePublished,
  lolLiveKstOf,
  nextPatchCandidates,
  pubgPatchOfSteamTitle,
  telemetryLabelFor,
} from "../src/pipeline/collect/patch-detect";
import { buildTftNotesUrl } from "./run-tft-notes";
import { appendOverlay, loadLolCalendar, loadPubgWindows, loadTftWindows } from "./shared/calendar";
import { aggregatedLatestOf } from "./shared/aggregated-latest";
import {
  latestPatchId,
  stalenessOf,
  stalenessTable,
  type GameStaleness,
} from "../src/pipeline/collect/staleness";
import { isMainModule, parseCliArgs } from "./shared/cli";

const UA = "Mozilla/5.0 (compatible; patchgap/1.0; +https://patchgap.vercel.app)";

/** PUBG 공지 피드 — appid 578080, 키 불필요. 아래 `watchPubg` 주석이 이 소스를 고른 이유를 적는다. */
const STEAM_NEWS =
  "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=578080&count=50&maxlength=1";

interface SteamNewsItem {
  readonly title?: string;
  /** unix seconds. */
  readonly date?: number;
}

function lolNotesUrl(patch: string, locale = "ko-kr"): string {
  return `https://www.leagueoflegends.com/${locale}/news/game-updates/league-of-legends-patch-${patch.replace(/\./g, "-")}-notes/`;
}

function log(message: string): void {
  console.log(`[patch-watch] ${message}`);
}

/** 발견을 Actions 로그에 접히지 않게 남긴다 — 커밋이 났다는 사실은 눈에 띄어야 한다. */
function notice(message: string): void {
  console.log(process.env.GITHUB_ACTIONS ? `::notice::${message}` : `[notice] ${message}`);
}


/** 후보 URL이 존재하면 그 페이지 HTML. 없으면 null. 200/404는 파싱할 것이 없다. */
async function fetchNotesIfPublished(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`patch-watch: ${url} → HTTP ${res.status}`);
  return await res.text();
}

interface Found {
  patch: string;
  iso: string;
}

/** 다음 후보 둘(마이너 +1 · 메이저 롤오버)을 차례로 두드린다. 먼저 잡히는 것이 답이다. */
async function findNext(
  last: string,
  urlOf: (patch: string) => string
): Promise<Found | null> {
  for (const candidate of nextPatchCandidates(last)) {
    const html = await fetchNotesIfPublished(urlOf(candidate));
    if (html === null) continue;
    const iso = extractDatePublished(html);
    if (iso === null) {
      // 페이지는 있는데 발행 시각을 못 읽었다 — **추측한 날짜를 캘린더에 넣지 않는다**.
      throw new Error(
        `patch-watch: ${candidate} 노트는 있는데 datePublished를 못 읽었다 — 마크업이 바뀌었을 수 있다`
      );
    }
    return { patch: candidate, iso };
  }
  return null;
}

async function watchLol(dataRoot: string, dryRun: boolean): Promise<boolean> {
  const calendar = loadLolCalendar(dataRoot);
  const last = Object.keys(calendar).sort((a, z) => {
    const [am, an] = a.split(".").map(Number);
    const [zm, zn] = z.split(".").map(Number);
    return am !== zm ? am - zm : an - zn;
  })[Object.keys(calendar).length - 1];
  const found = await findNext(last, lolNotesUrl);
  if (!found) {
    log(`lol: 마지막 등록 ${last} · 다음 패치 노트 없음`);
    return false;
  }
  const liveKst = lolLiveKstOf(found.iso);
  notice(`lol: 새 패치 ${found.patch} 발견 — 발행 ${found.iso} → liveKst ${liveKst}`);
  if (dryRun) return false;
  appendOverlay("lol", { [found.patch]: { liveKst } }, dataRoot);
  return true;
}

async function watchTft(dataRoot: string, dryRun: boolean): Promise<boolean> {
  const windows = loadTftWindows(dataRoot);
  const last = windows[windows.length - 1];
  const found = await findNext(last.patch, (p) => buildTftNotesUrl(p));
  if (!found) {
    log(`tft: 마지막 등록 ${last.patch} · 다음 패치 노트 없음`);
    return false;
  }
  const startMs = Date.parse(found.iso);
  notice(`tft: 새 패치 ${found.patch} 발견 — 발행 ${found.iso}`);
  if (dryRun) return false;
  appendOverlay("tft", { patch: found.patch, startMs, endMs: null }, dataRoot);
  return true;
}

/**
 * PUBG — **Steam 뉴스 피드**에서 패치노트 공지를 읽는다.
 *
 * **왜 Steam인가(2026-09-21 정정).** 한때 "PUBG는 탐지 원천 불가"로 적었는데 틀렸다. PUBG
 * 자체 표면만 뒤진 결과였다 — 매치 `attributes`에 패치 필드가 없고, `/status`는 버전을 안 주고,
 * 텔레메트리 라벨(`pc-2018-43`)은 **메이저까지만** 담고, 공지 사이트는 SPA라 없는 패치도 200을
 * 준다(`patch-notes-99-9`가 43-1과 동일 바이트). 그런데 PUBG는 Steam 게임이고, **공지를 내는
 * 곳은 Steam이다**. `ISteamNews/GetNewsForApp`은 키가 필요 없고 구조화 JSON을 준다.
 *
 * 날짜도 추측하지 않는다 — 항목 타임스탬프의 UTC 날짜가 캘린더 `liveFrom`과 정확히 일치한다
 * (역산 재현 실측: 42.3 → 2026-08-11, 43.1 → 2026-09-09, 2/2).
 *
 * 이제 **마이너도 탐지된다**(43.1 → 43.2). 라벨이 같아도 비교 구간은 날짜가 가르므로 성립한다.
 * 그래서 이 함수는 `PUBG_API_KEY`를 쓰지 않는다 — 탐지 경로에서 키가 사라졌다.
 */
async function watchPubg(dataRoot: string, dryRun: boolean): Promise<boolean> {
  const windows = loadPubgWindows(dataRoot);
  const last = windows[windows.length - 1];

  const res = await fetch(STEAM_NEWS, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    // **확인 못 함은 변화 없음이 아니다** — 조용히 false를 돌려주면 그 침묵이 초록불이 된다.
    throw new Error(`patch-watch: Steam 뉴스 피드 HTTP ${res.status} — PUBG를 확인하지 못했다`);
  }
  const body = (await res.json()) as { appnews?: { newsitems?: SteamNewsItem[] } };
  const items = body.appnews?.newsitems ?? [];
  const notes = items
    .map((n) => ({ patch: pubgPatchOfSteamTitle(n.title ?? ""), date: n.date ?? 0 }))
    .filter((n): n is { patch: string; date: number } => n.patch !== null)
    .sort((a, z) => z.date - a.date);

  if (notes.length === 0) {
    // 피드는 받았는데 패치노트가 한 건도 없다 — 제목 형식이 바뀌었을 가능성이 크다.
    // 조용히 넘기면 그날부터 영영 못 찾는다.
    throw new Error(
      `patch-watch: Steam 피드 ${items.length}건에서 「Patch Notes - Update X.Y」를 하나도 못 찾았다 — ` +
        "공지 제목 형식이 바뀌었을 수 있다"
    );
  }

  const newest = notes[0];
  if (comparePatchId(newest.patch, last.patch) <= 0) {
    log(`pubg: 최신 공지 ${newest.patch} · 마지막 등록 ${last.patch} — 변화 없음`);
    return false;
  }

  const liveFrom = new Date(newest.date * 1000).toISOString().slice(0, 10);
  const telemetryPatch = telemetryLabelFor(last.telemetryPatch, newest.patch);
  if (telemetryPatch === null) {
    throw new Error(
      `patch-watch: 직전 라벨 ${JSON.stringify(last.telemetryPatch)}에서 새 라벨을 만들 수 없다`
    );
  }
  notice(`pubg: 새 패치 ${newest.patch} 발견 — 공지 ${liveFrom} · 라벨 ${telemetryPatch}`);
  if (dryRun) return false;
  appendOverlay("pubg", { patch: newest.patch, telemetryPatch, liveFrom }, dataRoot);
  return true;
}

/**
 * 캘린더 최신 ↔ 집계 최신 격차를 실행 요약에 적는다.
 *
 * 캘린더는 **기준 + 오버레이 병합본**을 쓴다(`shared/calendar.ts`). 오버레이만 읽으면 LoL은
 * `lol.json`이 `[]`라 "아는 패치 없음"으로 읽히고, 정작 26.19는 코드의 `PATCH_CALENDAR`에
 * 있으므로 **조용히 통과**한다 — 병합 로더가 존재하는 이유가 그것이다.
 */
function reportStaleness(dataRoot: string): void {
  const rows: GameStaleness[] = [
    stalenessOf("lol", latestPatchId(Object.keys(loadLolCalendar(dataRoot))), aggregatedLatestOf("lol", dataRoot)),
    stalenessOf("tft", latestPatchId(loadTftWindows(dataRoot).map((w) => w.patch)), aggregatedLatestOf("tft", dataRoot)),
    stalenessOf("pubg", latestPatchId(loadPubgWindows(dataRoot).map((w) => w.patch)), aggregatedLatestOf("pubg", dataRoot)),
  ];
  const table = stalenessTable(rows);
  for (const line of table.split("\n")) log(line);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    fs.appendFileSync(summary, `### 패치 수집 격차\n\n${table}\n\n`);
  }
  for (const r of rows.filter((x) => x.behind)) {
    notice(`${r.game}: ${r.aggregatedLatest ?? "없음"} → ${r.calendarLatest} 미수집 — 수집 워크플로 요약에서 사유를 본다.`);
  }
}

async function main(): Promise<void> {
  const args = parseCliArgs("patch-watch", process.argv.slice(2), [
    { name: "game", type: "string", default: "all" },
    { name: "dataRoot", type: "string", default: "data" },
    { name: "dryRun", type: "boolean" },
  ]);
  const game = String(args.game);
  const dataRoot = String(args.dataRoot);
  const dryRun = args.dryRun === true;
  if (!["all", "lol", "tft", "pubg"].includes(game)) {
    throw new Error(`patch-watch: --game은 all|lol|tft|pubg 중 하나여야 한다(받음: ${game})`);
  }

  let changed = false;
  // 한 게임이 실패해도 나머지는 본다 — 감시자의 실패 모드는 침묵이라 부분 성공이 전무보다 낫다.
  const failures: string[] = [];
  const run = async (name: string, fn: () => Promise<boolean>): Promise<void> => {
    if (game !== "all" && game !== name) return;
    try {
      changed = (await fn()) || changed;
    } catch (error: unknown) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  await run("lol", () => watchLol(dataRoot, dryRun));
  await run("tft", () => watchTft(dataRoot, dryRun));
  await run("pubg", () => watchPubg(dataRoot, dryRun));

  // **격차 보고 — 합불을 판정하지 않는다.** 감시자는 키가 없어 "왜 못 받았는지"를 알 수 없고
  // (403인지 401인지는 수집 워크플로만 본다), 임계값("N일 밀리면 실패")은 정직하게 고를 수
  // 없다 — 심사가 몇 주면 매일 빨간불이 되고 그 알림은 곧 무시된다. 그래서 **매일 같은 자리에
  // 숫자만** 적는다. 이유는 `determine-report.ts`의 `SkipReason`이 수집 쪽 요약에 적는다.
  reportStaleness(dataRoot);

  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    const fs = await import("node:fs");
    fs.appendFileSync(out, `changed=${changed ? "true" : "false"}\n`);
  }
  log(`changed=${changed}`);
  if (failures.length > 0) {
    throw new Error(`patch-watch: ${failures.length}개 게임 실패 —\n  ${failures.join("\n  ")}`);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[patch-watch] 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
