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
import type { GameLlmProfile } from "./llm-profile";

export { LLM_MODEL, PROMPT_VERSION } from "./llm-config";
import { LLM_MODEL, PROMPT_VERSION } from "./llm-config";
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

export type LlmOutput = z.infer<typeof OutputSchema>;

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

function buildSystemPrompt(profile: GameLlmProfile, notes: readonly PatchNoteItem[]): string {
  return `${profile.systemInstructions}\n\n후보 패치노트 항목 목록(JSON):\n${serializeCandidates(notes)}`;
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
  profile: GameLlmProfile,
  delta: DeltaRecord,
  candidates: readonly PatchNoteItem[],
  /** 길이 재요청 문구(1회 한정). 있으면 사용자 메시지 뒤에 붙는다 — 시스템 프롬프트는 그대로라
   * 캐시 프리픽스가 깨지지 않는다. */
  repairNote?: string
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

/**
 * LLM이 반환한 causes를 후보셋 검증한다 — 존재하지 않는 id·자기 엔티티 참조는 candidateNoteId를
 * null로, verified를 false로 폐기(text/confidence는 회색 표기용으로 보존).
 */
export function verifyCauses(
  rawCauses: LlmOutput["causes"],
  candidates: readonly PatchNoteItem[],
  delta: DeltaRecord,
  profile: GameLlmProfile
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
    // 2026-09-19: 다른 게임 모드(LoL 클래식·아수라장·아레나)의 노트는 SR 관측의 원인이 될 수 없다.
    // 실측으로 26.16→26.17 쌍의 verified 원인 453건 중 282건이 모드 노트를 인용하고 있었다
    // ("클래식 피오라의 공격 속도 계수 상향으로 탑 결투 구도가…" — 라이브 협곡에 없던 변경).
    // 후보 풀 자체를 거르면 candidateSetHash가 바뀌어 LLM 캐시가 전량 무효가 되므로, 교정은
    // **검증 지점**에서 한다(BRAINTRUST-root-fix-2026-09-19.md §4).
    if (note && !profile.isCitable(note)) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    if (note && profile.isSameEntity(note, delta)) {
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
  candidates: readonly PatchNoteItem[],
  profile: GameLlmProfile
): boolean {
  if (summaryCites.length === 0) return true;
  // 존재 + core. 모드 노트를 근거로 쓴 요약은 본문색으로 단언할 수 없다(위 verifyCauses와 같은 이유).
  const coreIds = new Set(candidates.filter((note) => profile.isCitable(note)).map((note) => note.id));
  return summaryCites.every((id) => coreIds.has(id));
}

/** 완곡 종결 어미 — 추론 문장에서 정당하지만, 두어 종에 몰리면 그것이 "AI스러움"의 실체가 된다. */
const HEDGE_ENDINGS = [
  "수 있습니다",
  "가능성이 있습니다",
  "보입니다",
  "것으로 추정됩니다",
  "일 수 있습니다",
  "듯합니다",
];

/**
 * 길이 상한 — **프롬프트 규칙 9와 같은 값을 쓴다.** 하나로 묶어 두었더니 요약을 80자 기준으로
 * 세면서 프롬프트는 100자를 지시하는 어긋남이 생겼다(독립 채점 K1-7 지적: 집계 수치가 프롬프트
 * 상한과 다른 것을 말한다). 규칙과 계측이 같은 숫자를 보게 분리한다.
 */
export const SUMMARY_MAX_CHARS = 100;
export const CAUSE_MAX_CHARS = 80;

/** 위생 집계 입력 — 완곡 표현의 정당성은 confidence에 달려 있으므로 텍스트만으로는 셀 수 없다. */
export interface ProseCauseEntry {
  text: string;
  confidence: LlmCause["confidence"];
}

/**
 * 재요청이 필요한 문장 수(길이 초과 + 명사형 종결). 0이면 재요청하지 않는다.
 *
 * 2026-09-19 최종 채점 K1-7로 **길이에서 문장 위생 전반으로 넓혔다**(이전 이름
 * `countLengthViolations`). 길이만 보던 조건은 명사형 종결 11건을 전부 통과시켰다.
 */
export function countProseViolations(parsed: LlmOutput): number {
  const summaryOver = parsed.summary.length > SUMMARY_MAX_CHARS ? 1 : 0;
  const causeBad = parsed.causes.filter(
    (cause) => cause.text.length > CAUSE_MAX_CHARS || isNounEnding(cause.text)
  ).length;
  return summaryOver + causeBad;
}

/**
 * 재요청 문구. **어느 문장이 무엇을 어겼는지 숫자와 함께 알려준다** — v4에서 배운 것이 "어림수보다
 * 숫자"였는데, 재요청은 그보다 한 걸음 더 나아가 *이 응답의* 실제 위반을 짚어 줄 수 있다.
 * (이전 이름 `buildLengthRepairNote` — 대상이 길이만이 아니게 되어 바꿨다.)
 */
/**
 * 재요청 응답에서 **문장만** 가져오고 근거(인용·신뢰도)는 원본을 지킨다.
 *
 * 왜 필요한가(2026-09-19 재판정): 재요청 응답을 통째로 채택했더니 인용 7행·confidence 3행이
 * 바뀌고 `champion:Pyke:banRate`의 판정이 unannounced → indirect-effect로 뒤집혔다(3단 재분류가
 * 원인 문장을 보기 때문이다). 계획은 "판정 엔진 불변 · 전부 표시·산문 계층"이었고 재요청 문구도
 * "candidateNoteId와 confidence는 그대로 두세요"라고 적고 있었지만 **아무것도 그것을 강제하지
 * 않았다**. 문구는 계약이 아니다 — 코드가 계약이다.
 *
 * 원인 개수가 달라지면 짝을 지을 수 없으므로 병합을 포기한다(null). 요약은 `summaryCites`가
 * 그대로일 때만 새 문장을 쓴다 — 문장과 인용은 한 쌍이라 한쪽만 바꾸면 인용이 문장을 벗어난다.
 */
export function mergeRepairedProse(original: LlmOutput, repaired: LlmOutput): LlmOutput | null {
  if (repaired.causes.length !== original.causes.length) return null;
  const citesUnchanged =
    repaired.summaryCites.length === original.summaryCites.length &&
    repaired.summaryCites.every((id, index) => id === original.summaryCites[index]);
  return {
    summary: citesUnchanged ? repaired.summary : original.summary,
    summaryCites: original.summaryCites,
    causes: original.causes.map((cause, index) => ({
      candidateNoteId: cause.candidateNoteId,
      confidence: cause.confidence,
      text: repaired.causes[index].text,
    })),
  };
}

export function buildProseRepairNote(parsed: LlmOutput): string {
  const lines: string[] = ["직전 답의 문장 규칙 위반을 고쳐 **같은 내용으로** 다시 답하세요."];
  if (parsed.summary.length > SUMMARY_MAX_CHARS) {
    lines.push(`- summary가 ${parsed.summary.length}자입니다. ${SUMMARY_MAX_CHARS}자 이하로 줄이세요.`);
  }
  parsed.causes.forEach((cause, index) => {
    if (cause.text.length > CAUSE_MAX_CHARS) {
      lines.push(`- causes[${index}]가 ${cause.text.length}자입니다. ${CAUSE_MAX_CHARS}자 이하로 줄이세요.`);
    }
    if (isNounEnding(cause.text)) {
      lines.push(
        `- causes[${index}]가 명사로 끝납니다("${cause.text.trim().slice(-12)}"). ` +
          "합쇼체 문장으로 바꾸세요(예: \"…밀린 영향.\" → \"…밀렸습니다.\")."
      );
    }
  });
  lines.push("수치와 인과는 남기고 수식어·부연부터 버리세요. candidateNoteId와 confidence는 그대로 두세요.");
  return lines.join("\n");
}

export interface ProseHygieneStats {
  summaryCount: number;
  summaryOverLength: number;
  summaryHedged: number;
  maxSummaryLength: number;
  causeCount: number;
  causeOverLength: number;
  causeHedged: number;
  /**
   * confidence가 high·medium인데 완곡 종결로 끝난 원인 문장 수(2026-09-19 v5). **이것이 항목7의
   * 진짜 계측점이다** — 완곡 표현 자체는 low 문장에서 정당하므로 `causeHedged` 총량은 0이 목표가
   * 아니다. 근거가 분명한 문장까지 흐린 경우만 결함이다.
   */
  causeHedgedConfident: number;
  /**
   * 합쇼체로 끝나지 않은 원인 문장 수(2026-09-19, 최종 채점 K1-7). v5 산출에서 11건이
   * "…밀린 영향."처럼 명사로 끝나 같은 카드의 다른 문장과 문체가 섞였다. 길이·완곡만 세던
   * 게이트가 그것을 못 봤다 — `ACCEPT-prose-v5`가 위험으로 적어 둔 바로 그 형태다.
   */
  causeNounEnding: number;
}

/**
 * 합쇼체로 끝나지 않는가 — 이 프로젝트의 산문은 전부 합쇼체이므로 명사형 종결은 문체 혼입이다.
 *
 * 왜 프롬프트가 아니라 여기서 보는가: 규칙을 더하려면 `PROMPT_VERSION`을 올려야 하고, 그러면
 * 캐시 236건이 전량 무효가 되어 **지금 통과하는 문장까지 전부 다시 굴린다**(새 위반이 다른 자리에
 * 생길 수 있다). 결함은 230건 중 13건이므로 그 13건만 고치는 것이 옳다.
 */
export function isNounEnding(text: string): boolean {
  // 말미 구두점에 닫는 괄호·따옴표까지 포함한다(2026-09-19 재판정 지적): 그전에는 `.!?`만 벗겨
  // "…했습니다(26.18 기준)."처럼 괄호주로 끝나는 정상 문장을 명사형으로 잘못 셌다. 산출물에는
  // 그런 요약이 1건 있었고 b24d22b에도 있었으므로 이번 회귀는 아니지만, 오탐은 **불필요한
  // 재요청을 부른다** — 재요청이 근거를 건드릴 수 있다는 것을 이 라운드에 배웠으므로 그냥 둘 수 없다.
  // 말미 구두점뿐 아니라 **말미 괄호주 전체**를 벗긴다. 구두점만 벗기면
  // "…밀렸습니다(26.18 기준)."이 "…기준"으로 끝나 명사형으로 잡힌다.
  let trimmed = text.trim();
  for (;;) {
    const next = trimmed
      .replace(/[.!?。\s"'”’」』]+$/u, "")
      .replace(/[(（[［][^()（）[\]［］]*[)）\]］]$/u, "");
    if (next === trimmed) break;
    trimmed = next;
  }
  if (trimmed.length === 0) return false;
  return !/[다요]$/.test(trimmed);
}

function isHedged(text: string): boolean {
  const trimmed = text.trim().replace(/[.!?]+$/, "");
  return HEDGE_ENDINGS.some((ending) => trimmed.endsWith(ending));
}

/**
 * 산출 문장의 길이·종결 위생을 집계한다(2026-09-19, 항목7).
 *
 * 문구로는 닫히지 않는다는 것이 실측이다: "80자 안팎"이 프롬프트에 **있는데도** 요약 113건 중
 * 82건(72%)이 초과했고, 숫자로 못박은 v4에서도 2~4%가 남았다. 그래서 v5는 레버를 바꿨다 —
 * 길이는 호출부의 1회 한정 재요청(`needsLengthRepair`)이 닫고, 완곡 표현은 confidence와 묶어
 * (프롬프트 규칙 10) 줄인다. 이 함수는 그 두 레버가 실제로 들었는지 **매 실행 측정**한다.
 * 길이를 이유로 문장을 회색 처리하지는 않는다 — 근거 있는 문장을 숨기는 것이 더 나쁘다.
 */
export function summarizeProseHygiene(
  entries: readonly { summary: string | null; causes: readonly ProseCauseEntry[] }[]
): ProseHygieneStats {
  const stats: ProseHygieneStats = {
    summaryCount: 0,
    summaryOverLength: 0,
    summaryHedged: 0,
    maxSummaryLength: 0,
    causeCount: 0,
    causeOverLength: 0,
    causeHedged: 0,
    causeHedgedConfident: 0,
    causeNounEnding: 0,
  };
  for (const entry of entries) {
    if (entry.summary !== null && entry.summary.length > 0) {
      stats.summaryCount += 1;
      if (entry.summary.length > SUMMARY_MAX_CHARS) stats.summaryOverLength += 1;
      if (isHedged(entry.summary)) stats.summaryHedged += 1;
      stats.maxSummaryLength = Math.max(stats.maxSummaryLength, entry.summary.length);
    }
    for (const cause of entry.causes) {
      stats.causeCount += 1;
      if (cause.text.length > CAUSE_MAX_CHARS) stats.causeOverLength += 1;
      if (isHedged(cause.text)) {
        stats.causeHedged += 1;
        if (cause.confidence !== "low") stats.causeHedgedConfident += 1;
      }
      if (isNounEnding(cause.text)) stats.causeNounEnding += 1;
    }
  }
  return stats;
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
  profile: GameLlmProfile,
  options: LlmMatchOptions = {}
): Promise<LlmMatchResult> {
  const maxDeltas = options.maxDeltas ?? DEFAULT_MAX_DELTAS;
  const maxTotalCalls = options.maxTotalCalls ?? DEFAULT_MAX_TOTAL_CALLS;
  const cacheDir = options.cacheDir ?? llmCacheDir();
  const model = options.model ?? LLM_MODEL;

  const candidates = profile.candidatesOf(notes);
  const candSetHash = candidateSetHash(serializeCandidates(candidates));

  const targets = deltas
    .filter((d) => d.status === "unannounced" || d.status === "announced-inconsistent")
    .slice(0, maxDeltas);
  const targetIds = new Set(targets.map((d) => d.id));

  const summary: LlmRunSummary = {
    calls: 0,
    cacheHits: 0,
    skipped: 0,
    proseRepairs: 0,
    usage: emptyUsage(),
    prose: summarizeProseHygiene([]),
  };
  const client = options.client ?? new Anthropic();
  const resultById = new Map<string, DeltaRecord>();

  for (const delta of targets) {
    const key = cacheKeyFor(model, PROMPT_VERSION, delta.id, candSetHash);
    const cached = readCache(cacheDir, key);
    if (cached) {
      summary.cacheHits += 1;
      let cachedParsed = cached.parsed;

      // 캐시 적중에도 문장 규칙을 적용한다(2026-09-19 최종 채점 K1-7). **이것이 없으면 이미 캐시된
      // 위반은 영원히 고쳐지지 않는다** — 재생성해도 캐시를 그대로 읽기 때문이다. 프롬프트를 고쳐
      // PROMPT_VERSION을 올리면 236건이 전량 무효가 되지만, 이 경로는 위반한 13건만 다시 묻고
      // 결과를 **같은 키에 되쓴다**. 길이 재요청이 이미 v5 키에 되쓰고 있으므로 새 규약은 아니다.
      if (countProseViolations(cachedParsed) > 0 && summary.calls < maxTotalCalls) {
        try {
          summary.calls += 1;
          summary.proseRepairs += 1;
          const repaired = await callLlmForDelta(
            client,
            model,
            profile,
            delta,
            candidates,
            buildProseRepairNote(cachedParsed)
          );
          addUsage(summary.usage, repaired.usage);
          const merged =
            repaired.parsed === null ? null : mergeRepairedProse(cachedParsed, repaired.parsed);
          if (merged !== null && countProseViolations(merged) < countProseViolations(cachedParsed)) {
            cachedParsed = merged;
            writeCache(cacheDir, key, { ...cached, generatedAt: new Date().toISOString(), parsed: cachedParsed });
          }
        } catch {
          // 재요청 실패는 치명적이지 않다 — 캐시된 원문을 그대로 쓴다(위생 집계가 그것을 센다).
        }
      }

      const causes = verifyCauses(cachedParsed.causes, candidates, delta, profile);
      const summaryVerified = verifySummaryCites(cachedParsed.summaryCites, candidates, profile);
      resultById.set(delta.id, {
        ...delta,
        causes,
        llm: {
          skipped: false,
          summary: cachedParsed.summary,
          summaryCites: cachedParsed.summaryCites,
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
      const first = await callLlmForDelta(client, model, profile, delta, candidates);
      const usage = emptyUsage();
      addUsage(usage, first.usage);
      let parsed = first.parsed;

      // 길이 재요청(v5, 1회 한정) — 프롬프트 문구로는 2~4%가 남는다는 것이 v4의 실측이다. 상한을
      // 넘긴 응답에 대해서만 "몇 자인지"를 짚어 다시 묻고, **위반이 더 적은 쪽**을 택한다. 응답을
      // 통째로 고르는 이유: summary와 summaryCites는 한 쌍이라 섞으면 인용이 문장과 어긋난다.
      if (parsed !== null && countProseViolations(parsed) > 0 && summary.calls < maxTotalCalls) {
        summary.calls += 1;
        summary.proseRepairs += 1;
        const repaired = await callLlmForDelta(
          client,
          model,
          profile,
          delta,
          candidates,
          buildProseRepairNote(parsed)
        );
        addUsage(usage, repaired.usage);
        const merged = repaired.parsed === null ? null : mergeRepairedProse(parsed, repaired.parsed);
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
        promptVersion: PROMPT_VERSION,
        candidateSetHash: candSetHash,
        generatedAt: new Date().toISOString(),
        parsed,
        usage,
      });

      const causes = verifyCauses(parsed.causes, candidates, delta, profile);
      const summaryVerified = verifySummaryCites(parsed.summaryCites, candidates, profile);
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
      causes: record.causes.map((cause) => ({ text: cause.text, confidence: cause.confidence })),
    }))
  );
  return { deltas: merged, summary };
}
