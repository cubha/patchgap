// src/pipeline/match/llm-profile-pubg.ts
// PUBG LLM 2단 프로필(2026-09-23).
//
// **왜 이제 붙이나**: 전에는 「PUBG에는 추정 원인이 없다」가 코드 주석이자 화면 문장이었다.
// 사유는 "43.1 노트가 5항목이라 후보가 없다"였는데, 그것은 **이 패치의 데이터 사정**이지
// 파이프라인의 성질이 아니다 — 방법론 9슬롯(§8-4)이 세 게임에 같은 자리를 요구하면서, 그 자리를
// 「쓰지 않는 축」으로 비워 둘 근거가 없어졌다. 축을 만들고, 이 패치에서 몇 건이 나오는지는
// **실측이 말하게** 한다.
//
// **왜 델타 타입이 다른가**: PUBG 행은 `PubgDeltaRow`다(지표가 `pickupShare` 하나, q 없음,
// 라인 없음). 엔진은 `id`·`status`만 보므로(`LlmDelta`) 그대로 태울 수 있고, 나머지 어휘는
// 전부 이 프로필이 든다 — `DeltaMetric` 유니온을 PUBG 전용 값으로 넓히지 않기 위한 선택이다.
//
// **캐시는 다른 게임과 섞이지 않는다**: 키가 `sha256(model|PROMPT_VERSION|deltaId|candSetHash)`인데
// PUBG 델타 id는 `pubg:Item_Weapon_RPD_C:pickupShare` 꼴이고 후보셋 해시도 다르다.
import type { PatchNoteItem } from "../types";
import type { GameLlmProfile } from "./llm-profile";
import type { PubgDeltaRow } from "./pubg-delta";

const SYSTEM_INSTRUCTIONS = [
  "당신은 PUBG: BATTLEGROUNDS 패치 분석가입니다.",
  "아래 후보 패치노트 항목 목록(JSON 배열)에서, 사용자가 제시하는 통계 델타(패치노트로 직접",
  "설명되지 않거나 노트와 불일치하는 관측 변화)를 설명할 수 있는 간접 영향 후보를 찾으세요.",
  "이 게임의 성질(인과 추론의 전제):",
  "- 관측 지표는 **획득 점유율** 하나입니다. 전체 무기 획득 중 그 무기가 차지한 비율이며,",
  "  스폰율의 대리 지표입니다. 한 무기의 스폰이 줄면 남은 무기들의 점유율이 **함께** 올라갑니다",
  "  — 제로섬이므로 직접 너프를 받지 않은 무기도 움직입니다.",
  "- 같은 탄약·같은 파밍 구역·같은 역할(근접 돌격·장거리)을 공유하는 무기가 서로를 밀어냅니다.",
  "- 반동·조준 전환 시간·차량 피해 같은 항목은 **획득 점유율로 검증되지 않습니다**. 그런 조항을",
  "  인용할 때는 「줍는 빈도가 바뀌었다」는 인과 고리를 분명히 적고, 없으면 인용하지 마세요.",
  "규칙:",
  "1. candidateNoteId는 반드시 후보 목록에 있는 id만 반환하세요. 목록에 없는 id를 지어내지 마세요.",
  "2. 이 델타의 무기 자신에 대한 직접 변경 노트(이미 1단 결정론 매칭에서 다뤄졌어야 함)는",
  "   후보로 제시하지 마세요 — 간접 영향(다른 무기·체계 변경의 파급 효과)만 찾으세요.",
  "3. 근거가 약하면 confidence를 low로, 강하면 high로 표시하세요. 그럴듯한 후보가 전혀 없으면",
  "   causes를 빈 배열로 반환하세요(지어내지 마세요).",
  "4. summary는 이 델타에 대한 한국어 브리핑 한 문장입니다 — 근거를 명시하세요.",
  "5. 반드시 한국어로 답하세요.",
  "6. summary는 summaryCites에 넣은 id의 후보 항목 또는 이 델타 자체의 수치(이전/이후/CI/n)만",
  "   근거로 쓰세요. summaryCites에는 summary 문장에서 실제로 인용한 후보 id만 정확히 넣으세요",
  "   (지어낸 id 금지). 델타 수치만으로 요약했다면 summaryCites는 빈 배열로 반환하세요.",
  "7. summary와 causes[].text는 독자가 읽는 브리핑 문장입니다. '제공된 목록', '후보 목록' 같은",
  "   이 대화의 맥락을 언급하지 마세요 — 독자는 목록을 본 적이 없습니다.",
  "8. 수치는 사용자 메시지에 적힌 표기(%, 상대 %)를 그대로 쓰고, 0.0421 같은 소수 원값이나",
  "   Item_Weapon_RPD_C 같은 내부 키를 쓰지 마세요. 무기는 표시 이름만 쓰세요.",
  "9. 길이 상한을 지키세요 — summary는 **100자 이내**, causes[].text는 각각 **80자 이내**입니다.",
  "   후보가 없으면 summary는 '패치노트에서 이 변화를 설명할 조항을 찾지 못했습니다' 한 문장으로",
  "   끝내세요.",
  "10. 완곡 표현('~수 있습니다', '~로 보입니다')은 **confidence가 low인 문장에만, 한 번만** 쓰세요.",
  "   high·medium이면 관측된 인과를 그대로 단정해 쓰세요 — 추정의 정도는 confidence가 이미 말합니다.",
  "11. 그렇다고 확신을 만들어내지는 마세요. 단정할 수 없으면 confidence를 low로 내리세요.",
].join("\n");

/** 테스트가 규칙 문구를 직접 검사할 수 있게 노출한다(프롬프트는 산출물의 계약이다). */
export const PUBG_SYSTEM_INSTRUCTIONS_TEXT = SYSTEM_INSTRUCTIONS;

function fmtShare(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;
}

function fmtRel(value: number | null): string {
  return value === null ? "N/A" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

/**
 * PUBG 프로필 만들기.
 *
 * **왜 팩토리인가**: PUBG 노트는 무기를 `weaponKeys` 배열로 든다(한 줄이 「RPD·M249」를 함께
 * 말한다). 자기참조 판정(`isSameEntity`)이 그 배열을 봐야 하는데, 엔진에 넘기는 후보는
 * `PatchNoteItem`으로 바뀐 뒤라 배열이 사라진다 — 그래서 원본 매핑을 클로저로 든다.
 * 이름 비교로 대신하면 「RPD」가 든 5줄 중 어느 것이 자기 조항인지 가릴 수 없다.
 */
export function createPubgLlmProfile(
  noteWeaponKeys: ReadonlyMap<string, readonly string[]>
): GameLlmProfile<PubgDeltaRow> {
  return {
    game: "pubg",
    systemInstructions: SYSTEM_INSTRUCTIONS,
    // PUBG 노트에는 게임 모드 구분이 없다 — 전부 본 게임 조항이다.
    candidatesOf: (notes) => [...notes],
    isCitable: () => true,
    isSameEntity: (note: PatchNoteItem, delta: PubgDeltaRow) =>
      (noteWeaponKeys.get(note.id) ?? []).includes(delta.weaponKey),
    buildUserPrompt: (delta: PubgDeltaRow) =>
      [
        `무기: ${delta.weaponName}`,
        "지표: 획득 점유율(전체 무기 획득 중 비율)",
        `이전 값: ${fmtShare(delta.before)}`,
        `이후 값: ${fmtShare(delta.after)}`,
        `상대 변화: ${fmtRel(delta.relChange)}`,
        `95% CI: [${fmtRel(delta.relCi[0])}, ${fmtRel(delta.relCi[1])}]`,
        `표본 n(획득 횟수): 이전=${delta.n.before}, 이후=${delta.n.after}`,
        `현재 판정 상태: ${
          delta.status === "unannounced"
            ? "미공지(패치노트에 직접 조항 없음)"
            : "공지-불일치(노트 방향·규모와 관측이 다름)"
        }`,
      ].join("\n"),
  };
}
