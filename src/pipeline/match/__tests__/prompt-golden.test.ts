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
import type { DdragonData } from "../../types";

interface GoldenEntry {
  promptRevision: string;
  instructionsSha256: string;
}
const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, "prompt-golden.json"), "utf8")) as Record<string, GoldenEntry[]>;

const profiles = [
  lolLlmProfile({} as unknown as DdragonData),
  tftLlmProfile,
  createPubgLlmProfile(new Map()),
];

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe("LLM 지시문 골든 가드", () => {
  for (const profile of profiles) {
    it(`${profile.game}: 현재 (개정 태그, 지시문 해시)가 이력에 있다 — 지시문을 고쳤으면 promptRevision을 올려라`, () => {
      const current = { promptRevision: profile.promptRevision ?? "", instructionsSha256: sha(profile.systemInstructions) };
      expect(GOLDEN[profile.game] ?? []).toContainEqual(current);
    });
    it(`${profile.game}: 한 태그에 해시는 하나다 — 태그를 안 올리고 해시만 갱신하는 우회 금지`, () => {
      const byRev = new Map<string, Set<string>>();
      for (const e of GOLDEN[profile.game] ?? []) {
        byRev.set(e.promptRevision, (byRev.get(e.promptRevision) ?? new Set()).add(e.instructionsSha256));
      }
      const dup = [...byRev].filter(([, hashes]) => hashes.size > 1).map(([rev]) => rev);
      expect(dup).toEqual([]);
    });
  }
});
