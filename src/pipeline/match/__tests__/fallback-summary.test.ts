// src/pipeline/match/__tests__/fallback-summary.test.ts
// 결정론 수치 요약(C1·D1, 2026-09-28)은 **그 자체가** 100자 상한을 지켜야 한다 — 폴백이 상한을 넘으면
// 폴백의 존재 이유가 사라진다. 커밋된 전 쌍의 전 행(가장 긴 이름·지표 포함)으로 고정한다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lolLlmProfile } from "../llm-profile-lol";
import { tftLlmProfile } from "../llm-profile-tft";
import { createPubgLlmProfile } from "../llm-profile-pubg";
import { SUMMARY_MAX_CHARS, isNounEnding } from "../llm-match";
import type { DdragonData } from "../ddragon";
import type { DeltaRecord } from "../../types";
import type { PubgDeltaRow } from "../pubg-delta";

const AGG = path.join(process.cwd(), "data", "aggregated");
const rowsOf = <T,>(file: string): T[] => (JSON.parse(fs.readFileSync(file, "utf8")) as { rows: T[] }).rows;
const lolFiles = fs.readdirSync(path.join(AGG, "deltas")).filter((f) => /^\d+\.\d+_\d+\.\d+\.json$/.test(f)).map((f) => path.join(AGG, "deltas", f));
const tftFiles = fs.readdirSync(path.join(AGG, "tft")).filter((f) => f.startsWith("deltas-")).map((f) => path.join(AGG, "tft", f));

describe("결정론 수치 요약 — 상한·문장 규칙", () => {
  it("LoL 전 행이 100자 이하이고 명사형으로 끝나지 않는다", () => {
    const profile = lolLlmProfile({} as unknown as DdragonData);
    const bad = lolFiles.flatMap((f) => rowsOf<DeltaRecord>(f)).map((r) => profile.fallbackSummary?.(r) ?? "").filter((t) => t.length > SUMMARY_MAX_CHARS || isNounEnding(t));
    expect(bad).toEqual([]);
  });
  it("TFT 전 행이 100자 이하이고 명사형으로 끝나지 않는다", () => {
    const bad = tftFiles.flatMap((f) => rowsOf<DeltaRecord>(f)).map((r) => tftLlmProfile.fallbackSummary?.(r) ?? "").filter((t) => t.length > SUMMARY_MAX_CHARS || isNounEnding(t));
    expect(bad).toEqual([]);
  });
  it("PUBG 전 행이 100자 이하다", () => {
    const profile = createPubgLlmProfile(new Map());
    const bad = rowsOf<PubgDeltaRow>(path.join(AGG, "pubg", "deltas.json")).map((r) => profile.fallbackSummary?.(r) ?? "").filter((t) => t.length > SUMMARY_MAX_CHARS);
    expect(bad).toEqual([]);
  });
  it("수치와 상태 꼬리를 담는다", () => {
    const text = tftLlmProfile.fallbackSummary?.({
      entityName: "헤카림", metric: "top4Rate", before: 0.5, after: 0.62, delta: 0.12, status: "unannounced",
    } as DeltaRecord);
    expect(text).toBe("헤카림 순방률이 50.0%에서 62.0%로 바뀌었습니다(+12.0%p). 패치노트에 직접 조항이 없습니다.");
  });
});
