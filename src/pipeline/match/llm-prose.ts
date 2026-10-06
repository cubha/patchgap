// src/pipeline/match/llm-prose.ts
// LLM 문장 규칙(길이·명사형 종결·완곡 어미)과 재요청·요약 수치 재검증(2026-10-06 `llm-match.ts` 분할).
import type { LlmCause, PatchNoteItem } from "../types";
import type { LlmOutput } from "./llm-schema";
import { arrowClaimsGrounded, noteNumbersOf, unsignedPercentChangeClaimsGrounded } from "./cause-factuality";

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
 * 원인 개수가 달라지면 병합을 포기한다(null). 원인은 인용 id로 짝짓는다(위치가 아니라). 요약은 `summaryCites`가
 * 그대로일 때만 새 문장을 쓴다 — 문장과 인용은 한 쌍이라 한쪽만 바꾸면 인용이 문장을 벗어난다.
 */
export function mergeRepairedProse(
  original: LlmOutput,
  repaired: LlmOutput,
  acceptSummaryCites: (summary: string, cites: readonly string[]) => boolean = () => false
): LlmOutput | null {
  if (repaired.causes.length !== original.causes.length) return null;
  const citesUnchanged =
    repaired.summaryCites.length === original.summaryCites.length &&
    repaired.summaryCites.every((id, index) => id === original.summaryCites[index]);
  // 인용이 바뀐 재요청 요약도, 새 인용이 검증을 통과하면 문장·인용을 **쌍째** 채택한다(2026-09-28, C1).
  // 원본을 지키면 긴 요약이 그대로 남았다 — ACCEPT-prose-v5 A1(요약 100자 초과 0) 회귀의 원인이다.
  const adoptSummary = citesUnchanged || acceptSummaryCites(repaired.summary, repaired.summaryCites);
  // 원인 문장은 **인용 id로** 짝짓는다(2026-09-27). 위치로 짝지으면 재요청이 순서를 바꿨을 때 문장이
  // 다른 노트의 인용을 달고 나간다 — 26.19 나피리 밴률 등 LoL 3행·TFT 4행이 그렇게 verified로 나갔다.
  // 같은 id가 여럿이면 등장 순서대로 소비한다. 짝이 없는 원인은 원본 문장을 지킨다(위반이 남더라도
  // 문장과 인용이 어긋나는 것보다 낫다 — 전자는 계측에 잡히고 후자는 화면에서 조용히 틀린다).
  const pool = new Map<string | null, string[]>();
  for (const cause of repaired.causes) {
    const texts = pool.get(cause.candidateNoteId) ?? [];
    texts.push(cause.text);
    pool.set(cause.candidateNoteId, texts);
  }
  return {
    summary: adoptSummary ? repaired.summary : original.summary,
    summaryCites: adoptSummary ? repaired.summaryCites : original.summaryCites,
    causes: original.causes.map((cause) => ({
      candidateNoteId: cause.candidateNoteId,
      confidence: cause.confidence,
      text: pool.get(cause.candidateNoteId)?.shift() ?? cause.text,
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
  /**
   * 검증 통과 원인 중 인용 노트 대상의 이름을 **하나도 말하지 않는** 문장 수(2026-09-28, C6). 문장-인용
   * 게이트(`namesOtherEntityThanCited`)는 이름이 없는 문장을 판단하지 않는다(보수적 설계) — 그 사각지대의
   * 크기를 잰다. 게이트를 넓히면 오탐이 생기므로 계측으로 둔다. 엔진이 채운다(없으면 미계측).
   */
  causeUnnamedTarget?: number;
  /** 결정론 수치 요약으로 바뀐 요약 수(C1·D1). */
  summaryDeterministic?: number;
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

/**
 * 요약의 「A→B」·변화 백분율이 후보 노트나 **지금** 델타 수치와 맞나(2026-09-29). 델타 수치는 표시 반올림
 * 경계(42.45 → 42.4/42.5)를 허용하려고 ±0.1을 더한다 — 실측으로 현 데이터 148건 중 6건이 그 경계에서만
 * 어긋났고, 옛 수치는 그보다 훨씬 크게 벗어난다.
 */
export function summaryNumbersGrounded(summaryText: string, candidates: readonly PatchNoteItem[], own: readonly number[]): boolean {
  const tolerant = own.flatMap((n) => [n, Math.round((n - 0.1) * 10) / 10, Math.round((n + 0.1) * 10) / 10]);
  return (
    arrowClaimsGrounded(summaryText, candidates, tolerant) &&
    unsignedPercentChangeClaimsGrounded(summaryText, [], [...candidates.flatMap(noteNumbersOf), ...tolerant])
  );
}
