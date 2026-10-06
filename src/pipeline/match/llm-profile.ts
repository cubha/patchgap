// src/pipeline/match/llm-profile.ts
// LLM 2단의 **게임별 부분**을 한 자리에 모은 계약(2026-09-20).
//
// **왜 분리하는가.** `llm-match.ts`는 배치·캐시·검증·문장 위생을 소유하는 게임 중립 엔진인데,
// 그 안에 리그 오브 레전드 전용 문자열 네 덩이가 박혀 있었다: 시스템 지시문 첫 줄("당신은 리그
// 오브 레전드 패치 분석가입니다"), 지표 한국어 라벨(`METRIC_KO`), 포지션 힌트(`POSITION_KO`),
// 자기참조 판정(`resolvesToSameEntity` — Data Dragon 조회). TFT를 붙이면서 이것들을 그대로 두면
// TFT 델타가 "리그 오브 레전드 분석가"에게 "픽률"이라는 이름으로 전달된다.
//
// **캐시 불변이 설계 제약이다.** 캐시 키는 `sha256(model|PROMPT_VERSION|deltaId|candSetHash)`라
// **프롬프트 본문이 들어가지 않는다** — 즉 프롬프트가 바뀌어도 캐시는 조용히 히트한다. 캐시
// 히트율로는 프롬프트 드리프트를 잡을 수 없으므로, LoL 프로필이 렌더하는 문자열이 리팩터 전과
// **바이트 단위로 같은지**를 golden 테스트가 직접 본다(`__tests__/llm-profile-lol.test.ts`).
// 실제로 866건을 날리는 축은 `candidatesOf`가 만드는 후보셋이며, 그쪽은 커밋된 캐시 파일에 적힌
// `candidateSetHash` 실측값을 앵커로 삼아 고정한다.

import type { DeltaRecord, LlmCause, MatchStatus, PatchNoteItem } from "../types";
import { displayStatus } from "../shared/display-status";
import { isCosmeticNote } from "../shared/cosmetic-note";
import { isCoreNote } from "../shared/mode-scope";

/**
 * 엔진이 델타에서 **직접** 읽는 것의 전부(2026-09-23). 나머지 필드는 전부 프로필이 읽는다.
 *
 * **왜 좁히나**: PUBG 델타(`PubgDeltaRow`)는 `DeltaRecord`가 아니다 — 지표가 `pickupShare`
 * 하나뿐이고 q도 라인도 없다. 그 한 줄을 붙이자고 `DeltaMetric`·`DeltaEntityType` 유니온을
 * 넓히면 `METRIC_KIND`·`EFFECT_SIZE_FLOORS` 같은 전수 `Record`가 전부 PUBG 전용 칸을 갖게 된다
 * (LoL 화면이 읽지도 않을 칸이다). 엔진이 실제로 보는 것이 `id`·`status`뿐이므로 거기까지만
 * 요구하는 쪽이 이 모듈의 머리말("게임 중립 엔진")에 맞는다.
 */
export interface LlmDelta {
  readonly id: string;
  readonly status: MatchStatus;
  /** 엔진이 **쓰는** 자리(읽지는 않는다). 위생 집계만 되읽으므로 선택 필드로 둔다. */
  readonly causes?: readonly LlmCause[];
  readonly llm?: {
    skipped: boolean;
    reason?: string;
    summary?: string;
    summaryCites?: string[];
    summaryVerified?: boolean;
    /** 결정론 수치 요약으로 바뀌었다(C1·D1) — `DeltaRecord.llm.summaryDeterministic`과 같은 계약. */
    summaryDeterministic?: boolean;
  };
}

/**
 * 한 게임의 LLM 2단 어휘. 엔진(`llm-match.ts`)은 이 인터페이스 너머를 모른다.
 *
 * 델타 타입이 기본값(`DeltaRecord`)이라 LoL·TFT 프로필은 그대로다.
 */
export interface GameLlmProfile<TDelta extends LlmDelta = DeltaRecord> {
  /** 로그·진단용 식별자(`"lol"`·`"tft"`). 프롬프트에도 캐시 키에도 들어가지 않는다. */
  readonly game: string;

  /** 시스템 프롬프트의 지시문 전문. 후보 목록은 엔진이 뒤에 붙인다. */
  readonly systemInstructions: string;

  /**
   * 이 게임 지시문의 개정 태그(2026-09-28, C5). 캐시 키가 지시문 본문을 보지 않으므로 지시문을 고치면
   * **같은 파일에서** 이 값을 올린다 — `__tests__/prompt-golden.test.ts`가 태그를 안 올린 수정을 잡는다.
   * 비어 있으면 키는 이 속성이 생기기 전과 같다(캐시 보존).
   */
  readonly promptRevision?: string;

  /**
   * LLM에게 **보여줄** 후보만 남긴다. 이 결과가 `candidateSetHash`를 결정하므로,
   * 여기를 건드리면 그 게임의 LLM 캐시가 전량 무효가 된다.
   */
  candidatesOf(notes: readonly PatchNoteItem[]): PatchNoteItem[];

  /**
   * 검증 단계에서 **인용 가능한** 노트인가. `candidatesOf`와 따로 두는 이유는 LoL의 실측
   * 때문이다 — 모드 노트를 후보 풀에서 빼면 해시가 바뀌어 캐시가 죽으므로, 이미 캐시된 답에
   * 대해서는 *검증 지점*에서 거른다(llm-verify.ts `verifyCauses` 주석 참고).
   */
  isCitable(note: PatchNoteItem): boolean;

  /**
   * 이 노트가 델타와 **같은 엔티티**를 가리키나. 참이면 간접 원인이 아니라 직접 변경이므로
   * 후보에서 폐기한다(1단 결정론 매칭이 이미 다뤘어야 하는 것).
   */
  isSameEntity(note: PatchNoteItem, delta: TDelta): boolean;

  /** 델타 1건을 사람이 읽는 형태로 적은 사용자 메시지. */
  buildUserPrompt(delta: TDelta): string;

  /**
   * LLM 요약이 재요청 뒤에도 100자를 넘을 때 쓰는 **델타 수치만의** 결정론 요약(2026-09-28, C1·D1).
   * 100자 이하여야 한다(각 프로필 테스트가 최장 이름으로 고정). 없으면 엔진은 LLM 요약을 그대로 둔다.
   */
  fallbackSummary?(delta: TDelta): string;

  /**
   * 원인 문장이 숫자로 인용해도 되는 **델타 자신의** 수치(표본 n·표시 단위 값, 2026-09-28 C3). 엔진의
   * 「A→B」 사실성 검사가 인용 노트 수치와 함께 근거로 본다.
   */
  ownNumbersOf?(delta: TDelta): number[];

  /** 게임 고유 사실성 검사(C3) — 거짓이면 그 원인은 verified=false. 없으면 공통 검사만. */
  isCauseGrounded?(text: string, note: PatchNoteItem, delta: TDelta): boolean;

  /**
   * 이 델타를 LLM 2단에 보낼까. 없으면 엔진 기본값(`unannounced` ∨ `announced-inconsistent`) — PUBG는
   * 판정기가 불일치를 이미 비율 밴드로 확정하므로 기본값이 맞다.
   */
  isTarget?(delta: TDelta): boolean;
}

/**
 * LoL·TFT 대상 선정(2026-09-27) — **화면이 「미공지」·「이상 관측」이라 부르는 행만**.
 *
 * 엔진 기본값은 `announced-inconsistent`를 통째로 보냈는데, 판정 엔진은 그 값에 "방향 반대 + 유의"뿐
 * 아니라 "비유의"와 "방향 중립"까지 접어 넣는다(verdict.ts). 실측 26.19: 69건 중 52건이 비유의였고
 * 프롬프트는 그것을 전부 "노트 방향과 관측이 다름"이라고 전했다 — 모델이 잡음에 원인을 지어냈다.
 * 화면과 같은 술어(`displayStatus`)를 써서, 프롬프트의 상태 문구가 참인 행만 보낸다.
 */
export function isAnomalyOrGapTarget(delta: DeltaRecord): boolean {
  if (delta.status === "unannounced") return true;
  if (delta.status !== "announced-inconsistent") return false;
  return displayStatus(delta) === "announced-anomaly";
}

/**
 * LoL·TFT 인용 가능성 — core 노트 중 **치장이 아닌 것**(2026-09-27). 26.19 블리츠크랭크 밴률 원인이
 * 「앞으로 나올 스킨 및 크로마」를 인용한 채 verified로 나갔다. 후보 풀(`candidatesOf`)에서 빼면
 * candidateSetHash가 바뀌어 캐시가 전량 무효가 되므로, `isCitable`의 원래 설계대로 검증 지점에서 거른다.
 */
export function isCitableBalanceNote(note: PatchNoteItem): boolean {
  return isCoreNote(note) && !isCosmeticNote(note);
}


/**
 * 결정론 수치 요약(2026-09-28, C1·D1) — LLM 요약이 재요청 뒤에도 100자를 넘을 때 쓴다. 델타 **자신의**
 * 수치만 말하므로 인용이 없고 지어낸 것이 없다. 방향 동사를 쓰지 않는 이유: 평균 등수처럼 낮을수록 좋은
 * 지표에서 「올랐다」는 뜻이 뒤집힌다 — 수치와 부호가 방향을 이미 말한다.
 */
export function deterministicSummary(input: {
  name: string;
  metricKo: string;
  before: string;
  after: string;
  change: string;
  status: string;
}): string {
  const tail =
    input.status === "unannounced"
      ? "패치노트에 직접 조항이 없습니다."
      : input.status === "announced-inconsistent"
        ? "노트가 예고한 방향과 다르게 움직였습니다."
        : "";
  return `${input.name} ${input.metricKo}${subjectParticle(input.metricKo)} ${input.before}에서 ${input.after}${directionParticle(input.after)} 바뀌었습니다(${input.change}). ${tail}`.trim();
}

/** 주격 조사 — 마지막 음절에 받침이 있으면 「이」, 없으면 「가」(「평균 등수가」·「순방률이」). 한글이 아니면 「이」. */
export function subjectParticle(word: string): "이" | "가" {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "이";
  return code % 28 === 0 ? "가" : "이";
}

/**
 * 표시 정밀도로 반올림한 두 값의 차이 — 결정론 요약이 **자기 문장 안에서** 어긋나지 않게 한다(2026-09-28).
 * 「16.2%에서 7.9%로(−8.4%p)」는 원값 차이라 맞지만 읽는 사람에겐 틀린 뺄셈이다. `step`은 표시 단위(0.001 = 0.1%).
 */
export function displayedDelta(before: number | null, after: number | null, step: number): number | null {
  if (before === null || after === null) return null;
  const round = (v: number) => Math.round(v / step) * step;
  return Math.round((round(after) - round(before)) / step) * step;
}

/** 부호를 붙인 변화량 문자열 — 결정론 요약용(`+0.4%p`·`-0.12등`). 이미 부호가 있으면 그대로(「++」 금지). */
export function signed(text: string): string {
  return /^[+\-−]/.test(text) ? text : `+${text}`;
}

// 숫자 끝자리의 한국어 읽기 끝소리 — 받침(ㄹ 제외)이 있으면 「으로」. 0은 십·백·천·만·영 전부 받침이다.
const DIGIT_TAKES_EURO: Record<string, boolean> = {
  "0": true, "1": false, "2": false, "3": true, "4": false, "5": false, "6": true, "7": false, "8": false, "9": false,
};

/**
 * 방향 조사 「로/으로」 — 끝소리가 ㄹ 이외 받침이면 「으로」(「4.48등으로」), 아니면 「로」(「12.2%로」·「11초로」).
 * 기호(%)는 「퍼센트」로 읽혀 「로」다. 한글도 숫자도 아니면 「로」.
 */
export function directionParticle(word: string): "로" | "으로" {
  const last = word.at(-1) ?? "";
  if (last in DIGIT_TAKES_EURO) return DIGIT_TAKES_EURO[last] ? "으로" : "로";
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "로";
  const jong = code % 28;
  return jong === 0 || jong === 8 ? "로" : "으로"; // 8 = ㄹ
}

/**
 * LoL·TFT 델타 자신의 수치(C3) — 표본 n, 그리고 비율 지표를 화면 단위(%, 소수 첫째 자리)로 바꾼 값.
 * 원인 문장이 「표본이 4156→5789로」처럼 델타 수치를 말하면 그것은 지어낸 수치가 아니다.
 */
export function deltaRecordNumbers(delta: DeltaRecord): number[] {
  const values = [delta.before, delta.after, delta.delta].filter((v): v is number => v !== null);
  return [
    delta.n.before,
    delta.n.after,
    ...values.flatMap((v) => [Math.round(Math.abs(v) * 1000) / 10, Math.round(Math.abs(v) * 100) / 100, Math.abs(v)]),
  ];
}
