// src/pipeline/discord/webhook.ts
// F6: 디스코드 웹훅 브리핑 — 상위 미공지 5건 + 링크를 embed(≤10개·6,000자)로 전송, 429 재시도.
// 순수 빌더(buildBriefingEmbeds/formatDeltaLine)와 얇은 전송(sendWebhook)을 분리한다 — 빌더는
// 네트워크·시간에 의존하지 않아 결정론적으로 테스트할 수 있다.

import type { DeltaRecord, DeltasFile, LlmCause } from "../types";
import { fmtCiHalf, fmtDeltaInt, fmtDeltaSec, fmtInt, fmtKst, fmtPct, fmtPp, fmtSec, itemHref, metricKind, metricLabel, positionLabel } from "../../lib/format";
import { displayStatus } from "../shared/display-status";
import { countGapEntities, countReportable } from "../shared/headline";

// ─── 디스코드 embed 제한(공식 API 제약, PLAN F6 "embed(≤10·6,000자)") ────────────────────────
const MAX_EMBEDS = 10;
const MAX_FIELDS = 25;
const MAX_FIELD_NAME_CHARS = 256;
const MAX_FIELD_VALUE_CHARS = 1024;
const MAX_TOTAL_CHARS = 6000;
/** "…외 9999건"류 접미사를 위해 필드 예산 계산 시 미리 떼어두는 여유(설명 텍스트에 이어붙임). */
const OVERFLOW_SUFFIX_RESERVE = 24;

const DEFAULT_TOP_N = 5;
/** 공지-불일치(선택) 섹션 — PLAN 배치 지시 "그 다음 공지-불일치 상위 3(선택)". */
const INCONSISTENT_EXTRA_COUNT = 3;
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

/**
 * --accent 토큰 값의 정수 변환(design-lint-ignore: 문서 주석 예시). 디스코드 embed.color는 0xRRGGBB 정수만 허용해 CSS 변수를
 * 쓸 수 없다 — CLAUDE.md 디자인 토큰 규칙의 정당한 예외.
 */
const ACCENT_COLOR = 0x38bdf8; // design-lint-ignore: 디스코드 embed.color는 정수만 허용 — var(--accent) 불가

export interface DiscordEmbedField {
  name: string;
  value: string;
}

export interface DiscordEmbedFooter {
  text: string;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  url: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: DiscordEmbedFooter;
}

export interface DiscordWebhookPayload {
  username: string;
  embeds: DiscordEmbed[];
}

export interface BuildBriefingOptions {
  /** 브리핑 항목 링크의 기준 URL(끝에 슬래시 없이, 예: "https://patchgap.vercel.app"). */
  siteUrl: string;
  /** 미공지 상위 몇 건을 필드로 노출할지. 기본 5(PLAN F6 "상위 미공지 5건"). */
  topN?: number;
  /**
   * 헤드라인 "패치노트는 N개 엔티티를 말했고..."의 N(패치노트가 언급한 고유 챔피언·아이템
   * 엔티티 수 — 시스템/기타 노트 줄 수 아님, ST-11 `countRelevantNoteEntities`와 동일 규칙) —
   * deltas 파일 자체엔 없는 값이라 호출부(run-notify.ts `loadNoteCount`)가 notes/{patch}.json을
   * 파싱해 주입한다. 없으면(null/undefined) 헤드라인에서 이 구간을 생략한다.
   */
  noteCount?: number | null;
  /** footer "n={nFrom}/{nTo}"의 매치 수 — 마찬가지로 deltas 파일에 없어 호출부가 summary.json에서 읽어 주입한다. */
  matchCounts?: { from: number | null; to: number | null };
}

/** 챔피언 포지션별 행(id 4세그먼트: champion:{ddragonId}:{pos}:{metric})은 entityName에 포지션이
 * 없으므로 id에서 뽑아 붙인다. 그 외(전체 스코프 챔피언·아이템·라인·오브젝트·매치평균)는 entityName 그대로. */
function entityLabel(d: DeltaRecord): string {
  const parts = d.id.split(":");
  if (d.entityType === "champion" && parts.length === 4) {
    return `${d.entityName}(${positionLabel(parts[2])})`;
  }
  return d.entityName;
}

/** LlmCause 목록에서 표시할 원인 1줄을 고른다. 검증된(candidateNoteId가 후보셋에 실존 확인된)
 * 원인이 있으면 그 텍스트, 있지만 전부 미검증이면 "근거 미확인"(무근거=회색 원칙), 아예 없으면 null
 * (원인 줄 자체를 생략). */
function causeText(causes: LlmCause[]): string | null {
  if (causes.length === 0) return null;
  const verified = causes.find((c) => c.verified);
  return verified ? verified.text : "근거 미확인";
}

/**
 * 델타 1건의 "{before} → {after} ({Δ}, CI ±)" 부분을 순수 포맷한다(URL·원인 줄 제외 — buildField가
 * 이어붙인다). metric 종류별로 lib/format 헬퍼를 재사용한다. before/after/delta 중 하나라도 null이면
 * (버그가 아니라면 이 파이프라인에서 실제로 나오지 않아야 하지만 방어적으로) "데이터 없음"을 반환한다.
 */
export function formatDeltaLine(d: DeltaRecord): string {
  if (d.before === null || d.after === null || d.delta === null) {
    return "데이터 없음";
  }

  const kind = metricKind(d.metric);
  if (kind === "pp") {
    const ciHalf = fmtCiHalf([d.ci[0] * 100, d.ci[1] * 100]);
    return `${fmtPct(d.before)} → ${fmtPct(d.after)} (${fmtPp(d.delta)}, CI ${ciHalf})`;
  }
  if (kind === "gold") {
    const ciHalf = fmtCiHalf(d.ci, 0);
    return `${fmtInt(d.before)} → ${fmtInt(d.after)} (${fmtDeltaInt(d.delta)}, CI ${ciHalf})`;
  }
  const ciHalf = fmtCiHalf(d.ci, 0);
  return `${fmtSec(d.before)} → ${fmtSec(d.after)} (${fmtDeltaSec(d.delta)}, CI ${ciHalf})`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

/** 미공지/공지-불일치 델타 1건 → embed 필드 1개. inconsistent=true면 이름 앞에 경고 표시를 붙여
 * 두 섹션(미공지 상위 N · 공지-불일치 상위 3)을 시각적으로 구분한다. */
function buildField(d: DeltaRecord, siteUrl: string, inconsistent: boolean): DiscordEmbedField {
  const name = `${inconsistent ? "⚠ " : ""}${entityLabel(d)} · ${metricLabel(d.metric)}`;
  const url = `${siteUrl}${itemHref(d.id)}`;
  const cause = causeText(d.causes);
  const base = `${formatDeltaLine(d)} · [근거](${url})`;
  const value = cause ? `${base}\n${cause}` : base;
  return { name: truncate(name, MAX_FIELD_NAME_CHARS), value: truncate(value, MAX_FIELD_VALUE_CHARS) };
}

function buildFooterText(
  matchCounts: BuildBriefingOptions["matchCounts"],
  generatedAtIso: string
): string {
  const nFrom = matchCounts?.from != null ? fmtInt(matchCounts.from) : "?";
  const nTo = matchCounts?.to != null ? fmtInt(matchCounts.to) : "?";
  return `patchgap · n=${nFrom}/${nTo} · ${fmtKst(generatedAtIso)}`;
}

/**
 * deltas 파일 → embed 배열(항상 1개 — 필드 ≤25·문자 ≤6,000 제한 안에서 미공지 상위 topN +
 * 공지-불일치 상위 3을 한 embed에 담는다. PLAN F6 "embed(≤10·6,000자)"의 ≤10은 이 구현이 embed를
 * 1개만 만들어 구조적으로 항상 만족한다).
 *
 * `deltas.rows`는 verdict.ts writeDeltas가 이미 `sortDeltas`(status 우선순위 → |delta| 내림차순)
 * 적용해 기록한 상태를 전제한다 — 이 함수는 별도로 재정렬하지 않고 `status==="unannounced"`인
 * 행을 앞에서부터 자르는 것만으로 "상위 N건"을 얻는다.
 */
export function buildBriefingEmbeds(deltas: DeltasFile, options: BuildBriefingOptions): DiscordEmbed[] {
  const { from, to, qAlpha, generatedAt } = deltas.meta;

  const unannouncedRows = deltas.rows.filter((r) => r.status === "unannounced");
  // S11(2026-09-18, 사용자 확정 CF-3) — **웹과 같은 표시 키로 거른다.**
  // 이전엔 `status === "announced-inconsistent"`만 보고 상위 3건을 방송했는데, 그 상태값은
  // 판정 엔진이 "유의 + 방향 반대"와 "비유의"와 "유의하나 바닥 미달"을 **한데 넣는** 값이다.
  // 실측: 두 패치 모두 방송된 3건 중 **2건이 사이트에서는 회색으로 강등된 행**이었다
  // (26.18 마스터 이 +8.43%p q=0.251 · 에코 −5.58%p / 26.17 녹턴 · 럭스). 즉 웹은 "관측 미확인"
  // 이라 하고 디스코드는 같은 항목을 "공지-불일치"로 알렸다 — A4 어휘 불일치를 웹에서만 닫으면
  // 모순이 이 표면으로 이사할 뿐이라, 같은 `displayStatus`를 부른다(판정 엔진은 불변).
  const inconsistentRows = deltas.rows.filter(
    (r) => displayStatus(r, qAlpha) === "announced-anomaly"
  );
  // 헤드라인 두 수치는 **웹 히어로와 같은 모듈**이 센다(2026-09-20 실측 결함 수정).
  // 이전엔 여기서 `isSignificantDelta`로 따로 셌고, 2026-09-19에 히어로만 `isReportableRecord`로
  // 옮겨가면서 같은 패치를 두고 사이트는 62개·29건, 디스코드는 403개·31건을 말하게 됐다
  // (403 중 321건은 어느 목록에도 렌더되지 않는 바닥 미달, 31 vs 29는 행 수 vs 엔티티 수).
  // 디스코드 방을 공개하면 심사자가 두 수치를 나란히 보게 되므로, 세는 곳을 하나로 합쳤다.
  const significantCount = countReportable(deltas.rows, qAlpha);
  const gapEntityCount = countGapEntities(deltas.rows);

  return assembleBriefing<DeltaRecord>(
    {
      from,
      to,
      generatedAt,
      unannounced: unannouncedRows,
      anomalies: inconsistentRows,
      significantCount,
      gapEntityCount,
      buildField,
    },
    options
  );
}

/**
 * 게임마다 다른 것만 담는 봉투. **문구·예산·필드 상한·오버플로 표기는 담기지 않는다** —
 * 그것들은 `assembleBriefing`이 소유하고, 그래서 게임이 늘어도 브리핑이 서로 다른 말을 하지 않는다
 * (`loadGameSource` 주석의 "임베드 빌더를 게임별로 나누지 않는다"와 같은 이유).
 *
 * 타입을 `DeltaRecord`로 고정하지 않는 이유는 PUBG다 — 그쪽 행은 `delta`·`ci`·`q`가 아니라
 * `relChange`·`relCi`를 갖고 유의성은 `classify()`가 이미 status에 접어넣었다. 억지로 `DeltaRecord`
 * 모양으로 바꾸면 없는 `q`를 지어내야 하고, `relChange`(비율)가 `delta`(%p) 자리에 들어가 화면과
 * 다른 숫자를 방송하게 된다.
 */
export interface BriefingSource<T> {
  from: string;
  to: string;
  generatedAt: string;
  /** 미공지 섹션 후보 — 이미 정렬된 순서를 전제한다(앞에서부터 자른다). */
  unannounced: readonly T[];
  /** "공지 · 이상 관측" 섹션 후보. */
  anomalies: readonly T[];
  /** 헤드라인 "통계는 M개 변화를 말합니다"의 M — 화면과 **같은 술어로** 센 값이어야 한다. */
  significantCount: number;
  /** 헤드라인 "미공지 N건"의 N — 행이 아니라 엔티티 수. */
  gapEntityCount: number;
  buildField(row: T, siteUrl: string, inconsistent: boolean): DiscordEmbedField;
}

/** 봉투 → embed 1개. 게임 무관 — 여기에 게임 이름이 등장하면 분리가 실패한 것이다. */
export function assembleBriefing<T>(source: BriefingSource<T>, options: BuildBriefingOptions): DiscordEmbed[] {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const { from, to, generatedAt, unannounced: unannouncedRows, significantCount, gapEntityCount } = source;

  const topUnannounced = unannouncedRows.slice(0, topN);
  const topInconsistent = source.anomalies.slice(0, INCONSISTENT_EXTRA_COUNT);

  // ST-11(홈 화면 HeroSummary) "패치노트는 N항목을 말했고, 통계는 M개 변화를 말합니다"와 문구를
  // 통일한다(코디네이터 후속 지시, 2026-09-05) — noteCount 없으면(파일 부재) 첫 절을 생략한다
  // (무근거로 지어내지 않음).
  const headline =
    options.noteCount != null
      ? `패치노트는 ${fmtInt(options.noteCount)}개 엔티티를 말했고, 통계는 ${fmtInt(significantCount)}개 변화를 말합니다`
      : `통계는 ${fmtInt(significantCount)}개 변화를 말합니다`;
  let description = `${headline} · 미공지 ${fmtInt(gapEntityCount)}건`;
  if (unannouncedRows.length === 0) {
    description += " · 게이트를 통과한 미공지 변화 없음";
  }

  const title = `patchgap · ${from} → ${to}`;
  const footerText = buildFooterText(options.matchCounts, generatedAt);

  const candidateFields = [
    ...topUnannounced.map((d) => source.buildField(d, options.siteUrl, false)),
    ...topInconsistent.map((d) => source.buildField(d, options.siteUrl, true)),
  ];

  // 필드를 채우기 전에 "…외 k건" 접미사용 예산을 먼저 떼어둔다(advisor 지적 — 다 채운 뒤에 뒤늦게
  // 붙이면 총 문자수 상한을 넘길 수 있다).
  let budget = MAX_TOTAL_CHARS - title.length - description.length - footerText.length - OVERFLOW_SUFFIX_RESERVE;
  const fields: DiscordEmbedField[] = [];
  for (const field of candidateFields) {
    if (fields.length >= MAX_FIELDS) break;
    const cost = field.name.length + field.value.length;
    if (cost > budget) break;
    fields.push(field);
    budget -= cost;
  }

  const omitted = candidateFields.length - fields.length;
  if (omitted > 0) {
    description += ` · …외 ${omitted}건`;
  }

  const embed: DiscordEmbed = {
    title,
    description,
    url: options.siteUrl,
    color: ACCENT_COLOR,
    fields,
    footer: { text: footerText },
  };

  // 항상 단일 embed — MAX_EMBEDS는 "구조적으로 이 이하"임을 문서화하는 상수(분리 로직은 없음).
  return [embed].slice(0, MAX_EMBEDS);
}

export interface SendWebhookOptions {
  /** 테스트 주입용. 기본값 전역 fetch. */
  fetchImpl?: typeof fetch;
  /** 테스트 주입용 sleep. 기본값 실제 setTimeout 기반 대기. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** 429·5xx 공통 총 시도 횟수 상한(하나의 attempt 카운터를 공유 — 429 실패 후 5xx가 나도 같은
   * 예산을 쓴다. 재시도 횟수가 아니라 "총 시도" — attempt번째 실패가 이 값과 같으면 그 자리에서
   * throw). 기본 3. */
  maxRetries?: number;
}

export interface SendWebhookResult {
  status: number;
  /** 성공까지 소요된 실패 시도 횟수(성공한 시도 자체는 포함하지 않음). */
  retries: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** attempt;
}

function truncateForError(s: string): string {
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

/** 429 응답의 대기 시간을 구한다: JSON 바디의 `retry_after`(초, 소수 허용) 우선 → 없으면
 * `Retry-After` 헤더(초) → 그마저 없으면 지수 백오프. 바디 파싱 실패는 조용히 다음 단계로 넘어간다
 * (디스코드가 항상 JSON 바디를 주는 건 아니라서). */
async function resolve429Wait(res: Response, attempt: number): Promise<number> {
  try {
    const data = (await res.json()) as { retry_after?: number };
    if (typeof data.retry_after === "number" && Number.isFinite(data.retry_after)) {
      return data.retry_after * 1000;
    }
  } catch {
    // JSON이 아니거나 파싱 실패 — 헤더/백오프로 폴백.
  }
  const header = res.headers.get("Retry-After");
  if (header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  return backoffMs(attempt);
}

/**
 * 디스코드 웹훅에 embed 페이로드를 POST한다. 200/204=성공. 429=바디/헤더의 대기시간만큼 자고
 * 재시도. 5xx=지수 백오프 재시도. 그 외 4xx(429 제외)=즉시 throw. **웹훅 URL은 비밀이므로 어떤
 * 에러 메시지에도 `url`을 절대 포함하지 않는다**(riot-client.ts의 maskedUrl과 달리, 이쪽은 URL
 * 자체가 토큰을 담고 있어 마스킹이 아니라 완전 배제가 필요하다).
 */
export async function sendWebhook(
  url: string,
  payload: DiscordWebhookPayload,
  options: SendWebhookOptions = {}
): Promise<SendWebhookResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 204) {
      return { status: res.status, retries: attempt - 1 };
    }

    if (res.status === 429) {
      if (attempt >= maxRetries) {
        throw new Error("discord webhook: 429 retry budget exhausted");
      }
      const waitMs = await resolve429Wait(res, attempt - 1);
      await sleepImpl(waitMs);
      continue;
    }

    if (res.status >= 500) {
      if (attempt >= maxRetries) {
        throw new Error(`discord webhook: 5xx retry budget exhausted (status=${res.status})`);
      }
      await sleepImpl(backoffMs(attempt - 1));
      continue;
    }

    // 그 외 4xx — 즉시 throw. 바디를 읽되(진단용) 실패해도 무시한다.
    let detail = "";
    try {
      detail = truncateForError(await res.text());
    } catch {
      detail = "";
    }
    throw new Error(`discord webhook: request failed (status=${res.status})${detail ? `: ${detail}` : ""}`);
  }
}
