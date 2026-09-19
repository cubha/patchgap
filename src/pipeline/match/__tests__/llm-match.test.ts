import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  callLlmForDelta,
  candidateSetHash,
  inferIndirectCandidates,
  serializeCandidates,
  summarizeProseHygiene,
  verifyCauses,
  verifySummaryCites,
} from "../llm-match";
import type { DdragonChampion, DdragonData, DdragonItem } from "../ddragon";
import type { DeltaRecord, PatchNoteItem } from "../../types";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:26.17:champion:aatrox:00000001",
    patch: "26.17",
    section: "champion",
    entity: "아트록스",
    skill: "Q",
    stat: "피해량",
    before: "10",
    after: "20",
    direction: "buff",
    summary: "피해량: 10 ⇒ 20",
    anchorUrl: "https://example.com/#patch-aatrox",
    anchorKind: "entity",
    modeScope: "core",
    ...overrides,
  };
}

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Aatrox:pickRate",
    entityType: "champion",
    entityKey: "Aatrox",
    entityName: "아트록스",
    metric: "pickRate",
    before: 0.1,
    after: 0.2,
    delta: 0.1,
    ci: [0.05, 0.15],
    n: { before: 1000, after: 1000 },
    q: 0.01,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...overrides,
  };
}

function makeDdragon(): DdragonData {
  const champions: Record<string, DdragonChampion> = {
    Aatrox: { id: "Aatrox", key: 266, name: "아트록스" },
    Graves: { id: "Graves", key: 104, name: "그레이브즈" },
  };
  const items: Record<number, DdragonItem> = {};
  return {
    version: "test",
    champions: {
      byKey: (id) => Object.values(champions).find((c) => c.key === id),
      byId: (id) => champions[id],
      byKoName: (name) => Object.values(champions).find((c) => c.name === name),
    },
    items: {
      byId: (id) => items[id],
      byKoName: (name) => Object.values(items).filter((it) => it.name === name),
      isCompleted: () => false,
    },
  };
}

function fakeClient(parseImpl: ReturnType<typeof vi.fn>): Anthropic {
  return { messages: { parse: parseImpl } } as unknown as Anthropic;
}

function fakeResponse(parsed_output: unknown, usageOverrides: Partial<Anthropic.Messages.Usage> = {}) {
  return {
    parsed_output,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_creation: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
      ...usageOverrides,
    },
  };
}

describe("serializeCandidates", () => {
  it("id 오름차순으로 정렬되며, 두 번 호출해도 완전히 동일한 문자열이 나온다(타임스탬프 없음)", () => {
    const notes = [note({ id: "n2" }), note({ id: "n1" })];
    const s1 = serializeCandidates(notes);
    const s2 = serializeCandidates(notes);
    expect(s1).toBe(s2);
    expect(JSON.parse(s1).map((n: { id: string }) => n.id)).toEqual(["n1", "n2"]);
  });

  it("입력 배열 순서를 바꿔도 결과가 동일하다(정렬 보장)", () => {
    const a = serializeCandidates([note({ id: "n1" }), note({ id: "n2" })]);
    const b = serializeCandidates([note({ id: "n2" }), note({ id: "n1" })]);
    expect(a).toBe(b);
  });
});

describe("candidateSetHash", () => {
  it("동일 입력에 동일 해시를 낸다", () => {
    const s = serializeCandidates([note({ id: "n1" })]);
    expect(candidateSetHash(s)).toBe(candidateSetHash(s));
  });
});

describe("verifyCauses", () => {
  const candidates = [note({ id: "n1", entity: "아트록스", section: "champion" }), note({ id: "n2", entity: "그레이브즈", section: "champion" })];

  it("후보셋에 존재하는 id + 다른 엔티티면 verified=true", () => {
    const ddragon = makeDdragon();
    const d = delta({ entityKey: "Aatrox" }); // n2는 그레이브즈(다른 엔티티)
    const result = verifyCauses(
      [{ candidateNoteId: "n2", text: "간접 영향 추정", confidence: "medium" }],
      candidates,
      d,
      ddragon
    );
    expect(result[0]).toEqual({ candidateNoteId: "n2", text: "간접 영향 추정", verified: true, confidence: "medium" });
  });

  it("후보셋에 없는 id는 verified=false·candidateNoteId=null(텍스트는 보존)", () => {
    const ddragon = makeDdragon();
    const d = delta({});
    const result = verifyCauses(
      [{ candidateNoteId: "n999", text: "존재하지 않는 노트", confidence: "low" }],
      candidates,
      d,
      ddragon
    );
    expect(result[0]).toEqual({ candidateNoteId: null, text: "존재하지 않는 노트", verified: false, confidence: "low" });
  });

  it("candidateNoteId가 null이면 그대로 verified=false", () => {
    const ddragon = makeDdragon();
    const result = verifyCauses(
      [{ candidateNoteId: null, text: "근거 부족", confidence: "low" }],
      candidates,
      delta({}),
      ddragon
    );
    expect(result[0].verified).toBe(false);
    expect(result[0].candidateNoteId).toBeNull();
  });

  it("자기 자신 엔티티를 가리키면(1단에서 이미 매칭됐어야 함) verified=false로 폐기", () => {
    const ddragon = makeDdragon();
    const d = delta({ entityKey: "Aatrox" }); // n1도 아트록스(자기 자신)
    const result = verifyCauses(
      [{ candidateNoteId: "n1", text: "직접 변경(자기참조)", confidence: "high" }],
      candidates,
      d,
      ddragon
    );
    expect(result[0].verified).toBe(false);
    expect(result[0].candidateNoteId).toBeNull();
    expect(result[0].text).toBe("직접 변경(자기참조)"); // 텍스트는 회색 표기용으로 보존
  });
});

describe("verifySummaryCites", () => {
  const candidates = [note({ id: "n1" }), note({ id: "n2" })];

  it("인용한 id가 모두 후보셋에 존재하면 true", () => {
    expect(verifySummaryCites(["n1", "n2"], candidates)).toBe(true);
  });

  it("빈 배열(델타 수치만 근거)은 항상 true", () => {
    expect(verifySummaryCites([], candidates)).toBe(true);
  });

  it("존재하지 않는 id가 하나라도 섞이면 false", () => {
    expect(verifySummaryCites(["n1", "n999"], candidates)).toBe(false);
  });
});

describe("callLlmForDelta", () => {
  it("messages.parse를 호출하고 usage를 반환한다", async () => {
    const parseFn = vi.fn().mockResolvedValue(
      fakeResponse({ causes: [], summary: "요약", summaryCites: [] }, { cache_creation_input_tokens: 500 })
    );
    const client = fakeClient(parseFn);
    const result = await callLlmForDelta(client, "claude-sonnet-5", delta({}), [note({})]);

    expect(parseFn).toHaveBeenCalledTimes(1);
    expect(result.parsed).toEqual({ causes: [], summary: "요약", summaryCites: [] });
    expect(result.usage.cacheCreationInputTokens).toBe(500);

    const callArgs = parseFn.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-5");
    expect(callArgs.thinking).toEqual({ type: "adaptive" });
    expect(callArgs.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("parsed_output이 null이면 그대로 null을 반환한다(스키마 파싱 실패)", async () => {
    const parseFn = vi.fn().mockResolvedValue(fakeResponse(null));
    const client = fakeClient(parseFn);
    const result = await callLlmForDelta(client, "claude-sonnet-5", delta({}), [note({})]);
    expect(result.parsed).toBeNull();
  });
});

describe("inferIndirectCandidates", () => {
  let tmpCacheDir: string;

  beforeEach(() => {
    tmpCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-cache-"));
  });

  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
  });

  it("unannounced/announced-inconsistent만 대상으로 삼는다", async () => {
    const parseFn = vi.fn().mockResolvedValue(fakeResponse({ causes: [], summary: "요약", summaryCites: [] }));
    const client = fakeClient(parseFn);
    const deltas = [
      delta({ id: "d1", status: "unannounced" }),
      delta({ id: "d2", status: "no-change" }),
      delta({ id: "d3", status: "announced-consistent" }),
      delta({ id: "d4", status: "announced-inconsistent" }),
    ];
    const result = await inferIndirectCandidates(deltas, [note({})], makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
    });
    expect(parseFn).toHaveBeenCalledTimes(2); // d1, d4만
    expect(result.summary.calls).toBe(2);
  });

  it("캐시 파일이 있으면 API 호출 0", async () => {
    const parseFn = vi.fn().mockResolvedValue(fakeResponse({ causes: [], summary: "첫 호출", summaryCites: [] }));
    const client = fakeClient(parseFn);
    const deltas = [delta({ id: "d1", status: "unannounced" })];
    const notes = [note({})];

    const first = await inferIndirectCandidates(deltas, notes, makeDdragon(), { client, cacheDir: tmpCacheDir });
    expect(first.summary.calls).toBe(1);
    expect(first.summary.cacheHits).toBe(0);

    parseFn.mockClear();
    const second = await inferIndirectCandidates(deltas, notes, makeDdragon(), { client, cacheDir: tmpCacheDir });
    expect(parseFn).not.toHaveBeenCalled();
    expect(second.summary.calls).toBe(0);
    expect(second.summary.cacheHits).toBe(1);
    expect(second.deltas[0].llm?.summary).toBe("첫 호출");
  });

  it("세션 호출 총 상한 초과 시 나머지는 causes=[]·llm.skipped=true(reason=call-budget-exceeded)", async () => {
    const parseFn = vi.fn().mockResolvedValue(fakeResponse({ causes: [], summary: "요약", summaryCites: [] }));
    const client = fakeClient(parseFn);
    const deltas = [
      delta({ id: "d1", status: "unannounced" }),
      delta({ id: "d2", status: "unannounced" }),
      delta({ id: "d3", status: "unannounced" }),
    ];
    const result = await inferIndirectCandidates(deltas, [note({})], makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
      maxTotalCalls: 1,
    });
    expect(parseFn).toHaveBeenCalledTimes(1);
    expect(result.summary.calls).toBe(1);
    expect(result.summary.skipped).toBe(2);
    const skippedOnes = result.deltas.filter((d) => d.llm?.skipped === true);
    expect(skippedOnes).toHaveLength(2);
    expect(skippedOnes[0].causes).toEqual([]);
    expect(skippedOnes[0].llm?.reason).toBe("call-budget-exceeded");
  });

  it("--llm-max로 대상 델타 수를 제한한다(상위 N건 밖은 손대지 않음)", async () => {
    const parseFn = vi.fn().mockResolvedValue(fakeResponse({ causes: [], summary: "요약", summaryCites: [] }));
    const client = fakeClient(parseFn);
    const deltas = [
      delta({ id: "d1", status: "unannounced" }),
      delta({ id: "d2", status: "unannounced" }),
    ];
    const result = await inferIndirectCandidates(deltas, [note({})], makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
      maxDeltas: 1,
    });
    expect(parseFn).toHaveBeenCalledTimes(1);
    expect(result.deltas.find((d) => d.id === "d2")?.llm).toBeUndefined(); // 손대지 않음
  });

  it("응답 스키마 파싱 실패(parsed_output=null)는 causes=[]·llm.skipped=true(reason=parse-failed)", async () => {
    const parseFn = vi.fn().mockResolvedValue(fakeResponse(null));
    const client = fakeClient(parseFn);
    const deltas = [delta({ id: "d1", status: "unannounced" })];
    const result = await inferIndirectCandidates(deltas, [note({})], makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
    });
    expect(result.deltas[0].causes).toEqual([]);
    expect(result.deltas[0].llm).toEqual({ skipped: true, reason: "parse-failed" });
  });

  it("RateLimitError는 캐시 폴백(캐시 없으면 회색 처리)하고 크래시하지 않는다", async () => {
    const rateLimitError = new Anthropic.RateLimitError(429, {}, "rate limited", new Headers());
    const parseFn = vi.fn().mockRejectedValue(rateLimitError);
    const client = fakeClient(parseFn);
    const deltas = [delta({ id: "d1", status: "unannounced" })];
    const result = await inferIndirectCandidates(deltas, [note({})], makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
    });
    expect(result.deltas[0].causes).toEqual([]);
    expect(result.deltas[0].llm).toEqual({ skipped: true, reason: "rate-limited" });
  });

  it("일반 APIError도 크래시 없이 회색 처리한다", async () => {
    const apiError = new Anthropic.InternalServerError(500, {}, "server error", new Headers());
    const parseFn = vi.fn().mockRejectedValue(apiError);
    const client = fakeClient(parseFn);
    const deltas = [delta({ id: "d1", status: "unannounced" })];
    const result = await inferIndirectCandidates(deltas, [note({})], makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
    });
    expect(result.deltas[0].llm?.skipped).toBe(true);
    expect(result.deltas[0].llm?.reason).toContain("api-error");
  });

  it("verified된 causes만 candidateNoteId를 유지한다(통합 경로)", async () => {
    const notes = [note({ id: "n1", entity: "그레이브즈", section: "champion" })];
    const parseFn = vi.fn().mockResolvedValue(
      fakeResponse({
        causes: [
          { candidateNoteId: "n1", text: "그레이브즈 조정의 간접 영향", confidence: "medium" },
          { candidateNoteId: "n404", text: "지어낸 노트", confidence: "low" },
        ],
        summary: "요약문",
        summaryCites: ["n1"],
      })
    );
    const client = fakeClient(parseFn);
    const deltas = [delta({ id: "d1", status: "unannounced", entityKey: "Aatrox" })];
    const result = await inferIndirectCandidates(deltas, notes, makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
    });
    const causes = result.deltas[0].causes;
    expect(causes[0]).toEqual({ candidateNoteId: "n1", text: "그레이브즈 조정의 간접 영향", verified: true, confidence: "medium" });
    expect(causes[1]).toEqual({ candidateNoteId: null, text: "지어낸 노트", verified: false, confidence: "low" });
    expect(result.deltas[0].llm?.summary).toBe("요약문");
    expect(result.deltas[0].llm?.summaryCites).toEqual(["n1"]);
    expect(result.deltas[0].llm?.summaryVerified).toBe(true);
  });

  it("summaryCites에 존재하지 않는 id가 섞이면 llm.summaryVerified=false(텍스트는 보존, 통합 경로)", async () => {
    const notes = [note({ id: "n1", entity: "그레이브즈", section: "champion" })];
    const parseFn = vi.fn().mockResolvedValue(
      fakeResponse({
        causes: [],
        summary: "지어낸 노트를 인용한 요약",
        summaryCites: ["n1", "n999"],
      })
    );
    const client = fakeClient(parseFn);
    const deltas = [delta({ id: "d1", status: "unannounced" })];
    const result = await inferIndirectCandidates(deltas, notes, makeDdragon(), {
      client,
      cacheDir: tmpCacheDir,
    });
    expect(result.deltas[0].llm?.summary).toBe("지어낸 노트를 인용한 요약"); // 텍스트는 보존
    expect(result.deltas[0].llm?.summaryCites).toEqual(["n1", "n999"]);
    expect(result.deltas[0].llm?.summaryVerified).toBe(false);
  });
});

describe("모드 노트 인용 기각(2026-09-19 근본수정)", () => {
  // 실측: 26.16→26.17 쌍의 verified 원인 453건 중 282건(62%)이 다른 게임 모드의 노트를 인용하면서
  // verified:true였다. 예: "피오라의 공격 속도 계수가 0.625에서 0.658로 상향되어 탑 결투 구도가
  // 불리해졌을 수 있습니다"(클래식 모드 피오라) — 라이브 SR에서 일어나지 않은 일이다.
  // verified는 "인용 id가 후보셋에 실존하는가"만 봤기 때문에 모드 오염을 구조적으로 못 잡았다.
  const ddragon = makeDdragon();

  it("모드 노트를 인용한 원인은 verified:false로 떨어지고 링크가 끊긴다(문장은 회색 표기용으로 보존)", () => {
    const modeNote = note({ id: "note:mode:classic:1", entity: "피오라", modeScope: "classic" });
    const causes = verifyCauses(
      [{ candidateNoteId: "note:mode:classic:1", text: "클래식 피오라 상향의 여파", confidence: "low" }],
      [modeNote],
      delta({ id: "champion:Olaf:pickRate", entityKey: "Olaf" }),
      ddragon
    );
    expect(causes[0].verified).toBe(false);
    expect(causes[0].candidateNoteId).toBeNull();
    expect(causes[0].text).toBe("클래식 피오라 상향의 여파");
  });

  it("core 노트 인용은 종전대로 verified:true다(회귀 방지)", () => {
    const coreNote = note({ id: "note:core:1", entity: "그레이브즈" });
    const causes = verifyCauses(
      [{ candidateNoteId: "note:core:1", text: "그레이브즈 상향의 여파", confidence: "medium" }],
      [coreNote],
      delta({ id: "champion:Olaf:pickRate", entityKey: "Olaf" }),
      ddragon
    );
    expect(causes[0].verified).toBe(true);
    expect(causes[0].candidateNoteId).toBe("note:core:1");
  });

  it("요약이 모드 노트를 인용하면 summaryVerified가 false다", () => {
    const modeNote = note({ id: "note:mode:aram:1", modeScope: "aram" });
    const coreNote = note({ id: "note:core:2" });
    expect(verifySummaryCites(["note:mode:aram:1"], [modeNote, coreNote])).toBe(false);
    expect(verifySummaryCites(["note:core:2"], [modeNote, coreNote])).toBe(true);
    expect(verifySummaryCites([], [modeNote])).toBe(true);
  });
});

describe("문장 위생 집계(2026-09-19 — 항목7 기계적 절반)", () => {
  // 프롬프트에 "한 문장은 80자 안팎"이 **이미 있는데** 실측 요약 113건 중 82건(72%)이 초과했고
  // 최대 132자였다. 문구를 더 적는 것으로는 안 되므로, 다음 실행이 **측정 가능**하도록 위반을 센다.
  // (프롬프트 v4 자체는 PROMPT_VERSION을 올려 캐시를 전량 무효화하므로 26.19 신규 실행에 묶는다.)
  it("길이 초과와 완곡 종결을 센다", () => {
    const stats = summarizeProseHygiene([
      { summary: "짧고 단정한 한 문장입니다.", causes: ["원인도 짧습니다."] },
      {
        summary: "가".repeat(81) + ".",
        causes: ["이 변화는 표본 변동일 가능성이 있습니다.", "영향이 있었을 수 있습니다."],
      },
    ]);
    expect(stats.summaryCount).toBe(2);
    expect(stats.summaryOverLength).toBe(1);
    expect(stats.causeCount).toBe(3);
    expect(stats.causeHedged).toBe(2);
    expect(stats.maxSummaryLength).toBeGreaterThan(80);
  });
});
