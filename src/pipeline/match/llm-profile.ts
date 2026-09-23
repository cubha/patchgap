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
   * LLM에게 **보여줄** 후보만 남긴다. 이 결과가 `candidateSetHash`를 결정하므로,
   * 여기를 건드리면 그 게임의 LLM 캐시가 전량 무효가 된다.
   */
  candidatesOf(notes: readonly PatchNoteItem[]): PatchNoteItem[];

  /**
   * 검증 단계에서 **인용 가능한** 노트인가. `candidatesOf`와 따로 두는 이유는 LoL의 실측
   * 때문이다 — 모드 노트를 후보 풀에서 빼면 해시가 바뀌어 캐시가 죽으므로, 이미 캐시된 답에
   * 대해서는 *검증 지점*에서 거른다(llm-match.ts `verifyCauses` 주석 참고).
   */
  isCitable(note: PatchNoteItem): boolean;

  /**
   * 이 노트가 델타와 **같은 엔티티**를 가리키나. 참이면 간접 원인이 아니라 직접 변경이므로
   * 후보에서 폐기한다(1단 결정론 매칭이 이미 다뤘어야 하는 것).
   */
  isSameEntity(note: PatchNoteItem, delta: TDelta): boolean;

  /** 델타 1건을 사람이 읽는 형태로 적은 사용자 메시지. */
  buildUserPrompt(delta: TDelta): string;
}
