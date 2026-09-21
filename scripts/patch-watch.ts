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

import { PubgApi, telemetryUrlOf } from "../src/pipeline/collect/pubg/api";
import { parseMatchDefinition } from "../src/pipeline/collect/pubg/telemetry-reduce";
import {
  extractDatePublished,
  kstDateOf,
  lolLiveKstOf,
  nextPatchCandidates,
  pubgPatchOfLabel,
  telemetryMajor,
} from "../src/pipeline/collect/patch-detect";
import { buildTftNotesUrl } from "./run-tft-notes";
import { appendOverlay, loadLolCalendar, loadPubgWindows, loadTftWindows } from "./shared/calendar";
import { isMainModule, parseCliArgs } from "./shared/cli";

const UA = "Mozilla/5.0 (compatible; patchgap/1.0; +https://patchgap.vercel.app)";

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

function warn(message: string): void {
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `[warning] ${message}`);
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
 * PUBG — 샘플 매치 1건의 텔레메트리에서 라벨을 읽는다. **메이저 상승만** 탐지된다.
 *
 * `liveFrom`은 "그 라벨을 처음 본 날"이다. 다른 둘과 달리 정확한 발행 시각을 주는 문서가 없다
 * (공지에 구조화 마크업이 없어 파서가 없는 것과 같은 이유). 감시자가 매일 돌므로 오차는
 * 하루 이내지만, 이 값은 비교 구간(`patch-5 … patch+6`)을 직접 정하므로 커밋 diff에서
 * 한 번 눈으로 보는 것이 좋다.
 */
async function watchPubg(dataRoot: string, dryRun: boolean): Promise<boolean> {
  const apiKey = (process.env.PUBG_API_KEY ?? "").trim();
  if (!apiKey) {
    // 경고로 남긴다 — 키가 없으면 PUBG는 **영원히** 새 패치를 못 찾는데, 로그 한 줄로 끝내면
    // 그 사실이 초록불 뒤에 숨는다(이 저장소가 PUBG 수집에서 이미 겪은 실패 모드다).
    warn("pubg: PUBG_API_KEY 미설정 — PUBG는 새 패치를 탐지할 수 없다");
    return false;
  }
  const windows = loadPubgWindows(dataRoot);
  const last = windows[windows.length - 1];
  const lastMajor = telemetryMajor(last.telemetryPatch);

  const api = new PubgApi({ apiKey });
  const today = kstDateOf(new Date().toISOString());
  const ids = await api.sampleMatchIds(new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  // **표본을 못 받은 것과 "변화 없음"은 다르다.** `PubgApi.request`는 재시도를 소진하면 조용히
  // null을 돌려주므로(키 오류·쿼터·장애가 전부 같은 모양이다) 여기서 갈라 주지 않으면
  // "확인하지 못했다"가 "새 패치 없다"로 읽힌다 — 실측으로 밟았다(2026-09-21: 시크릿이 잘못
  // 등록돼 CI에서만 표본이 0건이었는데 로그는 「판단 보류」 한 줄이었고 잡은 초록이었다).
  if (ids.length === 0) {
    throw new Error(
      "patch-watch: pubg 표본을 받지 못했다(/samples 응답 없음) — PUBG_API_KEY·쿼터·API 상태를 확인하라. " +
        "이것은 '새 패치 없음'이 아니라 '확인하지 못함'이다"
    );
  }
  for (const id of ids.slice(0, 5)) {
    const match = await api.match(id);
    if (!match) continue;
    const url = telemetryUrlOf(match);
    if (!url) continue;
    const events = await api.telemetry(url);
    if (!events) continue;
    const def = events.find((e) => (e as Record<string, unknown>)["_T"] === "LogMatchDefinition");
    const field = def ? String((def as Record<string, unknown>)["MatchId"] ?? "") : "";
    const label = field ? parseMatchDefinition(field)?.patch : undefined;
    if (!label) continue;
    const major = telemetryMajor(label);
    if (major === null || lastMajor === null || major <= lastMajor) {
      log(`pubg: 라벨 ${label}(메이저 ${major}) · 마지막 등록 ${last.patch}(${last.telemetryPatch}) — 변화 없음`);
      log("pubg: 마이너 패치(43.1 → 43.2)는 텔레메트리가 구분하지 않아 탐지 대상이 아니다");
      return false;
    }
    const patch = pubgPatchOfLabel(label);
    if (!patch) return false;
    notice(`pubg: 새 메이저 ${patch} 발견 — 라벨 ${label} · liveFrom ${today}(처음 본 날)`);
    if (dryRun) return false;
    appendOverlay("pubg", { patch, telemetryPatch: label, liveFrom: today }, dataRoot);
    return true;
  }
  // 표본은 받았는데 다섯 건 전부 라벨을 못 읽었다 — 텔레메트리 CDN 일시 오류 쪽이다.
  // 이건 던지지 않는다(하루치 실패로 감시자를 빨갛게 만들면 진짜 실패가 묻힌다). 다만
  // 위 "표본 0건"과 달리 **경고로** 남겨 연속으로 뜨는지 보이게 한다.
  warn("pubg: 표본 5건에서 텔레메트리 라벨을 읽지 못했다 — 이번 실행은 판단 보류(연속되면 조사하라)");
  return false;
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
