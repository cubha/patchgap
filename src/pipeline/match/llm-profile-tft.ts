// src/pipeline/match/llm-profile-tft.ts
// 전략적 팀 전투(TFT) LLM 2단 프로필(2026-09-20).
//
// **왜 LoL 지시문을 그대로 쓸 수 없는가.** 세 군데가 실제로 틀린 답을 만든다:
//   1. 역할("리그 오브 레전드 패치 분석가")과 어휘(챔피언·픽률) — TFT 독자가 읽는 말이 아니다.
//   2. **평균 등수는 낮을수록 개선이다.** 이 한 줄이 없으면 모델이 인과 방향을 전 항목에서
//      뒤집는다("등수가 0.12 내려갔다 = 약화됐다"). 화면은 `isLowerBetter`로 이미 뒤집고 있고
//      (`components/tft/shared.tsx` deltaDisplay), 짝짓기도 뒤집는다(`run-tft-match.ts`
//      agreesWithNote) — 프롬프트만 모르면 세 축 중 하나가 다른 말을 한다.
//   3. 간접 인과의 **모양이 다르다.** LoL은 한 라인에 한 챔피언이 서는 제로섬이라 "A 상향 →
//      B 픽률 하락"이 기본형이지만, TFT는 한 보드에 여러 유닛이 동시에 서므로 같은 특성·같은
//      비용대·같은 아이템 수요를 공유하는 엔티티들이 **함께** 움직인다.
//
// 캐시는 LoL과 섞이지 않는다 — 키가 `sha256(model|PROMPT_VERSION|deltaId|candSetHash)`인데
// TFT 델타 id는 `unit:DA_18_Rakan:playRate` 꼴이라 LoL 것과 겹치지 않고, 후보셋(TFT 노트 119건)
// 해시도 다르다. 그래서 `PROMPT_VERSION`을 건드리지 않고 TFT를 붙일 수 있다(LoL 캐시 866건 보존).

import { isCoreNote } from "../shared/mode-scope";
import type { DeltaRecord, PatchNoteItem } from "../types";
import type { GameLlmProfile } from "./llm-profile";

const SYSTEM_INSTRUCTIONS = [
  "당신은 전략적 팀 전투(TFT) 패치 분석가입니다.",
  "아래 후보 패치노트 항목 목록(JSON 배열)에서, 사용자가 제시하는 통계 델타(패치노트로 직접",
  "설명되지 않거나 노트와 불일치하는 관측 변화)를 설명할 수 있는 간접 영향 후보를 찾으세요.",
  "이 게임의 성질(인과 추론의 전제):",
  "- 한 보드에 여러 유닛이 동시에 섭니다. 한 유닛의 강세는 같은 특성·같은 비용대·같은 아이템을",
  "  쓰는 다른 엔티티의 등장률을 함께 끌어올리거나 밀어냅니다.",
  "- 특성(시너지)은 소속 유닛을 통해서만 작동합니다. 특성 수치 변경은 그 특성에 속한 유닛들의",
  "  등장률·순방률로 나타납니다(반대로 유닛 변경이 특성 등장률을 움직이기도 합니다).",
  "- **평균 등수는 낮을수록 좋습니다**(1등이 최고, 8등이 최하). 등장률과 순방률은 높을수록",
  "  좋습니다. 평균 등수가 내려간 것은 **강화**이고 올라간 것은 약화입니다.",
  "규칙:",
  "1. candidateNoteId는 반드시 후보 목록에 있는 id만 반환하세요. 목록에 없는 id를 지어내지 마세요.",
  "2. 이 델타의 엔티티 자신에 대한 직접 변경 노트(이미 1단 결정론 매칭에서 다뤄졌어야 함)는",
  "   후보로 제시하지 마세요 — 간접 영향(다른 유닛·특성·아이템·체계 변경의 파급 효과)만 찾으세요.",
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
  "8. 수치는 사용자 메시지에 적힌 표기(%, %p, 등)를 그대로 쓰고 0.571 같은 소수 원값이나",
  "   DA_18_Rakan 같은 영문 키를 쓰지 마세요. 엔티티는 한국어 이름만 쓰세요.",
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

/** 테스트가 규칙 문구를 직접 검사할 수 있게 노출한다(프롬프트는 산출물의 계약이다). */
export const TFT_SYSTEM_INSTRUCTIONS_TEXT = SYSTEM_INSTRUCTIONS;

/** 화면과 **같은 어휘**를 쓴다 — `src/lib/format.ts` METRIC_LABELS의 TFT 3종 그대로. */
const METRIC_KO: Record<string, string> = {
  playRate: "등장률",
  top4Rate: "순방률",
  avgPlacement: "평균 등수",
};

const ENTITY_TYPE_KO: Record<string, string> = {
  unit: "유닛",
  trait: "특성",
  item: "아이템",
};

/**
 * 값 표기. **평균 등수에 `Math.round`를 쓰면 안 된다** — 실측 델타가 -0.08~0.3 규모라 반올림하면
 * 프롬프트에 "변화: 0"이 찍히고 모델은 변하지 않은 수치를 설명하려 든다. 화면(`placement`)과
 * 같은 소수 2자리를 쓴다.
 */
function fmtValue(metric: string, value: number | null, delta = false): string {
  if (value === null) return "N/A";
  if (metric === "avgPlacement") return `${delta && value >= 0 ? "+" : ""}${value.toFixed(2)}등`;
  return `${(value * 100).toFixed(1)}${delta ? "%p" : "%"}`;
}

function buildUserPrompt(delta: DeltaRecord): string {
  const typeKo = ENTITY_TYPE_KO[delta.entityType] ?? delta.entityType;
  return [
    `엔티티: ${delta.entityName} (${typeKo})`,
    `지표: ${METRIC_KO[delta.metric] ?? delta.metric}`,
    `이전 값: ${fmtValue(delta.metric, delta.before)}`,
    `이후 값: ${fmtValue(delta.metric, delta.after)}`,
    `변화: ${fmtValue(delta.metric, delta.delta, true)}${
      delta.metric === "avgPlacement" ? " (음수 = 등수가 낮아짐 = 강화)" : ""
    }`,
    `95% CI: [${fmtValue(delta.metric, delta.ci[0], true)}, ${fmtValue(delta.metric, delta.ci[1], true)}]`,
    `표본 n: 이전=${delta.n.before}, 이후=${delta.n.after}`,
    `현재 판정 상태: ${delta.status === "unannounced" ? "미공지(패치노트에 직접 조항 없음)" : "공지-불일치(노트 방향과 관측이 다름)"}`,
  ].join("\n");
}

/**
 * TFT 프로필.
 *
 * `ddragon` 같은 외부 카탈로그가 필요 없다 — 노트의 엔티티명과 델타의 `entityName`이 **같은
 * TFT 카탈로그**(`tft-catalog.ts`)에서 온 한국어 이름이라 이름 비교가 곧 동일성 판정이다.
 * 이것은 `run-tft-match.ts`의 1단 짝짓기가 쓰는 규칙과 **같은 규칙**이다 — 두 곳이 다른 기준을
 * 쓰면 1단이 직접 변경으로 짝지은 것을 2단이 간접 원인으로 다시 인용하게 된다.
 */
export const tftLlmProfile: GameLlmProfile = {
  game: "tft",
  systemInstructions: SYSTEM_INSTRUCTIONS,
  // TFT 패치노트는 게임 모드 섹션을 나누지 않아 파서가 전부 `core`로 새긴다. 그래도 술어를
  // 그대로 쓰는 이유: 라이엇이 모드 섹션을 도입하면 LoL과 **같은 지점**에서 걸러지게 하려는 것이다.
  candidatesOf: (notes) => notes.filter(isCoreNote),
  isCitable: isCoreNote,
  isSameEntity: (note: PatchNoteItem, delta: DeltaRecord) => note.entity === delta.entityName,
  buildUserPrompt,
};
