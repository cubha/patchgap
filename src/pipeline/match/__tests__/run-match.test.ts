// src/pipeline/match/__tests__/run-match.test.ts
// scripts/run-match.ts는 CLI 진입점이지만 `main()` 실행은 isMainModule 가드로 막혀 있어(다른
// 스크립트와 동일 패턴, src/pipeline/aggregate/__tests__/run-aggregate.test.ts 참고) import만으로는
// 부수효과가 없다 — parseArgs/runMatchPipeline을 그대로 단위 테스트한다. vitest include는
// src/**/*.test.ts만 수집하므로 이 파일 위치는 match/__tests__ 이지만 scripts/를 상대경로로 import.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs, runMatchPipeline } from "../../../../scripts/run-match";
import type { AggregatedPatch } from "../delta";
import type { DdragonChampion, DdragonData } from "../ddragon";
import type { ChampionStat, PatchNoteItem, PatchSummary } from "../../types";
import { STATUS_SORT_PRIORITY } from "../../shared/status-order";

describe("run-match: parseArgs", () => {
  it("--from/--to가 없으면 에러", () => {
    expect(() => parseArgs([])).toThrow(/--from/);
  });

  it("옵션을 전부 파싱한다", () => {
    expect(parseArgs(["--from", "26.16", "--to", "26.17", "--llm-max", "10", "--no-llm", "--dry-run"])).toEqual({
      from: "26.16",
      to: "26.17",
      llmMax: 10,
      noLlm: true,
      dryRun: true,
    });
  });

  // 2026-09-18: 기본값 50 → 120. 명세 변경 — llm-match.DEFAULT_MAX_DELTAS(2026-09-17에 120으로
  // 올림)와 CLI 기본값이 어긋나 로컬 실행은 여전히 50에서 잘렸다. 테스트를 통과시키려는 수정이
  // 아니라 두 기본값을 한 값으로 맞춘 것이다(사용자 보고 대상).
  it("--llm-max 기본값은 120(DEFAULT_MAX_DELTAS와 동일)", () => {
    expect(parseArgs(["--from", "26.16", "--to", "26.17"]).llmMax).toBe(120);
  });

  it("알 수 없는 인자는 에러", () => {
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--bogus"])).toThrow(/unknown argument/);
  });
});

// ─── runMatchPipeline: B4 후속 수정(2) — LLM 상위 N 정렬 회귀 테스트 ───

function champAllRow(overrides: Partial<ChampionStat>): ChampionStat {
  return {
    championId: 1,
    championKey: "Aatrox",
    championName: "Aatrox",
    position: "",
    patch: "26.17",
    scope: "all",
    totalMatches: 1000,
    n: 200,
    pickRate: 0.2,
    banRate: 0.1,
    winRate: 0.5,
    ci: { pick: [0.17, 0.23], ban: [0.08, 0.12], win: [0.43, 0.57] },
    ...overrides,
  };
}

function summaryStat(overrides: Partial<PatchSummary>): PatchSummary {
  return {
    patch: "26.17",
    matches: 1000,
    avgDurationSec: 1500,
    avgDurationSecSd: 300,
    firstDragonSecAvg: null,
    firstHeraldSecAvg: null,
    firstBaronSecAvg: null,
    firstTowerSecAvg: null,
    queueDistribution: { 420: 1000 },
    gameCreationMsRange: { min: 0, max: 1 },
    timelineSamples: 0,
    ...overrides,
  };
}

function makeDdragon(): DdragonData {
  const champions: Record<string, DdragonChampion> = {
    Aatrox: { id: "Aatrox", key: 1, name: "아트록스" },
    Graves: { id: "Graves", key: 2, name: "그레이브즈" },
  };
  return {
    version: "test",
    champions: {
      byKey: (id) => Object.values(champions).find((c) => c.key === id),
      byId: (id) => champions[id],
      byKoName: (name) => Object.values(champions).find((c) => c.name === name),
    },
    items: {
      byId: () => undefined,
      byKoName: () => [],
      isCompleted: () => false,
    },
  };
}

function fakeClient(parseImpl: ReturnType<typeof vi.fn>): Anthropic {
  return { messages: { parse: parseImpl } } as unknown as Anthropic;
}

function fakeParseResponse(deltaId: string) {
  return {
    parsed_output: { causes: [], summary: `요약(${deltaId})`, summaryCites: [] },
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_creation: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

describe("run-match: runMatchPipeline — LLM 상위 N은 정렬(중요도)순이어야 한다", () => {
  let tmpCacheDir: string;

  beforeEach(() => {
    // 격리된 임시 디렉토리 필수 — 고정 경로를 쓰면 이전 실행이 남긴 캐시 파일이 다음 실행에서
    // 캐시 히트로 잡혀 "실제 호출 1회"를 검증할 수 없게 된다(개발 중 실측한 함정).
    tmpCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-match-llm-cache-"));
  });

  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
  });

  it("--llm-max=1이면 |delta|가 더 큰 unannounced 델타만 LLM 대상이 된다(순회 순서 아님)", async () => {
    // Graves(delta 0.10)를 배열 앞에, Aatrox(delta 0.20)를 뒤에 둔다 — 정렬 없이 순회 순서 그대로
    // slice(0,1)했다면 Graves(작은 델타)가 뽑혔을 것이다. sortDeltas를 먼저 적용해야 Aatrox가 뽑힌다.
    const before: AggregatedPatch = {
      patch: "26.16",
      champions: [
        champAllRow({ championId: 2, championKey: "Graves", championName: "Graves", n: 1000, winRate: 0.5 }),
        champAllRow({ championId: 1, championKey: "Aatrox", championName: "Aatrox", n: 1000, winRate: 0.4 }),
      ],
      items: [],
      lanes: [],
      objectives: {
        patch: "26.16",
        n: 0,
        firstDragonSecAvg: null,
        firstHeraldSecAvg: null,
        firstBaronSecAvg: null,
        firstTowerSecAvg: null,
        dragon: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        herald: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        baron: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        tower: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
      },
      summary: summaryStat({ patch: "26.16", avgDurationSec: 1500 }),
    };
    const after: AggregatedPatch = {
      ...before,
      patch: "26.17",
      champions: [
        champAllRow({ championId: 2, championKey: "Graves", championName: "Graves", n: 1000, winRate: 0.6 }), // delta 0.10
        champAllRow({ championId: 1, championKey: "Aatrox", championName: "Aatrox", n: 1000, winRate: 0.6 }), // delta 0.20
      ],
      objectives: before.objectives,
      summary: summaryStat({ patch: "26.17", avgDurationSec: 1500 }), // 동일 → no-change
    };

    const parseFn = vi.fn().mockImplementation(async (params: { messages: Array<{ content: string }> }) => {
      const userContent = params.messages[0].content;
      const id = userContent.includes("Aatrox") ? "Aatrox" : "Graves";
      return fakeParseResponse(id);
    });
    const client = fakeClient(parseFn);

    const result = await runMatchPipeline({
      before,
      after,
      notes: [],
      ddragon: makeDdragon(),
      llmMax: 1,
      noLlm: false,
      llmOptions: { client, cacheDir: tmpCacheDir },
    });

    expect(parseFn).toHaveBeenCalledTimes(1);
    const aatroxWinRate = result.deltas.find((d) => d.id === "champion:Aatrox:winRate");
    const gravesWinRate = result.deltas.find((d) => d.id === "champion:Graves:winRate");
    expect(aatroxWinRate?.status).toBe("unannounced");
    expect(gravesWinRate?.status).toBe("unannounced");
    // 핵심 단언: 더 큰 델타(Aatrox, 0.20)만 LLM이 처리했어야 한다(배열상 순회 순서로는 Graves가 먼저).
    expect(aatroxWinRate?.llm).toBeDefined();
    expect(gravesWinRate?.llm).toBeUndefined();
  });

  // ST-IE3(2026-09-13) — LLM이 붙인 verified medium+ 원인을 근거로 3단 재분류가 일어나고,
  // status가 바뀐 뒤 **재정렬**되어 "항상 정렬된 상태로 반환" 계약이 유지되는지 검증한다.
  it("verified medium 원인이 붙은 unannounced는 indirect-effect로 재분류되고 재정렬된다", async () => {
    const itemNote: PatchNoteItem = {
      id: "note:26.17:item:stormrazor:aaaa",
      patch: "26.17",
      section: "item",
      entity: "폭풍갈퀴",
      skill: null,
      stat: "공격 속도",
      before: "20%",
      after: "25%",
      direction: "buff",
      summary: "공격 속도: 20% ⇒ 25%",
      anchorUrl: "https://example.com/#stormrazor",
      anchorKind: "entity",
    };

    const before: AggregatedPatch = {
      patch: "26.16",
      champions: [champAllRow({ championId: 1, championKey: "Aatrox", championName: "Aatrox", n: 1000, winRate: 0.4 })],
      items: [],
      lanes: [],
      objectives: {
        patch: "26.16",
        n: 0,
        firstDragonSecAvg: null,
        firstHeraldSecAvg: null,
        firstBaronSecAvg: null,
        firstTowerSecAvg: null,
        dragon: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        herald: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        baron: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        tower: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
      },
      summary: summaryStat({ patch: "26.16", avgDurationSec: 1500 }),
    };
    const after: AggregatedPatch = {
      ...before,
      patch: "26.17",
      champions: [champAllRow({ championId: 1, championKey: "Aatrox", championName: "Aatrox", n: 1000, winRate: 0.6 })],
      summary: summaryStat({ patch: "26.17", avgDurationSec: 1500 }),
    };

    const parseFn = vi.fn().mockResolvedValue({
      ...fakeParseResponse("Aatrox"),
      parsed_output: {
        causes: [
          {
            text: "폭풍갈퀴 공격 속도 강화가 아트록스 성능에 간접 영향을 줬을 수 있습니다",
            candidateNoteId: itemNote.id,
            confidence: "medium",
          },
        ],
        summary: "요약(Aatrox)",
        summaryCites: [],
      },
    });

    const result = await runMatchPipeline({
      before,
      after,
      notes: [itemNote],
      ddragon: makeDdragon(),
      llmMax: 5,
      noLlm: false,
      llmOptions: { client: fakeClient(parseFn), cacheDir: tmpCacheDir },
    });

    const aatrox = result.deltas.find((d) => d.id === "champion:Aatrox:winRate");
    expect(aatrox?.status).toBe("indirect-effect");
    expect(result.indirectEffectCount).toBe(1);
    // 원천 링크(노트 anchorUrl)가 채워지되, 1단 매칭 결과(matchedNoteId)는 오염되지 않는다.
    expect(aatrox?.evidence.noteAnchor).toBe("https://example.com/#stormrazor");
    expect(aatrox?.matchedNoteId).toBeNull();
    // 재정렬 계약: status 우선순위 오름차순이 유지된다.
    const priorities = result.deltas.map((d) => STATUS_SORT_PRIORITY[d.status]);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("--no-llm이면 재분류가 일어나지 않는다(indirectEffectCount=0)", async () => {
    const before: AggregatedPatch = {
      patch: "26.16",
      champions: [champAllRow({ championId: 1, championKey: "Aatrox", championName: "Aatrox", n: 1000, winRate: 0.4 })],
      items: [],
      lanes: [],
      objectives: {
        patch: "26.16",
        n: 0,
        firstDragonSecAvg: null,
        firstHeraldSecAvg: null,
        firstBaronSecAvg: null,
        firstTowerSecAvg: null,
        dragon: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        herald: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        baron: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
        tower: { n: 0, mean: null, sd: 0, occurrenceRate: 0 },
      },
      summary: summaryStat({ patch: "26.16", avgDurationSec: 1500 }),
    };
    const after: AggregatedPatch = { ...before, patch: "26.17" };

    const result = await runMatchPipeline({
      before,
      after,
      notes: [],
      ddragon: makeDdragon(),
      llmMax: 5,
      noLlm: true,
    });

    expect(result.indirectEffectCount).toBe(0);
    expect(result.deltas.some((d) => d.status === "indirect-effect")).toBe(false);
  });
});
