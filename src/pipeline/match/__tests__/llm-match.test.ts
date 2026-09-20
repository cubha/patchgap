import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  callLlmForDelta,
  candidateSetHash,
  inferIndirectCandidates,
  PROMPT_VERSION,
  serializeCandidates,
  summarizeProseHygiene,
  countProseViolations,
  buildProseRepairNote,
  isNounEnding,
  mergeRepairedProse,
  verifyCauses,
  verifySummaryCites,
} from "../llm-match";
import { lolLlmProfile, SYSTEM_INSTRUCTIONS_TEXT } from "../llm-profile-lol";
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
      lolLlmProfile(ddragon)
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
      lolLlmProfile(ddragon)
    );
    expect(result[0]).toEqual({ candidateNoteId: null, text: "존재하지 않는 노트", verified: false, confidence: "low" });
  });

  it("candidateNoteId가 null이면 그대로 verified=false", () => {
    const ddragon = makeDdragon();
    const result = verifyCauses(
      [{ candidateNoteId: null, text: "근거 부족", confidence: "low" }],
      candidates,
      delta({}),
      lolLlmProfile(ddragon)
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
      lolLlmProfile(ddragon)
    );
    expect(result[0].verified).toBe(false);
    expect(result[0].candidateNoteId).toBeNull();
    expect(result[0].text).toBe("직접 변경(자기참조)"); // 텍스트는 회색 표기용으로 보존
  });
});

describe("verifySummaryCites", () => {
  const candidates = [note({ id: "n1" }), note({ id: "n2" })];

  it("인용한 id가 모두 후보셋에 존재하면 true", () => {
    expect(verifySummaryCites(["n1", "n2"], candidates, lolLlmProfile(makeDdragon()))).toBe(true);
  });

  it("빈 배열(델타 수치만 근거)은 항상 true", () => {
    expect(verifySummaryCites([], candidates, lolLlmProfile(makeDdragon()))).toBe(true);
  });

  it("존재하지 않는 id가 하나라도 섞이면 false", () => {
    expect(verifySummaryCites(["n1", "n999"], candidates, lolLlmProfile(makeDdragon()))).toBe(false);
  });
});

describe("callLlmForDelta", () => {
  it("messages.parse를 호출하고 usage를 반환한다", async () => {
    const parseFn = vi.fn().mockResolvedValue(
      fakeResponse({ causes: [], summary: "요약", summaryCites: [] }, { cache_creation_input_tokens: 500 })
    );
    const client = fakeClient(parseFn);
    const result = await callLlmForDelta(client, "claude-sonnet-5", lolLlmProfile(makeDdragon()), delta({}), [note({})]);

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
    const result = await callLlmForDelta(client, "claude-sonnet-5", lolLlmProfile(makeDdragon()), delta({}), [note({})]);
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
    const result = await inferIndirectCandidates(deltas, [note({})], lolLlmProfile(makeDdragon()), {
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

    const first = await inferIndirectCandidates(deltas, notes, lolLlmProfile(makeDdragon()), { client, cacheDir: tmpCacheDir });
    expect(first.summary.calls).toBe(1);
    expect(first.summary.cacheHits).toBe(0);

    parseFn.mockClear();
    const second = await inferIndirectCandidates(deltas, notes, lolLlmProfile(makeDdragon()), { client, cacheDir: tmpCacheDir });
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
    const result = await inferIndirectCandidates(deltas, [note({})], lolLlmProfile(makeDdragon()), {
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
    const result = await inferIndirectCandidates(deltas, [note({})], lolLlmProfile(makeDdragon()), {
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
    const result = await inferIndirectCandidates(deltas, [note({})], lolLlmProfile(makeDdragon()), {
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
    const result = await inferIndirectCandidates(deltas, [note({})], lolLlmProfile(makeDdragon()), {
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
    const result = await inferIndirectCandidates(deltas, [note({})], lolLlmProfile(makeDdragon()), {
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
    const result = await inferIndirectCandidates(deltas, notes, lolLlmProfile(makeDdragon()), {
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
    const result = await inferIndirectCandidates(deltas, notes, lolLlmProfile(makeDdragon()), {
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
      lolLlmProfile(ddragon)
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
      lolLlmProfile(ddragon)
    );
    expect(causes[0].verified).toBe(true);
    expect(causes[0].candidateNoteId).toBe("note:core:1");
  });

  it("요약이 모드 노트를 인용하면 summaryVerified가 false다", () => {
    const modeNote = note({ id: "note:mode:aram:1", modeScope: "aram" });
    const coreNote = note({ id: "note:core:2" });
    expect(verifySummaryCites(["note:mode:aram:1"], [modeNote, coreNote], lolLlmProfile(makeDdragon()))).toBe(false);
    expect(verifySummaryCites(["note:core:2"], [modeNote, coreNote], lolLlmProfile(makeDdragon()))).toBe(true);
    expect(verifySummaryCites([], [modeNote], lolLlmProfile(makeDdragon()))).toBe(true);
  });
});

describe("문장 위생 집계(2026-09-19 — 항목7)", () => {
  // 프롬프트에 "한 문장은 80자 안팎"이 **이미 있는데** 실측 요약 113건 중 82건(72%)이 초과했고
  // 최대 132자였다. 문구를 더 적는 것으로는 안 되므로 위반을 센다.
  // 2026-09-19 **명세 변경 ①**(독립 채점 K1-7): 상한 하나로 요약·원인을 같이 세면 프롬프트가
  // 지시하는 값(요약 100자·원인 80자)과 계측이 어긋난다. 상수를 분리했으므로 두 상한을 각각 본다.
  // 2026-09-19 **명세 변경 ②**(v5, 이월 해소): 입력이 `string[]`에서 `{text, confidence}[]`로
  // 바뀌었다. 완곡 표현은 confidence가 low인 문장에서는 **정당하므로**, 총량(causeHedged)만으로는
  // 결함을 셀 수 없다 — 근거가 분명한데 흐린 문장(causeHedgedConfident)이 실제 계측점이다.
  // 둘 다 통과시키려고 고친 것이 아니라 세는 기준 자체가 바뀐 경우다.
  it("요약 100자·원인 80자 상한을 각각 세고, 완곡 종결도 센다", () => {
    const stats = summarizeProseHygiene([
      { summary: "짧고 단정한 한 문장입니다.", causes: [{ text: "원인도 짧습니다.", confidence: "high" }] },
      {
        // 81자 요약은 상한(100자) 안이라 초과로 세지 않는다 — 옛 단일 상한(80자)에서는 셌다.
        summary: "가".repeat(81) + ".",
        causes: [
          { text: "이 변화는 표본 변동일 가능성이 있습니다.", confidence: "low" },
          { text: "영향이 있었을 수 있습니다.", confidence: "high" },
        ],
      },
      { summary: "나".repeat(101) + ".", causes: [{ text: "다".repeat(81) + ".", confidence: "medium" }] },
    ]);
    expect(stats.summaryCount).toBe(3);
    expect(stats.summaryOverLength).toBe(1);
    expect(stats.causeCount).toBe(4);
    expect(stats.causeOverLength).toBe(1);
    expect(stats.causeHedged).toBe(2);
    expect(stats.maxSummaryLength).toBeGreaterThan(100);
  });

  it("완곡 표현은 low에서 정당하고, high·medium일 때만 결함으로 센다", () => {
    const stats = summarizeProseHygiene([
      {
        summary: null,
        causes: [
          { text: "표본 변동일 가능성이 있습니다.", confidence: "low" }, // 정당
          { text: "정글 경쟁에서 밀렸을 수 있습니다.", confidence: "high" }, // 결함
          { text: "정글 경쟁에서 밀렸습니다.", confidence: "high" }, // 단정 — 목표 형태
        ],
      },
    ]);
    expect(stats.causeHedged).toBe(2);
    expect(stats.causeHedgedConfident).toBe(1);
  });
});

// 2026-09-19 최종 채점 K1-7·K4-4(中): v5 산출 원인 11건이 "…브루저 경쟁에서 밀린 영향."처럼
// 명사형으로 끝나 같은 카드의 합쇼체와 섞여 노출됐다. ACCEPT-prose-v5가 "억지 명사형·문체 혼입"을
// 위험으로 적어 놓고 게이트에 그 검사를 넣지 않은 것이 원인이다. 프롬프트를 고치면
// PROMPT_VERSION을 올려야 하고 그러면 지금 통과하는 문장까지 전부 다시 굴리므로, 230건 중 13건만
// 고치도록 **호출부와 캐시**에서 닫는다.
describe("명사형 종결 검출(최종 채점 K1-7)", () => {
  it("합쇼체로 끝나면 위반이 아니다", () => {
    expect(isNounEnding("정글 상성에서 밀렸습니다.")).toBe(false);
    expect(isNounEnding("교전 주도권이 옮겨졌습니다")).toBe(false);
  });

  it("말미 괄호주·따옴표를 벗기고 본다 — 오탐은 불필요한 재요청을 부른다", () => {
    // 2026-09-19 최종 확인 지적: `.!?`만 벗기던 탓에 "…했습니다(26.18 기준)."이 명사형으로 잡혔다.
    // 재요청은 근거를 건드릴 수 있는 경로라(mergeRepairedProse 주석) 오탐을 방치할 수 없다.
    expect(isNounEnding("정글 상성에서 밀렸습니다(26.18 기준).")).toBe(false);
    expect(isNounEnding('"베릴 스폰율 조정" 항목과 대조했습니다.')).toBe(false);
    expect(isNounEnding("밴 우선순위가 이동(26.18).")).toBe(true);
  });

  it("명사로 끝나면 위반이다", () => {
    expect(isNounEnding("브루저 경쟁에서 밀린 영향.")).toBe(true);
    expect(isNounEnding("서포트 밴 우선순위가 파이크로 이동.")).toBe(true);
    expect(isNounEnding("정글 주도권 재분배.")).toBe(true);
  });

  it("위생 집계가 명사형 원인을 센다", () => {
    const stats = summarizeProseHygiene([
      {
        summary: "요약은 단정합니다.",
        causes: [
          { text: "밀렸습니다.", confidence: "high" },
          { text: "밀린 영향.", confidence: "high" },
          { text: "파이크로 이동.", confidence: "low" },
        ],
      },
    ]);
    expect(stats.causeCount).toBe(3);
    expect(stats.causeNounEnding).toBe(2);
  });
});

describe("길이 재요청(v5) — 문구가 아니라 호출부가 닫는다", () => {
  // v4가 "80자 안팎"을 숫자로 바꿔 요약 초과를 72% → 2~4%로 줄였다. 남은 2~4%를 더 강한 문구로
  // 0으로 만들려는 것은 이미 멈춘 레버를 다시 당기는 일이라, 위반한 응답에만 1회 되묻는다.
  const out = (summary: string, causes: string[]) => ({
    summary,
    summaryCites: [],
    causes: causes.map((text) => ({ text, candidateNoteId: null, confidence: "low" as const })),
  });

  it("상한 안이면 재요청하지 않는다(위반 0)", () => {
    expect(countProseViolations(out("짧은 요약입니다.", ["짧은 원인입니다."]))).toBe(0);
  });

  it("요약·원인 위반을 각각 센다", () => {
    expect(countProseViolations(out("가".repeat(101), ["나".repeat(81), "짧습니다."]))).toBe(2);
  });

  it("명사형 종결도 재요청 대상이다 — 길이만 보면 11건이 통과해 버린다", () => {
    expect(countProseViolations(out("짧은 요약입니다.", ["브루저 경쟁에서 밀린 영향."]))).toBe(1);
  });

  it("재요청 문구가 실제 글자 수와 상한을 함께 짚는다", () => {
    const note = buildProseRepairNote(out("가".repeat(110), ["나".repeat(90)]));
    expect(note).toContain("110자");
    expect(note).toContain("100자 이하");
    expect(note).toContain("causes[0]");
    expect(note).toContain("90자");
    // 인용·신뢰도를 흔들면 검증 단계가 다른 것을 보게 된다 — 표현만 고치라고 못박는다.
    expect(note).toContain("candidateNoteId");
  });

  // 2026-09-19 재판정: 재요청 응답을 **통째로** 채택했더니 인용 7행·confidence 3행이 바뀌고
  // `champion:Pyke:banRate`의 판정이 unannounced → indirect-effect로 뒤집혔다(3단 재분류가
  // 원인 문장을 보기 때문). PLAN §3은 "판정 엔진 불변 · 전부 표시·산문 계층"이었고 재요청 문구도
  // "candidateNoteId와 confidence는 그대로 두세요"라고 말하지만, **아무것도 그것을 강제하지
  // 않았다.** 문구는 계약이 아니다 — 코드가 계약이다. 그래서 문장만 갈아끼운다.
  describe("재요청 병합 — 근거는 원본을 지킨다", () => {
    const original = {
      summary: "원래 요약입니다.",
      summaryCites: ["note:a"],
      causes: [
        { text: "밀린 영향.", candidateNoteId: "note:a", confidence: "high" as const },
        { text: "짧습니다.", candidateNoteId: "note:b", confidence: "low" as const },
      ],
    };

    it("원인 문장만 가져오고 인용·신뢰도는 원본을 쓴다", () => {
      const repaired = {
        summary: "원래 요약입니다.",
        summaryCites: ["note:a"],
        causes: [
          { text: "밀렸습니다.", candidateNoteId: "note:ZZZ", confidence: "low" as const },
          { text: "짧습니다.", candidateNoteId: "note:YYY", confidence: "high" as const },
        ],
      };
      const merged = mergeRepairedProse(original, repaired);
      expect(merged).not.toBeNull();
      expect(merged?.causes[0].text).toBe("밀렸습니다.");
      expect(merged?.causes[0].candidateNoteId).toBe("note:a");
      expect(merged?.causes[0].confidence).toBe("high");
      expect(merged?.causes[1].candidateNoteId).toBe("note:b");
      expect(merged?.causes[1].confidence).toBe("low");
    });

    it("원인 개수가 달라지면 병합하지 않는다 — 짝을 지을 수 없다", () => {
      const repaired = { ...original, causes: [original.causes[0]] };
      expect(mergeRepairedProse(original, repaired)).toBeNull();
    });

    it("요약 인용이 바뀌면 요약은 원본을 쓴다 — 문장과 인용은 한 쌍이다", () => {
      const repaired = { ...original, summary: "새 요약입니다.", summaryCites: ["note:b"] };
      const merged = mergeRepairedProse(original, repaired);
      expect(merged?.summary).toBe("원래 요약입니다.");
      expect(merged?.summaryCites).toEqual(["note:a"]);
    });

    it("요약 인용이 같으면 새 요약을 쓴다", () => {
      const repaired = { ...original, summary: "새 요약입니다." };
      expect(mergeRepairedProse(original, repaired)?.summary).toBe("새 요약입니다.");
    });
  });

  it("재요청 문구가 명사형 종결을 어떻게 고칠지 말한다", () => {
    const note = buildProseRepairNote(out("짧은 요약입니다.", ["밴 우선순위가 파이크로 이동."]));
    expect(note).toContain("causes[0]");
    expect(note).toContain("합쇼체");
  });
});

describe("후보 풀 정화(2026-09-19 항목7 — 프롬프트 v4와 같은 실행에 묶는다)", () => {
  // 사후 기각(verifyCauses)만으로는 모델이 **인용할 수 없는 항목을 계속 보게 된다**. 실측으로
  // 26.17 노트 215건 중 173건이 모드 섹션이라, 모델은 프롬프트의 80%를 쓸 수 없는 후보로 읽고
  // 있었다. 풀에서 빼면 프롬프트가 1/4로 줄고 남은 SR 후보에 집중된다. 대신 candidateSetHash가
  // 바뀌어 캐시가 전량 무효가 되므로 PROMPT_VERSION 상향과 **한 번에** 처리한다.
  it("serializeCandidates에 넘기기 전에 모드 노트를 걷어낸다", () => {
    const core = note({ id: "core-1" });
    const classic = note({ id: "classic-1", modeScope: "classic", anchorUrl: "https://x/#patch-classic" });
    const serialized = serializeCandidates(lolLlmProfile(makeDdragon()).candidatesOf([core, classic]));
    expect(serialized).toContain("core-1");
    expect(serialized).not.toContain("classic-1");
  });

  it("전부 모드 노트면 후보는 빈 배열이다(그 패치엔 인용할 SR 조항이 없다)", () => {
    const classic = note({ id: "classic-1", modeScope: "classic", anchorUrl: "https://x/#patch-classic" });
    expect(lolLlmProfile(makeDdragon()).candidatesOf([classic])).toEqual([]);
  });
});

describe("프롬프트 v5 — 길이 상한과 완곡 표현(2026-09-19 항목7)", () => {
  it("글자 수 상한을 숫자로 못박는다", () => {
    // 규칙 9에 "80자 안팎"이 **이미 있었는데** 26.18 요약 102건 중 72건이 초과했다(최장 124자).
    // 어림수("안팎")는 지켜지지 않으므로 숫자와 세는 방법을 준다.
    expect(SYSTEM_INSTRUCTIONS_TEXT).toContain("100자");
    expect(SYSTEM_INSTRUCTIONS_TEXT).toContain("80자");
    expect(SYSTEM_INSTRUCTIONS_TEXT).not.toContain("80자 안팎");
  });

  it("완곡 표현을 confidence와 묶는다 — 금지도 방임도 아니다", () => {
    // 완곡 자체는 추론 문장에서 정당하므로 금지하지 않는다(금지하면 무근거 확신이 되어 회색
    // 원칙과 충돌한다). 대신 **어디에 쓰는지**를 정한다: low에만. 규칙 11이 그 반작용(단정하려고
    // confidence를 올리는 것)을 막는다.
    expect(SYSTEM_INSTRUCTIONS_TEXT).toContain("confidence가 low인");
    expect(SYSTEM_INSTRUCTIONS_TEXT).toContain("confidence를 low로 내리고");
  });

  it("PROMPT_VERSION이 올라가 옛 캐시를 재사용하지 않는다", () => {
    // 프롬프트를 바꾸고 버전을 안 올리면, 캐시된 답이 그것을 만들지 않은 프롬프트에 귀속된다.
    expect(PROMPT_VERSION).toBe("v5");
  });
});
