// src/pipeline/match/llm-match.ts
// F4 2단(LLM): Claude(모델은 `llm-config.ts` LLM_MODEL)로 짝 없는(또는 노트와 불일치하는) 델타의 간접 영향 후보를
// 추론한다. 반환된 후보 ID는 반드시 후보셋 검증(verified) 뒤에만 유색 링크로 노출한다 — 무근거
// 문장은 회색(verdict.ts 원칙과 동일). 배치 1회 상한·캐시 우선·예산 소진 시 캐시 폴백.
// 런타임 외부 API 호출은 이 모듈에 한정한다(directory 규칙: match/llm-match.ts만 Claude API 호출).
//
// 캐시: data/cache/llm/{sha256(model+promptVersion+deltaId+candidateSetHash)}.json — 있으면 API
// 호출 0. 프롬프트 캐싱(Anthropic 서버 측, cache_control:ephemeral)과는 다른 개념 — 이건 우리
// 파일시스템 캐시(재실행 시 API 호출 자체를 건너뜀), 프롬프트 캐싱은 캐시 미스일 때 호출 비용을
// 낮추는 것(system 블록의 후보셋이 배치 내 불변이라 프롬프트 prefix가 안정적).
//
// candidateSetHash 계산은 **정렬된 배열**(id 오름차순) 직렬화 문자열 기준이다 — Set/Map 순회
// 순서는 JS 엔진에 따라 삽입 순서를 보존하긴 하지만, 명시적으로 정렬해야 "배치 내 불변"이 코드
// 레벨에서 보장된다(타임스탬프·랜덤 없음 — 프롬프트 prefix 안정성 = 프롬프트 캐싱 히트 전제조건).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { DeltaRecord, PatchNoteItem } from "../types";
import { llmCacheDir } from "../shared/paths";
import type { GameLlmProfile, LlmDelta } from "./llm-profile";

export { LLM_MODEL, PROMPT_VERSION } from "./llm-config";
import {
  DEFAULT_LLM_BUDGET_USD,
  LLM_BUDGET_ENV,
  LLM_EFFORT,
  LLM_EST_USD_PER_CALL,
  LLM_MODEL,
  LLM_OPT_IN_ENV,
  PROMPT_VERSION,
  type LlmEffort,
} from "./llm-config";
import { OutputSchema, type LlmOutput, type LlmUsageTotals } from "./llm-schema";
import { cacheKeyFor, candidateSetHash, readCache, serializeCandidates, writeCache } from "./llm-cache";
import { citedMentionNames, ownNameOf, summaryCitesAllMismatched, verifyCauses, verifySummaryCites } from "./llm-verify";
import {
  buildProseRepairNote,
  countProseViolations,
  mergeRepairedProse,
  summarizeProseHygiene,
  summaryNumbersGrounded,
  SUMMARY_MAX_CHARS,
  type ProseHygieneStats,
} from "./llm-prose";

// 2026-10-06 분할: 아래 모듈로 옮긴 공개 심볼을 이 경로로도 계속 노출한다(호출부·테스트의 import 경로 불변).
// Claude SDK 호출(`new Anthropic`·`messages.parse`)은 이 파일에만 남는다 — CLAUDE.md 「Claude API 호출이 발생하는 유일한 계층」.
export type { LlmOutput, LlmUsageTotals } from "./llm-schema";
export { cacheKeyFor, candidateSetHash, serializeCandidates } from "./llm-cache";
export { namesOtherEntityThanCited, summaryCitesAllMismatched, verifyCauses, verifySummaryCites } from "./llm-verify";
export {
  buildProseRepairNote,
  CAUSE_MAX_CHARS,
  countProseViolations,
  isNounEnding,
  mergeRepairedProse,
  summarizeProseHygiene,
  summaryNumbersGrounded,
  SUMMARY_MAX_CHARS,
  type ProseCauseEntry,
  type ProseHygieneStats,
} from "./llm-prose";
// 2026-09-17: 50 → 120. 실측 후보가 113건(미공지 47 + 간접 2 + 공지-불일치 64)인데 상한이
// 50이라 미공지 14건이 LLM을 **아예 거치지 못했고**, 화면은 그것을 "근거 미확인"으로 표시해
// "검토했으나 후보 없음"과 구분되지 않았다(사용자 지적 B5).
export const DEFAULT_MAX_DELTAS = 120;
// 호출 총 상한은 대상 수보다 **한 칸 위**에 둔다 — 아래에 두면 상한을 올려도 실제로는 이쪽이
// 먼저 걸려서 "올렸는데 왜 그대로지"가 된다(이전 값 60은 maxDeltas 50보다 컸지만 지금 기준으론
// 아니다). 이 값은 폭주 방지선이지 예산 정책이 아니다 — 예산 정책은 `--llm-max`가 소유한다.
// 2026-09-19 v5: 130 → 150. 길이 재요청이 같은 지갑에서 나가므로(델타당 최대 1회), 대상 120건에
// 재요청 여지 30건을 더한다. 실측 위반은 120건 중 3건·110건 중 2건이라 여유가 충분하다.
export const DEFAULT_MAX_TOTAL_CALLS = 150;
// 2026-10-06: 총 상한을 호출부가 따로 챙기게 두면 한쪽만 고쳐진다 — TFT는 `llmMax + 40`을 넘겼지만 LoL은
// 안 넘겨 CI `--llm-max 400`이 이 기본 150에 묶였다. 그래서 미지정이면 엔진이 maxDeltas에서 유도한다.
// 여유 40은 TFT가 실측으로 쓰던 값(문장 재요청 몫)이다.
export const PROSE_REPAIR_HEADROOM = 40;

/** 호출 총 상한 — 명시값이 있으면 그것, 없으면 `max(기본 150, maxDeltas + 재요청 여유)`. */
export function totalCallCapFor(maxDeltas: number, explicit?: number): number {
  return explicit ?? Math.max(DEFAULT_MAX_TOTAL_CALLS, maxDeltas + PROSE_REPAIR_HEADROOM);
}

/** 골든 가드(`prompt-golden.test.ts`)가 렌더 결과를 해시하려고 노출한다 — 후보 목록을 감싸는 문구는 캐시 키에 없다. */
export function buildSystemPrompt<TDelta extends LlmDelta>(profile: GameLlmProfile<TDelta>, notes: readonly PatchNoteItem[]): string {
  return `${profile.systemInstructions}\n\n후보 패치노트 항목 목록(JSON):\n${serializeCandidates(notes)}`;
}

function emptyUsage(): LlmUsageTotals {
  return { inputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: 0 };
}

export interface LlmCallResult {
  parsed: LlmOutput | null;
  usage: LlmUsageTotals;
}

/**
 * 델타 1건에 대해 **항상 실제로 API를 호출**한다(파일 캐시 확인 없음) — `inferIndirectCandidates`가
 * 캐시 미스일 때 이 함수를 쓴다. 라이브 스모크 테스트도 이 함수를 직접 두 번 호출해 Anthropic
 * 서버 측 프롬프트 캐싱(cache_read_input_tokens)을 검증한다(파일 캐시를 우회해야 두 번째 호출이
 * 실제로 API에 도달한다).
 */
export async function callLlmForDelta<TDelta extends LlmDelta = DeltaRecord>(
  client: Anthropic,
  model: string,
  profile: GameLlmProfile<TDelta>,
  delta: TDelta,
  candidates: readonly PatchNoteItem[],
  /** 길이 재요청 문구(1회 한정). 있으면 사용자 메시지 뒤에 붙는다 — 시스템 프롬프트는 그대로라
   * 캐시 프리픽스가 깨지지 않는다. */
  repairNote?: string,
  effort: LlmEffort = LLM_EFFORT
): Promise<LlmCallResult> {
  const response = await client.messages.parse({
    model,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(profile, candidates),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          repairNote === undefined
            ? profile.buildUserPrompt(delta)
            : `${profile.buildUserPrompt(delta)}\n\n${repairNote}`,
      },
    ],
    output_config: {
      effort,
      format: zodOutputFormat(OutputSchema),
    },
  });

  const usage: LlmUsageTotals = {
    inputTokens: response.usage.input_tokens,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    outputTokens: response.usage.output_tokens,
  };

  return { parsed: response.parsed_output, usage };
}

/** 재요청은 캐시 항목 하나당 이 횟수까지. */
const MAX_PROSE_REPAIR_ATTEMPTS = 1;

export interface LlmMatchOptions {
  /** 세션당 LLM 2단 시도 대상 델타 수 상한(`--llm-max`, 기본 `DEFAULT_MAX_DELTAS`). */
  maxDeltas?: number;
  /** 세션당 실제 API 호출 총 상한(캐시 히트는 포함 안 됨). 없으면 `totalCallCapFor(maxDeltas)`. */
  maxTotalCalls?: number;
  /** 기본 data/cache/llm/. */
  cacheDir?: string;
  /**
   * 게임 하나의 지시문을 고쳤을 때 **그 게임만** 다시 묻게 하는 개정 태그(2026-09-27). 캐시 키가 프롬프트
   * 본문을 보지 않으므로, 없으면 지시문 수정이 조용히 캐시 적중으로 묻힌다. 전역 `PROMPT_VERSION`을
   * 올리면 다른 게임 캐시까지 전량 무효가 된다. 비워 두면 키는 이 옵션이 생기기 전과 같다.
   */
  promptRevision?: string;
  /** 주입 가능한 Anthropic 클라이언트(테스트 모킹용). 기본은 `new Anthropic()`(env의 ANTHROPIC_API_KEY 사용). */
  client?: Anthropic;
  model?: string;
  /** 견적만 내고 호출·캐시 기록을 하지 않는다(`--dry-run`). 반환 델타는 입력 그대로다. */
  planOnly?: boolean;
  /** 실행 1회 예산(USD). 없으면 `PATCHGAP_LLM_BUDGET_USD` → `DEFAULT_LLM_BUDGET_USD`. */
  budgetUsd?: number;
  /** 추론 강도. 기본 `LLM_EFFORT` — 바꾸면 캐시 키가 갈린다. */
  effort?: LlmEffort;
}

/**
 * 호출 전 견적(2026-09-29). 캐시 파일 존재만 보고 센다 — 비용 0, 결정론. `estimatedCalls`는 호출 총 상한으로
 * 자른 값이고, 새로 받은 답의 길이 재요청(델타당 최대 1회)은 미리 알 수 없어 넣지 않는다(실측 위반율 2~3%).
 */
export interface LlmCallPlan {
  targets: number;
  cacheHits: number;
  misses: number;
  /** 캐시 적중했지만 문장 규칙 위반으로 1회 되물을 항목. */
  proseRepairs: number;
  estimatedCalls: number;
  /** 추정치 — `LLM_EST_USD_PER_CALL` 기준. */
  estimatedUsd: number;
}

/** 실제 호출 허용 여부 — 명시 opt-in(환경변수)만. 테스트처럼 클라이언트를 주입하면 그 자체가 opt-in이다. */
export function llmCallsOptedIn(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[LLM_OPT_IN_ENV] === "1";
}

function budgetFrom(options: LlmMatchOptions, env: NodeJS.ProcessEnv = process.env): number {
  if (options.budgetUsd !== undefined) return options.budgetUsd;
  const raw = Number(env[LLM_BUDGET_ENV]);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LLM_BUDGET_USD;
}

function formatPlan(plan: LlmCallPlan): string {
  return (
    `대상 ${plan.targets} · 캐시 적중 ${plan.cacheHits} · 미스 ${plan.misses} · 재요청 ${plan.proseRepairs} ` +
    `→ 예상 호출 ${plan.estimatedCalls}건 · 추정 $${plan.estimatedUsd.toFixed(2)}`
  );
}

export interface LlmRunSummary {
  /** 산출 문장 위생 집계(2026-09-19) — summarizeProseHygiene 참고. */
  prose: ProseHygieneStats;
  /** 실제 API 호출 횟수(캐시 히트 제외). */
  calls: number;
  cacheHits: number;
  /** 예산/상한 초과로 아예 시도하지 못한 델타 수. */
  skipped: number;
  /** 문장 규칙 위반으로 1회 재요청한 델타 수(v5, 2026-09-19에 명사형 종결까지 포함하도록 확대).
   * `calls`에 이미 포함된다 — 별도 예산이 아니라 같은 지갑에서 나간다는 사실을 보이려고 따로 센다. */
  proseRepairs: number;
  usage: LlmUsageTotals;
  /** 호출 전 견적(2026-09-29) — 실행 로그와 산출물에서 「얼마를 쓰려 했나」를 남긴다. */
  plan?: LlmCallPlan;
}

export interface LlmMatchResult<TDelta extends LlmDelta = DeltaRecord> {
  /** 입력과 같은 길이 — 대상이 아니었던 델타는 그대로, 대상이었던 델타는 causes/llm이 갱신됨. */
  deltas: TDelta[];
  summary: LlmRunSummary;
}

function addUsage(total: LlmUsageTotals, delta: LlmUsageTotals): void {
  total.inputTokens += delta.inputTokens;
  total.cacheReadInputTokens += delta.cacheReadInputTokens;
  total.cacheCreationInputTokens += delta.cacheCreationInputTokens;
  total.outputTokens += delta.outputTokens;
}

/**
 * `unannounced`/`announced-inconsistent` 델타 상위 `maxDeltas`건에 대해 LLM 2단 간접 원인 추론을
 * 실행한다. 캐시 우선(파일 캐시 히트 시 API 호출 0), 세션 호출 총 상한 초과 시 나머지는
 * `causes=[]`·`llm:{skipped:true, reason:'call-budget-exceeded'}`로 남긴다. 429/5xx 등 API 실패는
 * 캐시 폴백(캐시가 없으면 회색 처리) — 파이프라인을 죽이지 않는다.
 */
export async function inferIndirectCandidates<TDelta extends LlmDelta = DeltaRecord>(
  deltas: readonly TDelta[],
  notes: readonly PatchNoteItem[],
  profile: GameLlmProfile<TDelta>,
  options: LlmMatchOptions = {}
): Promise<LlmMatchResult<TDelta>> {
  const maxDeltas = options.maxDeltas ?? DEFAULT_MAX_DELTAS;
  const maxTotalCalls = totalCallCapFor(maxDeltas, options.maxTotalCalls);
  const cacheDir = options.cacheDir ?? llmCacheDir();
  // 호출부 옵션이 있으면 그것이 우선(일회성 실험용), 평소 태그는 프로필이 지시문 옆에서 든다(C5).
  const revision = options.promptRevision || profile.promptRevision;
  const promptVersion = revision ? `${PROMPT_VERSION}+${revision}` : PROMPT_VERSION;
  const model = options.model ?? LLM_MODEL;

  const candidates = profile.candidatesOf(notes);
  const candSetHash = candidateSetHash(serializeCandidates(candidates));

  const isTarget =
    profile.isTarget ?? ((d: TDelta) => d.status === "unannounced" || d.status === "announced-inconsistent");
  const targets = deltas.filter((d) => isTarget(d)).slice(0, maxDeltas);
  const targetIds = new Set(targets.map((d) => d.id));
  const effort = options.effort ?? LLM_EFFORT;
  const keyOf = (d: TDelta) => cacheKeyFor(model, promptVersion, d.id, candSetHash, effort);

  // ── 견적 → 게이트(2026-09-29). 한 건이라도 부르기 **전에** 멈춰야 한다 — 도중에 멈추면 이미 산 호출이
  // 산출물에 반영되지 않는 채로 버려진다.
  const plan: LlmCallPlan = { targets: targets.length, cacheHits: 0, misses: 0, proseRepairs: 0, estimatedCalls: 0, estimatedUsd: 0 };
  for (const d of targets) {
    const hit = readCache(cacheDir, keyOf(d));
    if (hit === null) plan.misses += 1;
    else {
      plan.cacheHits += 1;
      if (countProseViolations(hit.parsed) > 0 && (hit.proseRepairAttempts ?? 0) < MAX_PROSE_REPAIR_ATTEMPTS) plan.proseRepairs += 1;
    }
  }
  plan.estimatedCalls = Math.min(plan.misses + plan.proseRepairs, maxTotalCalls);
  plan.estimatedUsd = plan.estimatedCalls * LLM_EST_USD_PER_CALL;
  console.log(`[llm] 견적: ${formatPlan(plan)}`);

  if (options.planOnly) {
    return {
      deltas: [...deltas],
      summary: { calls: 0, cacheHits: 0, skipped: 0, proseRepairs: 0, usage: emptyUsage(), prose: summarizeProseHygiene([]), plan },
    };
  }
  if (plan.estimatedCalls > 0) {
    if (options.client === undefined && !llmCallsOptedIn()) {
      throw new Error(
        `LLM 호출 차단 — ${formatPlan(plan)}. 실제로 부르려면 ${LLM_OPT_IN_ENV}=1, 견적만 보려면 --dry-run. ` +
          `(로컬 기본은 캐시 전용: 미스를 회색으로 채워 쓰면 이미 산 원인까지 덮인다)`
      );
    }
    if (options.client === undefined && !process.env.ANTHROPIC_API_KEY) {
      // opt-in했는데 키가 없으면 호출마다 실패해 전부 회색이 된다 — 스텝이 초록으로 끝나는 조용한 우회였다.
      throw new Error(`LLM 호출 불가 — ${LLM_OPT_IN_ENV}=1인데 ANTHROPIC_API_KEY가 없다. ${formatPlan(plan)}`);
    }
    const budget = budgetFrom(options);
    if (plan.estimatedUsd > budget) {
      throw new Error(
        `LLM 예산 초과 — ${formatPlan(plan)} > 예산 $${budget.toFixed(2)}. 대상을 줄이거나(--llm-max) ${LLM_BUDGET_ENV}로 올린다.`
      );
    }
  }

  const summary: LlmRunSummary = {
    calls: 0,
    cacheHits: 0,
    skipped: 0,
    proseRepairs: 0,
    usage: emptyUsage(),
    prose: summarizeProseHygiene([]),
  };
  // 게이트를 지난 뒤에만 만든다 — 캐시 전용 실행은 키 없이도 돈다.
  let lazyClient: Anthropic | undefined = options.client;
  const clientOf = (): Anthropic => (lazyClient ??= new Anthropic());
  const resultById = new Map<string, TDelta>();
  // 재요청 요약 채택 게이트는 **최종 게이트와 같아야** 한다(scope-critic 2026-09-28) — 인용 실재만 보고
  // 채택하면, 최종 단계의 C4(인용 전부 불일치)에서 미검증으로 떨어질 문장을 원본 대신 받아들이게 된다.
  const acceptCites = (summaryText: string, cites: readonly string[], delta: TDelta) =>
    verifySummaryCites(cites, candidates, profile) && !summaryCitesAllMismatched(summaryText, cites, candidates, ownNameOf(delta));

  /**
   * 화면에 나갈 요약을 확정한다(C1). 재요청까지 거쳐도 100자를 넘으면 **자르지 않고**(인용·수치를 잃는다)
   * **회색으로도 돌리지 않고**(회색은 「근거 미검증」이라 길이 위반에 쓰면 뜻이 바뀐다) 델타 수치만의
   * 결정론 요약으로 바꾼다 — 지시문 규칙 6이 이미 허용하는 형태(`summaryCites=[]`)다. 캐시는 원문을 지킨다.
   */
  const finalizeSummary = (parsed: LlmOutput, delta: TDelta): NonNullable<TDelta["llm"]> => {
    // 수치 사실성(2026-09-29): 캐시 키가 델타 수치를 모르므로, 같은 쌍을 다시 수집하면 옛 수치를 말하는 요약이
    // 적중한다. 원인은 verifyCauses가 현재 수치로 재검증하지만 요약은 아니었다 — 여기서 같은 검사를 건다.
    // 키에 수치를 넣으면 재수집마다 전량 재호출이라 비용이 역행한다: 막는 곳은 키가 아니라 검증이다.
    const stale = !summaryNumbersGrounded(parsed.summary, candidates, profile.ownNumbersOf?.(delta) ?? []);
    const fallback = parsed.summary.length > SUMMARY_MAX_CHARS || stale ? profile.fallbackSummary?.(delta) : undefined;
    if (fallback === undefined && stale) {
      return { skipped: false, summary: parsed.summary, summaryCites: parsed.summaryCites, summaryVerified: false };
    }
    if (fallback !== undefined) {
      return { skipped: false, summary: fallback, summaryCites: [], summaryVerified: true, summaryDeterministic: true };
    }
    return {
      skipped: false,
      summary: parsed.summary,
      summaryCites: parsed.summaryCites,
      summaryVerified:
        verifySummaryCites(parsed.summaryCites, candidates, profile) &&
        !summaryCitesAllMismatched(parsed.summary, parsed.summaryCites, candidates, ownNameOf(delta)),
    };
  };

  for (const delta of targets) {
    const key = keyOf(delta);
    const cached = readCache(cacheDir, key);
    if (cached) {
      summary.cacheHits += 1;
      let cachedParsed = cached.parsed;

      // 캐시 적중에도 문장 규칙을 적용한다(2026-09-19 최종 채점 K1-7). **이것이 없으면 이미 캐시된
      // 위반은 영원히 고쳐지지 않는다** — 재생성해도 캐시를 그대로 읽기 때문이다. 프롬프트를 고쳐
      // PROMPT_VERSION을 올리면 236건이 전량 무효가 되지만, 이 경로는 위반한 13건만 다시 묻고
      // 결과를 **같은 키에 되쓴다**. 길이 재요청이 이미 v5 키에 되쓰고 있으므로 새 규약은 아니다.
      const attempts = cached.proseRepairAttempts ?? 0;
      if (countProseViolations(cachedParsed) > 0 && attempts < MAX_PROSE_REPAIR_ATTEMPTS && summary.calls < maxTotalCalls) {
        try {
          summary.calls += 1;
          summary.proseRepairs += 1;
          const repaired = await callLlmForDelta(
            clientOf(),
            model,
            profile,
            delta,
            candidates,
            buildProseRepairNote(cachedParsed),
            effort
          );
          addUsage(summary.usage, repaired.usage);
          const merged =
            repaired.parsed === null ? null : mergeRepairedProse(cachedParsed, repaired.parsed, (t, c) => acceptCites(t, c, delta));
          if (merged !== null && countProseViolations(merged) < countProseViolations(cachedParsed)) {
            cachedParsed = merged;
          }
          // 고쳐졌든 아니든 시도를 적는다 — 적지 않으면 다음 실행이 같은 것을 또 묻는다(C1).
          // 재요청 usage도 캐시 파일에 합산한다 — 빠지면 캐시 합계로 청구액을 설명할 수 없다(2026-09-29 실측 잔차).
          const usageSoFar = emptyUsage();
          addUsage(usageSoFar, cached.usage);
          addUsage(usageSoFar, repaired.usage);
          writeCache(cacheDir, key, {
            ...cached,
            generatedAt: new Date().toISOString(),
            parsed: cachedParsed,
            usage: usageSoFar,
            proseRepairAttempts: attempts + 1,
          });
        } catch {
          // 재요청 실패는 치명적이지 않다 — 캐시된 원문을 그대로 쓴다(위생 집계가 그것을 센다).
        }
      }

      resultById.set(delta.id, {
        ...delta,
        causes: verifyCauses(cachedParsed.causes, candidates, delta, profile),
        llm: finalizeSummary(cachedParsed, delta),
      });
      continue;
    }

    if (summary.calls >= maxTotalCalls) {
      summary.skipped += 1;
      resultById.set(delta.id, {
        ...delta,
        causes: [],
        llm: { skipped: true, reason: "call-budget-exceeded" },
      });
      continue;
    }

    try {
      summary.calls += 1;
      const first = await callLlmForDelta(clientOf(), model, profile, delta, candidates, undefined, effort);
      const usage = emptyUsage();
      addUsage(usage, first.usage);
      let parsed = first.parsed;
      let repairAttempts = 0;

      // 길이 재요청(v5, 1회 한정) — 프롬프트 문구로는 2~4%가 남는다는 것이 v4의 실측이다. 상한을
      // 넘긴 응답에 대해서만 "몇 자인지"를 짚어 다시 묻고, **위반이 더 적은 쪽**을 택한다. 응답을
      // 통째로 고르는 이유: summary와 summaryCites는 한 쌍이라 섞으면 인용이 문장과 어긋난다.
      if (parsed !== null && countProseViolations(parsed) > 0 && summary.calls < maxTotalCalls) {
        summary.calls += 1;
        summary.proseRepairs += 1;
        repairAttempts += 1;
        const repaired = await callLlmForDelta(
          clientOf(),
          model,
          profile,
          delta,
          candidates,
          buildProseRepairNote(parsed),
          effort
        );
        addUsage(usage, repaired.usage);
        const merged = repaired.parsed === null ? null : mergeRepairedProse(parsed, repaired.parsed, (t, c) => acceptCites(t, c, delta));
        if (merged !== null && countProseViolations(merged) < countProseViolations(parsed)) {
          parsed = merged;
        }
      }

      // 재요청분까지 합산한 뒤 한 번에 올린다 — 캐시 파일에 적히는 usage와 세션 합계가 같은
      // 값을 말하게 하려는 것이다(둘이 갈리면 나중에 어느 쪽이 맞는지 알 수 없다).
      addUsage(summary.usage, usage);

      if (parsed === null) {
        resultById.set(delta.id, {
          ...delta,
          causes: [],
          llm: { skipped: true, reason: "parse-failed" },
        });
        continue;
      }

      writeCache(cacheDir, key, {
        deltaId: delta.id,
        model,
        promptVersion,
        candidateSetHash: candSetHash,
        generatedAt: new Date().toISOString(),
        parsed,
        usage,
        proseRepairAttempts: repairAttempts,
      });

      resultById.set(delta.id, {
        ...delta,
        causes: verifyCauses(parsed.causes, candidates, delta, profile),
        llm: finalizeSummary(parsed, delta),
      });
    } catch (error) {
      const reason =
        error instanceof Anthropic.RateLimitError
          ? "rate-limited"
          : error instanceof Anthropic.APIError
            ? `api-error-${error.status ?? "unknown"}`
            : "unknown-error";
      resultById.set(delta.id, { ...delta, causes: [], llm: { skipped: true, reason } });
    }
  }

  const merged = deltas.map((d) => (targetIds.has(d.id) ? (resultById.get(d.id) ?? d) : d));
  // 산출 문장 위생은 **검증을 통과한 문장**만 센다 — 회색으로 떨어진 문장은 화면에 단언으로
  // 나가지 않으므로 개선 측정 대상이 아니다.
  // 원인 문장은 **검증 통과 여부와 무관하게 전부** 센다(2026-09-19 재판정 지적). 회색으로 떨어진
  // 문장도 화면에서 사라지지 않고 "근거가 약하다"는 표시만 달고 남으므로, 그 문장의 위생도
  // 사용자가 읽는 품질의 일부다. 요약은 본문색으로 단언하는 것만 센다 — 검증 실패한 요약은
  // 회색이라 단언이 아니다.
  summary.prose = summarizeProseHygiene(
    merged.map((record) => ({
      summary:
        record.llm && !record.llm.skipped && record.llm.summaryVerified ? (record.llm.summary ?? null) : null,
      causes: (record.causes ?? []).map((cause) => ({ text: cause.text, confidence: cause.confidence })),
    }))
  );
  const candidateById = new Map(candidates.map((note) => [note.id, note] as const));
  summary.prose.causeUnnamedTarget = merged
    .flatMap((record) => record.causes ?? [])
    .filter((cause) => {
      const cited = cause.verified && cause.candidateNoteId !== null ? candidateById.get(cause.candidateNoteId) : undefined;
      return cited !== undefined && !citedMentionNames(cited).some((name) => cause.text.includes(name));
    }).length;
  summary.prose.summaryDeterministic = merged.filter((record) => record.llm?.summaryDeterministic === true).length;
  return { deltas: merged, summary };
}
