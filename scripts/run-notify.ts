// scripts/run-notify.ts
// F6 파이프라인 진입점 — dotenv 로드 후 deltas 파일을 읽어 디스코드 웹훅 브리핑을 전송한다.
// 실행: npm run pipeline:notify -- --from 26.16 --to 26.17 [--top 5] [--site https://…] [--dry-run]

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA_ROOT, aggregatedDir, deltasFile, notesFile } from "../src/pipeline/shared/paths";
import { buildBriefingEmbeds, sendWebhook, type DiscordEmbed } from "../src/pipeline/discord/webhook";
import { buildPubgBriefingEmbeds, type PubgBriefingSourceFile } from "../src/pipeline/discord/pubg-briefing";
import { isNotifyGameId, mentionPayload, resolveDiscordTarget, type NotifyGameId } from "../src/pipeline/discord/targets";
import { countRelevantNoteEntities } from "../src/pipeline/shared/notes-count";
import type { DeltasFile, PatchId, PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

/** `src/pipeline/shared/notes-count.ts`(ST-11 `home/logic.ts`의 `countRelevantNoteEntities`와
 * 동일 규칙을 공용화, 2026-09-05 리팩토링)의 별칭 — 기존 export 이름을 그대로 유지한다(테스트가
 * `countEntityNotes`로 import함). */
export const countEntityNotes = countRelevantNoteEntities;

/** 확정된 프로덕션 도메인(2026-09-09 Vercel 배포). 자리표시가 아니라 실제 배포처이므로
 * `--site` 미지정 시에도 브리핑 embed 링크가 정상 동작한다. 도메인이 바뀌면 이 상수와
 * GH Actions Variable `PATCHGAP_SITE_URL`을 **함께** 갱신한다 — 한쪽만 바꾸면 로컬 실행과
 * 워크플로 실행이 서로 다른 도메인을 가리킨다. */
const DEFAULT_SITE_URL = "https://patchgap.vercel.app";

export interface RunNotifyArgs {
  from: PatchId;
  to: PatchId;
  top: number;
  site: string;
  dryRun: boolean;
  /** 어느 게임 채널로 보낼지. 웹훅 URL이 채널에 묶여 있어 이 값이 곧 채널 선택이다. */
  game: NotifyGameId;
}

export function parseArgs(argv: string[]): RunNotifyArgs {
  const raw = parseCliArgs("run-notify", argv, [
    { name: "from", type: "patch", required: true },
    { name: "to", type: "patch", required: true },
    { name: "top", type: "number", default: 5 },
    { name: "site", type: "string", default: DEFAULT_SITE_URL },
    { name: "dryRun", type: "boolean", default: false },
    { name: "game", type: "string", default: "lol" },
  ]);

  const top = raw.top as number;
  const site = raw.site as string;

  if (top <= 0) {
    throw new Error(`run-notify: --top 값이 올바르지 않습니다: ${String(top)}`);
  }
  // 기본값(DEFAULT_SITE_URL)은 항상 이 검사를 통과하므로 --site 미지정 시엔 영향 없다 —
  // 사용자가 명시적으로 넘긴 값만 걸러낸다(코디네이터 후속 지시, 2026-09-05).
  if (site.trim().length === 0) {
    throw new Error("run-notify: --site 값이 비어 있습니다");
  }
  if (!/^https?:\/\//i.test(site)) {
    throw new Error(`run-notify: --site 값은 http(s):// 스킴이 필요합니다: "${site}"`);
  }

  const game = String(raw.game);
  if (!isNotifyGameId(game)) {
    throw new Error(`run-notify: 알 수 없는 --game "${game}" (lol|pubg|tft)`);
  }

  return { from: raw.from as string, to: raw.to as string, top, site, dryRun: raw.dryRun as boolean, game };
}

/**
 * `DISCORD_WEBHOOK_URL` 하나만 검증하는 소형 스키마 — `src/pipeline/shared/env.ts`(ST-01 소유)의
 * `loadEnv()`는 `RIOT_API_KEY`를 필수로 요구해 "디스코드 알림만 보내고 싶다"는 이 스크립트의
 * 실전 전송 분기에 불필요한 결합을 만든다(코디네이터 후속 지시, 2026-09-05 — `--dry-run`이
 * `RIOT_API_KEY` 없이는 아예 실행되지 않던 결함 수정). `loadEnv()`를 호출하지 않는다.
 */
const discordWebhookEnvSchema = z.object({
  DISCORD_WEBHOOK_URL: z.string().min(1, "DISCORD_WEBHOOK_URL is required"),
});

/**
 * 실전 전송 직전(dry-run이 아닐 때)에만 호출한다 — `--dry-run`은 이 함수를 아예 호출하지 않으므로
 * `RIOT_API_KEY`는 물론 `DISCORD_WEBHOOK_URL`도 없이 동작한다. `source` 기본값은 `process.env`지만
 * 테스트는 임의 객체를 주입해 실제 프로세스 환경변수를 건드리지 않는다(`loadEnv({...})` 테스트
 * 주입 패턴과 동일, `src/pipeline/shared/__tests__/env.test.ts` 참고).
 */
export function loadDiscordWebhookUrl(source: Partial<NodeJS.ProcessEnv> = process.env): string {
  const parsed = discordWebhookEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error("run-notify: DISCORD_WEBHOOK_URL 미설정 — .env에 값을 채우거나 --dry-run으로 실행");
  }
  return parsed.data.DISCORD_WEBHOOK_URL;
}

/** data/aggregated/deltas/{from}_{to}.json 로드 — 없으면 run-match.ts 실행을 안내하는 에러로
 * 즉시 실패한다(delta.ts loadAggregatedPatch와 동일한 "애매하게 죽지 않기" 원칙). `dataRoot`는
 * 테스트 격리용 오버라이드(기본 DATA_ROOT) — `shared/paths.ts`의 `deltasFile` 헬퍼가 이제
 * dataRoot를 직접 받으므로(2026-09-05 리팩토링) 경로를 로컬로 재조립하지 않는다. */
export function loadDeltasFile(from: PatchId, to: PatchId, dataRoot: string = DATA_ROOT): DeltasFile {
  const file = deltasFile(from, to, dataRoot);
  if (!fs.existsSync(file)) {
    throw new Error(
      `run-notify: ${file} 없음 — 먼저 실행: npx tsx scripts/run-match.ts --from ${from} --to ${to}`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as DeltasFile;
}

/**
 * notes/{patch}.json에서 "패치노트가 언급한 고유 엔티티 수"를 센다(헤드라인 "패치노트는 N개
 * 엔티티를 말했고"용, `countEntityNotes` 참고). **`meta.itemCount`(전체 노트 줄 수, system/other
 * 포함)를 그대로 쓰지 않는다** — ST-11 `countRelevantNoteEntities`와 동일 규칙(코디네이터 후속
 * 지시로 통일, 2026-09-05). 파일이 없으면 null — buildBriefingEmbeds가 이 구간을 생략하고 계속
 * 진행한다(무근거로 지어내지 않음). 파일은 있지만 항목이 없거나 champion/item 항목이 0건이면
 * 0(유효한 실측값). `dataRoot`는 `loadDeltasFile`과 동일한 테스트 격리용 오버라이드.
 */
export function loadNoteCount(patch: PatchId, dataRoot: string = DATA_ROOT): number | null {
  const file = notesFile(patch, dataRoot);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { items?: PatchNoteItem[] };
  return countEntityNotes(parsed.items ?? []);
}

/** aggregated/{patch}/summary.json에서 매치 수를 읽는다(footer "n={nFrom}/{nTo}"용). 파일이
 * 없으면 null. `dataRoot`는 위와 동일한 테스트 격리용 오버라이드. */
export function loadMatchCount(patch: PatchId, dataRoot: string = DATA_ROOT): number | null {
  const file = path.join(aggregatedDir(patch, dataRoot), "summary.json");
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: { matches?: number } };
  return typeof parsed.data?.matches === "number" ? parsed.data.matches : null;
}

/**
 * 게임별 브리핑 소스. **반환값은 데이터가 아니라 "임베드를 만드는 방법"이다** — 게임마다
 * 행 타입이 달라서다(PUBG는 `DeltaRecord`가 아니라 `relChange`/`relCi`를 가진 자체 행이고
 * 유의성은 `classify()`가 이미 status에 접어넣었다). 데이터만 돌려주고 호출부에서 빌더를
 * 고르게 하면 그 분기가 전송 흐름 한가운데 생기고, 게임이 늘 때마다 거기가 또 갈라진다.
 *
 * 문구·예산·필드 상한은 세 게임이 공유한다 — `discord/webhook.ts`의 `assembleBriefing`이
 * 그것을 소유하고, 여기서 갈리는 것은 **어떤 행을 고르고 어떻게 한 줄로 쓰는가**뿐이다.
 */
interface GameBriefingSource {
  buildEmbeds(options: { siteUrl: string; topN: number }): DiscordEmbed[];
}

function loadGameSource(
  game: NotifyGameId,
  from: PatchId,
  to: PatchId,
  dataRoot: string
): GameBriefingSource {
  if (game === "lol") {
    const deltas = loadDeltasFile(from, to, dataRoot);
    const noteCount = loadNoteCount(to, dataRoot);
    const matchCounts = { from: loadMatchCount(from, dataRoot), to: loadMatchCount(to, dataRoot) };
    return { buildEmbeds: (o) => buildBriefingEmbeds(deltas, { ...o, noteCount, matchCounts }) };
  }

  if (game === "tft") {
    // TFT 산출물도 `DeltaRecord`라 LoL 빌더를 그대로 쓴다 — `buildBriefingEmbeds`가 meta에서
    // 읽는 것은 `from`·`to`·`qAlpha`·`generatedAt` 넷뿐이고 TFT에도 전부 있다.
    const file = path.join(dataRoot, "aggregated", "tft", `deltas-${from}-${to}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(`run-notify: ${file} 없음 — 먼저 실행: npm run pipeline:tft-match -- --from ${from} --to ${to}`);
    }
    const deltas = JSON.parse(fs.readFileSync(file, "utf8")) as DeltasFile & {
      meta: { noteCount?: number; matches?: { before?: number; after?: number } };
    };
    const noteCount = typeof deltas.meta.noteCount === "number" ? deltas.meta.noteCount : null;
    const matchCounts = { from: deltas.meta.matches?.before ?? null, to: deltas.meta.matches?.after ?? null };
    return { buildEmbeds: (o) => buildBriefingEmbeds(deltas, { ...o, noteCount, matchCounts }) };
  }

  // ── PUBG ────────────────────────────────────────────────────────────────────
  // 산출물이 **패치쌍별 파일이 아니라 `deltas.json` 하나**다(파이프라인이 한 쌍만 만든다).
  // 그래서 `--from/--to`가 파일 안의 쌍과 다르면 **조용히 낡은 브리핑을 보내게 된다** —
  // 그 침묵이 정확히 이 스크립트가 피해야 하는 실패다(CI가 매주 같은 걸 재전송하는 형태로
  // 나타난다). 일치하지 않으면 보내지 않고 즉시 죽는다.
  const file = path.join(dataRoot, "aggregated", "pubg", "deltas.json");
  if (!fs.existsSync(file)) {
    throw new Error(`run-notify: ${file} 없음 — PUBG 집계·판정 산출물이 없다`);
  }
  const deltas = JSON.parse(fs.readFileSync(file, "utf8")) as PubgBriefingSourceFile;
  if (deltas.meta.from !== from || deltas.meta.to !== to) {
    throw new Error(
      `run-notify: PUBG 산출물은 ${deltas.meta.from} → ${deltas.meta.to}인데 --from ${from} --to ${to}가 들어왔다. ` +
        `낡은 브리핑을 보내지 않으려고 중단한다 — 인자를 맞추거나 파이프라인을 다시 돌린다.`
    );
  }
  const notesFile = path.join(dataRoot, "aggregated", "pubg", `notes-${to}.json`);
  const noteCount = fs.existsSync(notesFile)
    ? new Set(
        (JSON.parse(fs.readFileSync(notesFile, "utf8")) as { items?: { weaponKeys?: string[] }[] }).items?.flatMap(
          (i) => i.weaponKeys ?? []
        ) ?? []
      ).size
    : null;
  const matchCounts = {
    from: loadPubgMatchCount(from, dataRoot),
    to: loadPubgMatchCount(to, dataRoot),
  };
  return { buildEmbeds: (o) => buildPubgBriefingEmbeds(deltas, { ...o, noteCount, matchCounts }) };
}

/** PUBG footer "n=/"용 매치 수 — `weapons-{patch}.json`의 `nMatches`. 없으면 null(지어내지 않음). */
function loadPubgMatchCount(patch: PatchId, dataRoot: string): number | null {
  const file = path.join(dataRoot, "aggregated", "pubg", `weapons-${patch}.json`);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { nMatches?: number };
  return typeof parsed.nMatches === "number" ? parsed.nMatches : null;
}

/**
 * 전송 결과 로그. 웹훅 URL은 절대 담지 않는다.
 * **게임별로 갈라 둔다** — 안 그러면 TFT 18.1→18.2 로그가 LoL의 `aggregated/deltas/`에 떨어져
 * 그 폴더가 LoL 산출물이라는 전제가 조용히 깨진다(실측으로 한 번 그렇게 떨어뜨렸다).
 */
function notifyLogFile(game: NotifyGameId, from: PatchId, to: PatchId, dataRoot: string): string {
  const dir = game === "lol" ? ["aggregated", "deltas"] : ["aggregated", game];
  return path.join(dataRoot, ...dir, `${from}_${to}.notify.json`);
}

interface NotifyLog {
  /** 어느 게임 채널로 갔나. 로그만 보고 채널을 역추적할 수 있어야 한다. */
  game: NotifyGameId;
  from: PatchId;
  to: PatchId;
  sentAt: string;
  status: number;
  retries: number;
}

function writeNotifyLog(log: NotifyLog, dataRoot: string): string {
  const file = notifyLogFile(log.game, log.from, log.to, dataRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return file;
}

/** 디스코드가 실제로 세는 방식(title+description+footer.text+Σ(name+value))으로 embed 본문
 * 문자수를 계산한다 — `JSON.stringify(embeds).length`는 따옴표·콤마·이스케이프까지 포함해
 * 부풀려진 숫자라 6,000자 상한과 직접 비교할 수 없다(로그 확인용 숫자가 실제 제한과 다른 값이면
 * 오해를 부른다). */
function countEmbedChars(embeds: readonly DiscordEmbed[]): number {
  return embeds.reduce(
    (sum, e) =>
      sum +
      e.title.length +
      e.description.length +
      e.footer.text.length +
      e.fields.reduce((fieldSum, f) => fieldSum + f.name.length + f.value.length, 0),
    0
  );
}

export interface RunNotifyDeps {
  /** sendWebhook에 그대로 전달 — 테스트 주입용(기본 전역 fetch). */
  fetchImpl?: typeof fetch;
  /** DISCORD_WEBHOOK_URL 조회 소스 — 테스트 주입용(기본 process.env). dry-run이면 아예 읽지 않는다. */
  env?: Partial<NodeJS.ProcessEnv>;
  /** data/ 루트 오버라이드 — 테스트 격리용 임시 디렉토리(기본 DATA_ROOT). */
  dataRoot?: string;
}

export interface RunNotifyResult {
  dryRun: boolean;
  embeds: DiscordEmbed[];
  /** dry-run이면 undefined(전송 자체를 안 함). */
  send?: { status: number; retries: number; logFile: string };
}

/**
 * `main()`의 핵심 로직 — CLI 인자 파싱(`process.argv`)·`main()` 자체의 콘솔 헤더 로그와 분리해
 * 순수 입력(`args`)과 주입 가능한 의존성(`deps`)만으로 동작하게 한다(코디네이터 후속 지시,
 * 2026-09-05 — 전송 성공 경로가 한 번도 테스트되지 않은 문제 해결). dry-run 분기는 `deps.env`를
 * 전혀 읽지 않는다 — 위 `loadDiscordWebhookUrl` 관련 지시와 함께, `--dry-run`이 어떤 환경변수도
 * 없이 동작함을 이 함수 구조 자체가 보장한다.
 */
export async function runNotify(args: RunNotifyArgs, deps: RunNotifyDeps = {}): Promise<RunNotifyResult> {
  const dataRoot = deps.dataRoot ?? DATA_ROOT;
  const source = loadGameSource(args.game, args.from, args.to, dataRoot);
  const embeds = source.buildEmbeds({ siteUrl: args.site, topN: args.top });
  const payload = { username: "patchgap", embeds };

  console.log(
    `[run-notify] embeds=${embeds.length} fields=${embeds[0]?.fields.length ?? 0} (본문 ${countEmbedChars(embeds)}/6000자)`
  );

  if (args.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    // 어느 채널로 갈지는 **게임 이름만** 찍는다. 대상 해석(resolveDiscordTarget)은 환경변수를
    // 읽으므로 여기서 부르면 "--dry-run은 어떤 환경변수도 없이 동작한다"는 이 분기의 보장이
    // 깨진다. 게임은 CLI 인자라 env 없이 알 수 있고, 채널 오발송을 막는 데는 그것으로 충분하다.
    console.log(`[run-notify] --dry-run — 전송 생략 (대상 게임: ${args.game})`);
    return { dryRun: true, embeds };
  }

  const target = resolveDiscordTarget(args.game, deps.env ?? process.env);
  // 역할 멘션은 `allowed_mentions`와 짝이어야 실제 핑이 간다(targets.ts 헤더 참고).
  const sent = { ...payload, ...mentionPayload(target) };
  console.log(`[run-notify] 대상: ${args.game} 채널${target.roleId ? ` · 역할 멘션 <@&${target.roleId}>` : " · 멘션 없음"}`);
  const result = await sendWebhook(target.webhookUrl, sent, deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : undefined);
  const logFile = writeNotifyLog(
    {
      game: args.game,
      from: args.from,
      to: args.to,
      sentAt: new Date().toISOString(),
      status: result.status,
      retries: result.retries,
    },
    dataRoot
  );
  console.log(`[run-notify] 전송 완료 status=${result.status} retries=${result.retries} → ${logFile}`);
  return { dryRun: false, embeds, send: { status: result.status, retries: result.retries, logFile } };
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[run-notify] from=${args.from} to=${args.to} top=${args.top} site=${args.site} dryRun=${args.dryRun}`);
  await runNotify(args);
}

// run-match.ts/run-aggregate.ts와 동일한 가드(scripts/shared/cli.ts) — import만으로(예: parseArgs
// 단위 테스트) main()이 실행되지 않게 한다.
if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error("run-notify 실패:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
