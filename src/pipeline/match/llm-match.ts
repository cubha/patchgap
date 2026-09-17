// src/pipeline/match/llm-match.ts
// F4 2단(LLM): Claude Sonnet 5로 짝 없는(또는 노트와 불일치하는) 델타의 간접 영향 후보를
// 추론한다. 반환된 후보 ID는 반드시 후보셋 검증(verified) 뒤에만 유색 링크로 노출한다 — 무근거
// 문장은 회색(verdict.ts 원칙과 동일). 배치 1회 상한·캐시 우선·예산 소진 시 캐시 폴백.
// 런타임 외부 API 호출은 이 모듈에 한정한다(diretory 규칙: match/llm-match.ts만 Claude API 호출).
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
import { z } from "zod";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DeltaRecord, LlmCause, PatchNoteItem } from "../types";
import { llmCacheDir } from "../shared/paths";
import type { DdragonData } from "./ddragon";

export const LLM_MODEL = "claude-sonnet-5";
// v2(B4 후속 수정): summaryCites 필드 추가 + 프롬프트 규칙 6 추가 — 출력 스키마·프롬프트가
// 바뀌었으므로 promptVersion을 올려 v1 캐시 키와 절대 충돌하지 않게 한다(캐시 키에 promptVersion
// 포함 — 옛 v1 캐시 파일이 있어도 자동으로 miss 처리되어 재호출된다).
export const PROMPT_VERSION = "v2";
// 2026-09-17: 50 → 120. 실측 후보가 113건(미공지 47 + 간접 2 + 공지-불일치 64)인데 상한이
// 50이라 미공지 14건이 LLM을 **아예 거치지 못했고**, 화면은 그것을 "근거 미확인"으로 표시해
// "검토했으나 후보 없음"과 구분되지 않았다(사용자 지적 B5).
export const DEFAULT_MAX_DELTAS = 120;
// 호출 총 상한은 대상 수보다 **한 칸 위**에 둔다 — 아래에 두면 상한을 올려도 실제로는 이쪽이
// 먼저 걸려서 "올렸는데 왜 그대로지"가 된다(이전 값 60은 maxDeltas 50보다 컸지만 지금 기준으론
// 아니다). 이 값은 폭주 방지선이지 예산 정책이 아니다 — 예산 정책은 `--llm-max`가 소유한다.
export const DEFAULT_MAX_TOTAL_CALLS = 130;

const OutputSchema = z.object({
  causes: z.array(
    z.object({
      candidateNoteId: z.string().nullable(),
      text: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
  summary: z.string(),
  /** B4 후속 수정(S3 인용 강제) — summary가 근거로 인용한 후보 노트 id 목록. 델타 수치만 근거로
   * 썼으면(자기 델타 외 인용 없음) 빈 배열. verifySummaryCites가 구조적으로 검증한다. */
  summaryCites: z.array(z.string()),
});

type LlmOutput = z.infer<typeof OutputSchema>;

/** system 프롬프트에 넣는 후보 항목 축약 뷰 — 델타 인과 추론에 필요한 필드만. */
type CandidateView = Pick<
  PatchNoteItem,
  "id" | "entity" | "skill" | "stat" | "before" | "after" | "direction" | "section"
>;

function toCandidateView(note: PatchNoteItem): CandidateView {
  return {
    id: note.id,
    entity: note.entity,
    skill: note.skill,
    stat: note.stat,
    before: note.before,
    after: note.after,
    direction: note.direction,
    section: note.section,
  };
}

/**
 * 후보 패치노트 항목을 id 오름차순으로 정렬한 뒤 직렬화한다. **타임스탬프·랜덤 미포함** —
 * 같은 후보셋이면 언제 호출해도 바이트 단위로 동일한 문자열이 나와야 한다(프롬프트 캐싱 전제).
 */
export function serializeCandidates(notes: readonly PatchNoteItem[]): string {
  const sorted = [...notes].map(toCandidateView).sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

export function candidateSetHash(serialized: string): string {
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function cacheKeyFor(model: string, promptVersion: string, deltaId: string, candSetHash: string): string {
  return crypto
    .createHash("sha256")
    .update(`${model}|${promptVersion}|${deltaId}|${candSetHash}`)
    .digest("hex");
}

const SYSTEM_INSTRUCTIONS = [
  "당신은 리그 오브 레전드 패치 분석가입니다.",
  "아래 후보 패치노트 항목 목록(JSON 배열)에서, 사용자가 제시하는 통계 델타(패치노트로 직접",
  "설명되지 않거나 노트와 불일치하는 관측 변화)를 설명할 수 있는 간접 영향 후보를 찾으세요.",
  "규칙:",
  "1. candidateNoteId는 반드시 후보 목록에 있는 id만 반환하세요. 목록에 없는 id를 지어내지 마세요.",
  "2. 이 델타의 엔티티 자신에 대한 직접 변경 노트(이미 1단 결정론 매칭에서 다뤄졌어야 함)는",
  "   후보로 제시하지 마세요 — 간접 영향(다른 챔피언/아이템/시스템 변경의 파급 효과)만 찾으세요.",
  "3. 근거가 약하면 confidence를 low로, 강하면 high로 표시하세요. 그럴듯한 후보가 전혀 없으면",
  "   causes를 빈 배열로 반환하세요(지어내지 마세요).",
  "4. summary는 이 델타에 대한 한국어 브리핑 한 문장입니다 — 근거를 명시하세요.",
  "5. 반드시 한국어로 답하세요.",
  "6. summary는 summaryCites에 넣은 id의 후보 항목 또는 이 델타 자체의 수치(이전/이후/CI/n)만",
  "   근거로 쓰세요. summaryCites에는 summary 문장에서 실제로 인용한 후보 id만 정확히 넣으세요",
  "   (지어낸 id 금지). 델타 수치만으로 요약했다면(인용한 후보가 없다면) summaryCites는 빈",
  "   배열로 반환하세요.",
].join("\n");

function buildSystemPrompt(notes: readonly PatchNoteItem[]): string {
  return `${SYSTEM_INSTRUCTIONS}\n\n후보 패치노트 항목 목록(JSON):\n${serializeCandidates(notes)}`;
}

function buildUserPrompt(delta: DeltaRecord): string {
  return [
    `엔티티: ${delta.entityName} (${delta.entityKey}, ${delta.entityType})`,
    `지표: ${delta.metric}`,
    `이전 값: ${delta.before ?? "N/A"}`,
    `이후 값: ${delta.after ?? "N/A"}`,
    `델타: ${delta.delta ?? "N/A"}`,
    `95% CI: [${delta.ci[0]}, ${delta.ci[1]}]`,
    `표본 n: 이전=${delta.n.before}, 이후=${delta.n.after}`,
    `현재 판정 상태: ${delta.status}`,
  ].join("\n");
}

export interface LlmUsageTotals {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
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
export async function callLlmForDelta(
  client: Anthropic,
  model: string,
  delta: DeltaRecord,
  candidates: readonly PatchNoteItem[]
): Promise<LlmCallResult> {
  const response = await client.messages.parse({
    model,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(candidates),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserPrompt(delta) }],
    output_config: {
      effort: "medium",
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

interface CacheFileShape {
  deltaId: string;
  model: string;
  promptVersion: string;
  candidateSetHash: string;
  generatedAt: string;
  parsed: LlmOutput;
  usage: LlmUsageTotals;
}

function readCache(cacheDir: string, key: string): CacheFileShape | null {
  const filePath = path.join(cacheDir, `${key}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as CacheFileShape;
  } catch {
    return null; // 손상된 캐시 파일 — 재호출 유도(폐기 아님, 그냥 miss 취급)
  }
}

function writeCache(cacheDir: string, key: string, value: CacheFileShape): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `${key}.json`), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolvesToSameEntity(note: PatchNoteItem, delta: DeltaRecord, ddragon: DdragonData): boolean {
  if (delta.entityType === "champion" && note.section === "champion") {
    const champion = ddragon.champions.byKoName(note.entity);
    return champion?.id === delta.entityKey;
  }
  if (delta.entityType === "item" && note.section === "item") {
    const candidates = ddragon.items.byKoName(note.entity);
    return candidates.some((item) => String(item.id) === delta.entityKey);
  }
  return false;
}

/**
 * LLM이 반환한 causes를 후보셋 검증한다 — 존재하지 않는 id·자기 엔티티 참조는 candidateNoteId를
 * null로, verified를 false로 폐기(text/confidence는 회색 표기용으로 보존).
 */
export function verifyCauses(
  rawCauses: LlmOutput["causes"],
  candidates: readonly PatchNoteItem[],
  delta: DeltaRecord,
  ddragon: DdragonData
): LlmCause[] {
  const candidateIds = new Set(candidates.map((note) => note.id));
  const notesById = new Map(candidates.map((note) => [note.id, note] as const));

  return rawCauses.map((cause): LlmCause => {
    if (cause.candidateNoteId === null) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    if (!candidateIds.has(cause.candidateNoteId)) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    const note = notesById.get(cause.candidateNoteId);
    if (note && resolvesToSameEntity(note, delta, ddragon)) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    return {
      text: cause.text,
      candidateNoteId: cause.candidateNoteId,
      verified: true,
      confidence: cause.confidence,
    };
  });
}

/**
 * B4 후속 수정(S3 인용 강제) — `summaryCites`의 모든 id가 입력 후보셋에 실제로 존재하는지만
 * 확인한다(causes와 달리 자기참조 배제는 요구되지 않음 — summary는 델타 자신의 수치를 근거로
 * 쓰는 것이 정상이므로). 빈 배열은 "인용 없음"이라 항상 통과(true).
 */
export function verifySummaryCites(
  summaryCites: readonly string[],
  candidates: readonly PatchNoteItem[]
): boolean {
  if (summaryCites.length === 0) return true;
  const candidateIds = new Set(candidates.map((note) => note.id));
  return summaryCites.every((id) => candidateIds.has(id));
}

export interface LlmMatchOptions {
  /** 세션당 LLM 2단 시도 대상 델타 수 상한(`--llm-max`, 기본 50). */
  maxDeltas?: number;
  /** 세션당 실제 API 호출 총 상한(캐시 히트는 포함 안 됨, 기본 60). */
  maxTotalCalls?: number;
  /** 기본 data/cache/llm/. */
  cacheDir?: string;
  /** 주입 가능한 Anthropic 클라이언트(테스트 모킹용). 기본은 `new Anthropic()`(env의 ANTHROPIC_API_KEY 사용). */
  client?: Anthropic;
  model?: string;
}

export interface LlmRunSummary {
  /** 실제 API 호출 횟수(캐시 히트 제외). */
  calls: number;
  cacheHits: number;
  /** 예산/상한 초과로 아예 시도하지 못한 델타 수. */
  skipped: number;
  usage: LlmUsageTotals;
}

export interface LlmMatchResult {
  /** 입력과 같은 길이 — 대상이 아니었던 델타는 그대로, 대상이었던 델타는 causes/llm이 갱신됨. */
  deltas: DeltaRecord[];
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
export async function inferIndirectCandidates(
  deltas: readonly DeltaRecord[],
  notes: readonly PatchNoteItem[],
  ddragon: DdragonData,
  options: LlmMatchOptions = {}
): Promise<LlmMatchResult> {
  const maxDeltas = options.maxDeltas ?? DEFAULT_MAX_DELTAS;
  const maxTotalCalls = options.maxTotalCalls ?? DEFAULT_MAX_TOTAL_CALLS;
  const cacheDir = options.cacheDir ?? llmCacheDir();
  const model = options.model ?? LLM_MODEL;

  const candSetHash = candidateSetHash(serializeCandidates(notes));

  const targets = deltas
    .filter((d) => d.status === "unannounced" || d.status === "announced-inconsistent")
    .slice(0, maxDeltas);
  const targetIds = new Set(targets.map((d) => d.id));

  const summary: LlmRunSummary = { calls: 0, cacheHits: 0, skipped: 0, usage: emptyUsage() };
  const client = options.client ?? new Anthropic();
  const resultById = new Map<string, DeltaRecord>();

  for (const delta of targets) {
    const key = cacheKeyFor(model, PROMPT_VERSION, delta.id, candSetHash);
    const cached = readCache(cacheDir, key);
    if (cached) {
      summary.cacheHits += 1;
      const causes = verifyCauses(cached.parsed.causes, notes, delta, ddragon);
      const summaryVerified = verifySummaryCites(cached.parsed.summaryCites, notes);
      resultById.set(delta.id, {
        ...delta,
        causes,
        llm: {
          skipped: false,
          summary: cached.parsed.summary,
          summaryCites: cached.parsed.summaryCites,
          summaryVerified,
        },
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
      const { parsed, usage } = await callLlmForDelta(client, model, delta, notes);
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
        promptVersion: PROMPT_VERSION,
        candidateSetHash: candSetHash,
        generatedAt: new Date().toISOString(),
        parsed,
        usage,
      });

      const causes = verifyCauses(parsed.causes, notes, delta, ddragon);
      const summaryVerified = verifySummaryCites(parsed.summaryCites, notes);
      resultById.set(delta.id, {
        ...delta,
        causes,
        llm: {
          skipped: false,
          summary: parsed.summary,
          summaryCites: parsed.summaryCites,
          summaryVerified,
        },
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
  return { deltas: merged, summary };
}
