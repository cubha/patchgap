// src/pipeline/match/__tests__/llm-profile-pubg.test.ts
// PUBG LLM 2단 프로필의 **계약**(2026-09-23). 프롬프트는 산출물의 계약이므로 문구를 직접 잰다.
//
// 특히 `isSameEntity`: PUBG 노트 한 줄이 여러 무기를 말하므로(「RPD·M249 스폰율 30% 감소」)
// 이름 비교로는 자기 조항을 가릴 수 없다 — 원본 키 배열을 봐야 한다. 그 규칙이 깨지면 1단이
// 직접 변경으로 짝지은 조항을 2단이 **간접 원인으로 다시 인용**한다.
import { describe, expect, it } from "vitest";
import {
  PUBG_SYSTEM_INSTRUCTIONS_TEXT,
  createPubgLlmProfile,
} from "../llm-profile-pubg";
import { pubgNotesAsPatchNotes, type PubgDeltaRow, type PubgNoteItem } from "../pubg-delta";

const note = (over: Partial<PubgNoteItem> & Pick<PubgNoteItem, "id">): PubgNoteItem => ({
  patch: "43.1",
  weaponKeys: [],
  stat: "스폰율",
  before: null,
  after: null,
  direction: "nerf",
  expectedRelChange: null,
  summary: "요약",
  anchorUrl: "https://x",
  ...over,
});

const row = (over: Partial<PubgDeltaRow> & Pick<PubgDeltaRow, "weaponKey">): PubgDeltaRow => ({
  id: `pubg:${over.weaponKey}:pickupShare`,
  weaponName: "테스트건",
  metric: "pickupShare",
  before: 0.03,
  after: 0.04,
  relChange: 0.33,
  relCi: [0.2, 0.46],
  n: { before: 1000, after: 1200 },
  status: "unannounced",
  matchedNoteId: null,
  matchedNoteIds: [],
  evidence: { aggregatePath: "#", noteAnchor: null, matchIds: [] },
  ...over,
});

const NOTES = [
  note({ id: "n-spawn", weaponKeys: ["Item_Weapon_RPD_C", "Item_Weapon_M249_C"] }),
  note({ id: "n-ads", weaponKeys: ["Item_Weapon_MG3_C"], stat: "조준 전환 시간" }),
];
const profile = createPubgLlmProfile(new Map(NOTES.map((n) => [n.id, n.weaponKeys] as const)));
const candidates = pubgNotesAsPatchNotes(NOTES, (key) => (key === "Item_Weapon_RPD_C" ? "RPD" : null));

describe("자기참조 판정", () => {
  it("한 줄이 말한 무기 전부를 자기 조항으로 본다 — 이름이 아니라 키로 가른다", () => {
    expect(profile.isSameEntity(candidates[0], row({ weaponKey: "Item_Weapon_M249_C" }))).toBe(true);
    expect(profile.isSameEntity(candidates[0], row({ weaponKey: "Item_Weapon_RPD_C" }))).toBe(true);
  });

  it("그 줄이 말하지 않은 무기는 간접 원인 후보로 남는다", () => {
    expect(profile.isSameEntity(candidates[0], row({ weaponKey: "Item_Weapon_Groza_C" }))).toBe(false);
  });
});

describe("후보 변환", () => {
  it("여러 무기를 말한 줄은 이름을 이어 붙인다 — 모델이 어느 무기인지 보게 한다", () => {
    expect(candidates[0].entity).toBe("RPD · Item_Weapon_M249_C");
  });

  it("이름을 못 찾으면 키를 그대로 쓴다 — 지어내지 않는다", () => {
    expect(candidates[1].entity).toBe("Item_Weapon_MG3_C");
  });

  it("id·앵커·요약을 보존한다 — 화면이 같은 노트를 찾을 수 있어야 한다", () => {
    expect(candidates[0].id).toBe("n-spawn");
    expect(candidates[0].anchorUrl).toBe("https://x");
  });
});

describe("프롬프트 계약", () => {
  it("이 게임의 제로섬 성질을 명시한다 — 없으면 모델이 직접 너프만 찾는다", () => {
    expect(PUBG_SYSTEM_INSTRUCTIONS_TEXT).toContain("제로섬");
    expect(PUBG_SYSTEM_INSTRUCTIONS_TEXT).toContain("획득 점유율");
  });

  it("검증되지 않는 축(반동·조준 전환)에 인과 고리를 요구한다", () => {
    expect(PUBG_SYSTEM_INSTRUCTIONS_TEXT).toContain("획득 점유율로 검증되지 않습니다");
  });

  it("지어내기 금지와 빈 배열 규칙이 있다", () => {
    expect(PUBG_SYSTEM_INSTRUCTIONS_TEXT).toContain("지어내지 마세요");
    expect(PUBG_SYSTEM_INSTRUCTIONS_TEXT).toContain("빈 배열");
  });

  it("사용자 메시지에 내부 키가 아니라 표시 이름이 들어간다", () => {
    const prompt = profile.buildUserPrompt(row({ weaponKey: "Item_Weapon_RPD_C", weaponName: "RPD" }));
    expect(prompt).toContain("무기: RPD");
    expect(prompt).not.toContain("Item_Weapon_RPD_C");
    expect(prompt).toContain("획득 점유율");
  });
});
