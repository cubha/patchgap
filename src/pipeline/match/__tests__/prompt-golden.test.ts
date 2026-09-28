// src/pipeline/match/__tests__/prompt-golden.test.ts
// 지시문 골든 가드(2026-09-28, C5). 캐시 키는 `model|PROMPT_VERSION(+개정 태그)|deltaId|후보 해시`라
// **지시문 본문이 키에 없다** — 지시문을 고치고 태그를 안 올리면 조용히 옛 답이 캐시 적중으로 나간다.
// 산문 규칙("고치면 태그를 올려라")은 게이트 없이 드리프트하므로 여기서 기계로 막는다.
//
// 규약: 게임별 (개정 태그, 지시문 해시) 이력을 `prompt-golden.json`에 누적한다.
//  - 현재 (태그, 해시)가 이력에 있어야 한다 → 지시문만 바꾸면 실패한다.
//  - 같은 태그에 다른 해시가 둘 이상이면 실패한다 → 해시만 갱신하고 태그를 안 올리는 우회를 막는다.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lolLlmProfile } from "../llm-profile-lol";
import { tftLlmProfile } from "../llm-profile-tft";
import { createPubgLlmProfile } from "../llm-profile-pubg";
import type { DdragonData } from "../ddragon";
import type { DeltaRecord } from "../../types";
import type { PubgDeltaRow } from "../pubg-delta";
import { buildProseRepairNote, buildSystemPrompt } from "../llm-match";
import type { PatchNoteItem } from "../../types";

interface GoldenEntry {
  promptRevision: string;
  instructionsSha256: string;
  /**
   * 고정 픽스처 델타로 **렌더한** 사용자 메시지의 해시(scope-critic 2026-09-28). 함수 소스가 아니라 렌더
   * 결과라 코드 포맷 변경엔 불변이고, 모델 입력이 바뀌면 반응한다 — 사용자 메시지도 캐시 키에 없다.
   */
  userPromptSha256: string;
  /**
   * 후보 노트를 감싼 시스템 프롬프트 전체의 해시(2026-09-28, 이월 R15). 후보 직렬화 자체는 후보 해시로
   * 캐시 키에 들어가지만, 감싸는 문구(「후보 패치노트 항목 목록(JSON):」)는 키에 없다.
   */
  systemPromptSha256: string;
}
interface EngineGolden {
  /** 길이·명사형 재요청 문구(게임 공용) — 사용자 메시지 뒤에 붙어 모델 입력이 되지만 캐시 키에 없다. */
  repairNoteSha256: string;
}
const GOLDEN_FILE = JSON.parse(fs.readFileSync(path.join(__dirname, "prompt-golden.json"), "utf8")) as Record<string, unknown>;
const GOLDEN = GOLDEN_FILE as Record<string, GoldenEntry[]>;
const ENGINE_GOLDEN = GOLDEN_FILE.engine as EngineGolden | undefined;

const lolDelta = {
  id: "champion:Aatrox:TOP:winRate", entityType: "champion", entityKey: "Aatrox", entityName: "아트록스", metric: "winRate",
  before: 0.5, after: 0.53, delta: 0.03, ci: [0.01, 0.05], n: { before: 1000, after: 1100 }, q: 0.01, status: "unannounced",
  matchedNoteId: null, matchedNoteIds: [], causes: [], evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
} as DeltaRecord;
const tftDelta = { ...lolDelta, id: "unit:DA_18_Rakan:top4Rate", entityType: "unit", entityKey: "DA_18_Rakan", entityName: "라칸", metric: "top4Rate" } as DeltaRecord;
const pubgDelta = {
  id: "weapon:AKM:pickupShare", weaponKey: "Item_Weapon_AK47_C", weaponName: "AKM", metric: "pickupShare", before: 0.05, after: 0.06,
  relChange: 0.2, relCi: [0.1, 0.3], n: { before: 1000, after: 1200 }, status: "unannounced", matchedNoteIds: [],
} as unknown as PubgDeltaRow;

const lol = lolLlmProfile({} as unknown as DdragonData);
const pubg = createPubgLlmProfile(new Map(), { redistribution: 0.0193, totalPickupsRelChange: -0.179 });
// 판정 상태 분기(미공지 / 공지-불일치)가 사용자 메시지 문구를 가른다 — 두 분기를 다 렌더한다(R15).
const bothStatuses = <T extends { status: string }>(delta: T, render: (d: T) => string) =>
  [render(delta), render({ ...delta, status: "announced-mismatch" })].join("\n---\n");
const noteFixture: PatchNoteItem = {
  id: "26.19:champion:아트록스:q:0", patch: "26.19", section: "champion", entity: "아트록스", skill: "Q", stat: "피해량",
  before: "10", after: "20", direction: "buff", summary: "피해량 10 ⇒ 20", anchorUrl: "https://example.invalid/#a",
  anchorKind: "entity", modeScope: "core",
} as PatchNoteItem;
const profiles = [
  { profile: lol, render: () => bothStatuses(lolDelta, (d) => lol.buildUserPrompt(d)) },
  { profile: tftLlmProfile, render: () => bothStatuses(tftDelta, (d) => tftLlmProfile.buildUserPrompt(d)) },
  { profile: pubg, render: () => bothStatuses(pubgDelta, (d) => pubg.buildUserPrompt(d)) },
];

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe("LLM 지시문 골든 가드", () => {
  for (const { profile, render } of profiles) {
    it(`${profile.game}: 현재 (개정 태그, 지시문·사용자 메시지 해시)가 이력에 있다 — 고쳤으면 promptRevision을 올려라`, () => {
      const current = {
        promptRevision: profile.promptRevision ?? "",
        instructionsSha256: sha(profile.systemInstructions),
        userPromptSha256: sha(render()),
        systemPromptSha256: sha(buildSystemPrompt(profile as never, [noteFixture])),
      };
      expect(GOLDEN[profile.game] ?? []).toContainEqual(current);
    });
    it(`${profile.game}: 한 태그에 해시는 하나다 — 태그를 안 올리고 해시만 갱신하는 우회 금지`, () => {
      const byRev = new Map<string, Set<string>>();
      for (const e of GOLDEN[profile.game] ?? []) {
        byRev.set(e.promptRevision, (byRev.get(e.promptRevision) ?? new Set()).add(`${e.instructionsSha256}|${e.userPromptSha256}|${e.systemPromptSha256}`));
      }
      const dup = [...byRev].filter(([, hashes]) => hashes.size > 1).map(([rev]) => rev);
      expect(dup).toEqual([]);
    });
  }
  it("엔진: 재요청 문구가 골든과 같다 — 고쳤으면 PROMPT_VERSION을 올리고 골든을 갱신하라", () => {
    const repair = buildProseRepairNote({
      summary: "가".repeat(120),
      causes: [{ text: "나".repeat(10) + " 영향", candidateNoteId: null, confidence: "low" }],
    } as never);
    expect(ENGINE_GOLDEN?.repairNoteSha256).toBe(sha(repair));
  });
});
