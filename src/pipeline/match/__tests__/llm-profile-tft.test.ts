// src/pipeline/match/__tests__/llm-profile-tft.test.ts
// TFT 프로필이 **LoL의 어휘와 방향을 물려받지 않았는지** 본다.
//
// 이 테스트가 막는 실제 결함 두 가지:
//  ① `Math.round` 포맷을 그대로 물려받으면 평균 등수 델타(-0.08~0.3 규모)가 프롬프트에 "0"으로
//     찍혀, 모델이 **변하지 않은 수치**를 설명하려 든다.
//  ② "등수는 낮을수록 좋다"가 지시문에 없으면 모델이 인과 방향을 전 항목에서 뒤집는다.
//     화면(`deltaDisplay`)과 짝짓기(`agreesWithNote`)는 이미 뒤집고 있으므로, 프롬프트만 모르면
//     같은 행에 대해 사이트가 서로 반대되는 말을 한다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { candidateSetHash, serializeCandidates } from "../llm-match";
import { TFT_SYSTEM_INSTRUCTIONS_TEXT, tftLlmProfile } from "../llm-profile-tft";
import type { DeltaRecord, PatchNoteItem } from "../../types";

function tftDelta(overrides: Partial<DeltaRecord> = {}): DeltaRecord {
  return {
    id: "unit:DA_Vi18:avgPlacement",
    entityType: "unit",
    entityKey: "DA_Vi18",
    entityName: "바이",
    metric: "avgPlacement",
    before: 4.4123,
    after: 4.2891,
    delta: -0.1232,
    ci: [-0.2, -0.04],
    n: { before: 3100, after: 3400 },
    q: 0.01,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "", noteAnchor: null },
    ...overrides,
  };
}

describe("TFT LLM 프로필", () => {
  it("평균 등수를 반올림해 0으로 만들지 않는다", () => {
    const prompt = tftLlmProfile.buildUserPrompt(tftDelta());
    expect(prompt).toContain("변화: -0.12등");
    expect(prompt).not.toContain("변화: 0\n");
    expect(prompt).toContain("이전 값: 4.41등");
    expect(prompt).toContain("이후 값: 4.29등");
  });

  it("평균 등수의 개선 방향을 프롬프트가 직접 말한다", () => {
    expect(tftLlmProfile.buildUserPrompt(tftDelta())).toContain("음수 = 등수가 낮아짐 = 강화");
    expect(TFT_SYSTEM_INSTRUCTIONS_TEXT).toContain("평균 등수는 낮을수록 좋습니다");
  });

  it("비율 지표는 화면과 같은 어휘·표기를 쓴다", () => {
    const prompt = tftLlmProfile.buildUserPrompt(
      tftDelta({ id: "trait:DA_18_Duelist:playRate", entityType: "trait", metric: "playRate", before: 0.211, after: 0.2456, delta: 0.0346 })
    );
    expect(prompt).toContain("지표: 등장률");
    expect(prompt).toContain("(특성)");
    expect(prompt).toContain("변화: 3.5%p");
  });

  it("리그 오브 레전드 어휘를 물려받지 않았다", () => {
    for (const banned of ["리그 오브 레전드", "챔피언", "픽률", "MonkeyKing"]) {
      expect(TFT_SYSTEM_INSTRUCTIONS_TEXT, `금지 어휘: ${banned}`).not.toContain(banned);
    }
  });

  it("자기참조 판정은 1단 짝짓기와 같은 규칙(이름 정확일치)이다", () => {
    const note = (entity: string): PatchNoteItem =>
      ({
        id: `note:tft:18.2:champion:${entity}:0001`,
        patch: "18.2",
        section: "champion",
        entity,
        skill: null,
        stat: "스킬 피해량",
        before: "100",
        after: "120",
        direction: "buff",
        summary: "",
        anchorUrl: "https://example.test/#a",
        anchorKind: "section",
        modeScope: "core",
      }) as PatchNoteItem;
    expect(tftLlmProfile.isSameEntity(note("바이"), tftDelta())).toBe(true);
    expect(tftLlmProfile.isSameEntity(note("세주아니"), tftDelta())).toBe(false);
  });

  it("TFT 후보셋 해시가 LoL 것과 겹치지 않는다(캐시 충돌 없음)", () => {
    const file = path.join(process.cwd(), "data", "aggregated", "tft", "notes-18.2.json");
    expect(fs.existsSync(file), "TFT 노트 산출물이 없다").toBe(true);
    if (!fs.existsSync(file)) return;
    const notes = (JSON.parse(fs.readFileSync(file, "utf8")) as { items: PatchNoteItem[] }).items;
    const hash = candidateSetHash(serializeCandidates(tftLlmProfile.candidatesOf(notes)));
    // 커밋된 LoL 캐시(v5)가 쓰는 두 해시 — `llm-profile-lol.test.ts`의 앵커와 같은 값이다.
    expect(hash).not.toBe("8b5283da8c314a3a1c45d206973b026e466fbd6d782e1598bc2aa0e6504f5201");
    expect(hash).not.toBe("619b3f20079c5b243c2ea5438ea6072975a0ad5e4e24d77de5420633431ea023");
  });
});
