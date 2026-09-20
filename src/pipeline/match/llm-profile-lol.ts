// src/pipeline/match/llm-profile-lol.ts
// 리그 오브 레전드 LLM 2단 프로필 — **문자열은 리팩터 이전과 바이트 단위로 같아야 한다.**
//
// 여기 있는 지시문·지표 라벨·포맷 함수는 전부 `llm-match.ts`에서 **그대로 옮겨온 것**이다.
// 한 글자라도 바뀌면 다음 재생성에서 866건의 캐시된 답과 다른 프롬프트가 나가는데, 캐시 키에
// 프롬프트 본문이 들어가지 않아 **아무 게이트도 그것을 잡지 못한다**. 그래서 golden 테스트가
// 이 파일의 산출 문자열을 직접 고정한다(`__tests__/llm-profile-lol.test.ts`).

import { isCoreNote } from "../shared/mode-scope";
import type { DeltaRecord, PatchNoteItem } from "../types";
import type { DdragonData } from "./ddragon";
import type { GameLlmProfile } from "./llm-profile";

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
  "7. summary와 causes[].text는 코치·클랜장이 읽는 브리핑 문장입니다. '제공된 목록', '후보 목록',",
  "   '후보 패치노트' 같은 이 대화의 맥락을 언급하지 마세요 — 독자는 목록을 본 적이 없습니다.",
  "8. 수치는 사용자 메시지에 적힌 표기(%, %p, 초)를 그대로 쓰고 0.571 같은 소수 원값이나",
  "   MonkeyKing 같은 영문 키를 쓰지 마세요. 엔티티는 한국어 이름만 쓰세요.",
  "9. 길이 상한을 지키세요 — summary는 **100자 이내**, causes[].text는 각각 **80자 이내**입니다.",
  "   쓰고 나서 글자 수를 세어 넘으면 줄이세요(수식어와 부연부터 버리고, 수치와 인과만 남깁니다).",
  "   후보가 없으면 summary는 '패치노트에서 이 변화를 설명할 조항을 찾지 못했습니다' 한 문장으로",
  "   끝내세요 — 이유를 장황하게 나열하지 마세요.",
  "10. 완곡 표현('~수 있습니다', '~로 보입니다', '~할 가능성이 있습니다')은 **confidence가 low인",
  "   문장에만, 한 번만** 쓰세요. confidence가 high나 medium이면 관측된 인과를 그대로 단정해",
  "   쓰세요 — 추정의 정도는 confidence 필드가 이미 말하므로 문장까지 흐리면 같은 말을 두 번",
  "   하는 것이고, 읽는 사람은 어느 문장이 더 확실한지 구분할 수 없게 됩니다.",
  "11. 그렇다고 확신을 만들어내지는 마세요. 단정할 수 없으면 confidence를 low로 내리고 완곡하게",
  "   쓰거나, 근거가 없으면 그 원인을 아예 빼세요(규칙 3). 규칙 10은 **표현**을 정할 뿐",
  "   근거의 강도를 올리라는 뜻이 아닙니다.",
].join("\n");


/** 비율 지표(픽률·밴률·승률·채택률)는 %로, 그 차이는 %p로 — 모델이 이 표기를 그대로 받아쓴다
 * (규칙 8). 골드·시간은 원 단위 그대로. `fmt`를 여기 두는 이유: 이 모듈은 파이프라인 계층이라
 * `src/lib/format.ts`(웹 포맷 유틸)에 의존하지 않는다. */
const RATE_METRICS = new Set(["pickRate", "banRate", "winRate", "adoptionRate"]);

function fmtValue(metric: string, value: number | null, delta = false): string {
  if (value === null) return "N/A";
  if (RATE_METRICS.has(metric)) return `${(value * 100).toFixed(1)}${delta ? "%p" : "%"}`;
  if (metric.endsWith("Sec")) return `${Math.round(value)}초`;
  return `${Math.round(value)}`;
}

const METRIC_KO: Record<string, string> = {
  pickRate: "픽률",
  banRate: "밴률",
  winRate: "승률",
  adoptionRate: "채택률",
  goldAt10: "골드@10",
  goldAt14: "골드@14",
};

const POSITION_KO: Record<string, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MIDDLE: "미드",
  BOTTOM: "원딜",
  UTILITY: "서포터",
};

function buildUserPrompt(delta: DeltaRecord): string {
  const parts = delta.id.split(":");
  const positionHint = parts.length >= 4 && POSITION_KO[parts[2]] ? ` (${POSITION_KO[parts[2]]})` : "";
  return [
    `엔티티: ${delta.entityName}${positionHint}`,
    `지표: ${METRIC_KO[delta.metric] ?? delta.metric}`,
    `이전 값: ${fmtValue(delta.metric, delta.before)}`,
    `이후 값: ${fmtValue(delta.metric, delta.after)}`,
    `변화: ${fmtValue(delta.metric, delta.delta, true)}`,
    `95% CI: [${fmtValue(delta.metric, delta.ci[0], true)}, ${fmtValue(delta.metric, delta.ci[1], true)}]`,
    `표본 n: 이전=${delta.n.before}, 이후=${delta.n.after}`,
    `현재 판정 상태: ${delta.status === "unannounced" ? "미공지(패치노트에 직접 조항 없음)" : "공지-불일치(노트 방향과 관측이 다름)"}`,
  ].join("\n");
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
 * LLM에게 보여줄 후보만 남긴다 — 소환사의 협곡(core) 노트뿐이다.
 *
 * 왜 사후 기각(verifyCauses)만으로 부족한가: 그건 **답을 버리는** 것이지 질문을 고치는 게 아니다.
 * 실측으로 26.17 노트 215건 중 173건(80%)이 모드 섹션이라, 모델은 프롬프트 대부분을 인용 불가
 * 후보로 읽고 그중 62%를 실제로 집었다. 풀에서 빼면 프롬프트가 1/4로 줄고 남은 SR 후보에 집중된다.
 * 대가는 candidateSetHash 변경 = 캐시 전량 무효이며, 그래서 PROMPT_VERSION 상향과 같은 실행에 묶었다.
 */

/** 테스트가 규칙 문구를 직접 검사할 수 있게 노출한다(프롬프트는 산출물의 계약이다). */
export const SYSTEM_INSTRUCTIONS_TEXT = SYSTEM_INSTRUCTIONS;

/**
 * LoL 프로필. `ddragon`이 필요한 이유는 자기참조 판정뿐이다 — 노트의 한국어 엔티티명을 델타의
 * ddragon 키로 풀어야 "이 노트가 이 델타 자신에 대한 직접 변경인가"를 답할 수 있다.
 */
export function lolLlmProfile(ddragon: DdragonData): GameLlmProfile {
  return {
    game: "lol",
    systemInstructions: SYSTEM_INSTRUCTIONS,
    // 소환사의 협곡(core) 노트만 보여준다 — 근거는 위 `coreCandidatesOf` 주석.
    candidatesOf: (notes) => notes.filter(isCoreNote),
    isCitable: isCoreNote,
    isSameEntity: (note, delta) => resolvesToSameEntity(note, delta, ddragon),
    buildUserPrompt,
  };
}
