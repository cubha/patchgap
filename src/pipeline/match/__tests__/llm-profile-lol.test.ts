// src/pipeline/match/__tests__/llm-profile-lol.test.ts
// **LoL 프롬프트 동결 테스트.** 2026-09-20에 TFT를 붙이면서 `llm-match.ts`의 게임별 문자열을
// 프로필로 뽑아냈는데, 그 이동이 안전했음을 이 파일이 증명한다.
//
// 왜 이 게이트가 꼭 필요한가: 캐시 키는 `sha256(model|PROMPT_VERSION|deltaId|candSetHash)`라
// **프롬프트 본문이 들어가지 않는다**. 즉 지시문이 바뀌어도 캐시는 조용히 히트하고, 다음
// 재생성 때 866건과 다른 질문이 나간다 — 어떤 게이트도 그것을 잡지 못한다. 그래서 문자열을
// 여기서 직접 고정한다.
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { candidateSetHash, serializeCandidates } from "../llm-match";
import { SYSTEM_INSTRUCTIONS_TEXT, lolLlmProfile } from "../llm-profile-lol";
import { loadDdragonSafe } from "../ddragon";
import type { DeltaRecord, PatchNoteItem } from "../../types";

/**
 * 지시문 전문의 sha256. **의도적으로 프롬프트를 고칠 때만** 이 값을 갱신하며, 그때는
 * `PROMPT_VERSION` 상향과 캐시 전량 재생성 비용을 같이 판단해야 한다(그냥 숫자만 맞추지 말 것).
 */
const SYSTEM_INSTRUCTIONS_SHA256 =
  "4c4c18ad99676fa24e5707fd5c3c08a2f6701f6c5a592073800a4177ae4108da";

/**
 * 커밋된 LLM 캐시에 실제로 적힌 `candidateSetHash`(v5 · claude-opus-5). 손으로 베낀 값이 아니라
 * `data/cache/llm/**`에서 읽은 실측 앵커다 — 26.18은 110건, 26.17은 120건이 이 해시를 쓴다.
 * 후보셋 산출(`candidatesOf` → `serializeCandidates`)이 바뀌면 그 캐시가 전량 무효가 되므로
 * 여기서 고정한다.
 */
const CACHED_CANDIDATE_SET_HASHES: Record<string, string> = {
  "26.17": "8b5283da8c314a3a1c45d206973b026e466fbd6d782e1598bc2aa0e6504f5201",
  "26.18": "619b3f20079c5b243c2ea5438ea6072975a0ad5e4e24d77de5420633431ea023",
};

function baseDelta(): DeltaRecord {
  return {
    id: "champion:Aatrox:MIDDLE:winRate",
    entityType: "champion",
    entityKey: "Aatrox",
    entityName: "아트록스",
    metric: "winRate",
    before: 0.5123,
    after: 0.5411,
    delta: 0.0288,
    ci: [0.0101, 0.0475],
    n: { before: 1200, after: 1310 },
    q: 0.004,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "", noteAnchor: null },
  };
}

function loadNotes(patch: string): PatchNoteItem[] | null {
  const file = path.join(process.cwd(), "data", "aggregated", "notes", `${patch}.json`);
  if (!fs.existsSync(file)) return null;
  const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(raw)) return raw as PatchNoteItem[];
  return (raw as { items: PatchNoteItem[] }).items;
}

describe("LoL LLM 프로필 — 프롬프트 동결", () => {
  const profile = lolLlmProfile(loadDdragonSafe());

  it("시스템 지시문 전문이 바뀌지 않았다", () => {
    const sha = crypto.createHash("sha256").update(SYSTEM_INSTRUCTIONS_TEXT).digest("hex");
    expect(sha).toBe(SYSTEM_INSTRUCTIONS_SHA256);
  });

  it("사용자 프롬프트 — 포지션 힌트가 있는 챔피언 델타", () => {
    expect(profile.buildUserPrompt(baseDelta())).toBe(
      [
        "엔티티: 아트록스 (미드)",
        "지표: 승률",
        "이전 값: 51.2%",
        "이후 값: 54.1%",
        "변화: 2.9%p",
        "95% CI: [1.0%p, 4.8%p]",
        "표본 n: 이전=1200, 이후=1310",
        "현재 판정 상태: 미공지(패치노트에 직접 조항 없음)",
      ].join("\n")
    );
  });

  it("사용자 프롬프트 — 포지션이 없는 아이템 델타(공지-불일치)", () => {
    const delta: DeltaRecord = {
      ...baseDelta(),
      id: "item:3153:adoptionRate",
      entityType: "item",
      entityKey: "3153",
      entityName: "칠흑의 양날 도끼",
      metric: "adoptionRate",
      status: "announced-inconsistent",
    };
    expect(profile.buildUserPrompt(delta)).toBe(
      [
        "엔티티: 칠흑의 양날 도끼",
        "지표: 채택률",
        "이전 값: 51.2%",
        "이후 값: 54.1%",
        "변화: 2.9%p",
        "95% CI: [1.0%p, 4.8%p]",
        "표본 n: 이전=1200, 이후=1310",
        "현재 판정 상태: 공지-불일치(노트 방향과 관측이 다름)",
      ].join("\n")
    );
  });

  it("후보셋 해시가 커밋된 캐시의 실측값과 같다(캐시 866건 보존)", () => {
    for (const [patch, expected] of Object.entries(CACHED_CANDIDATE_SET_HASHES)) {
      const notes = loadNotes(patch);
      // 산출물이 없는 환경(얕은 클론)에서는 조용히 건너뛰지 않고 그 사실을 드러낸다.
      expect(notes, `notes-${patch}가 없다`).not.toBeNull();
      if (notes === null) continue;
      const hash = candidateSetHash(serializeCandidates(profile.candidatesOf(notes)));
      expect(hash, `${patch} 후보셋 해시`).toBe(expected);
    }
  });
});
