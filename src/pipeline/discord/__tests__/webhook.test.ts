import { describe, it, expect, vi } from "vitest";
import { buildBriefingEmbeds, formatDeltaLine, sendWebhook } from "../webhook";
import type { DeltaRecord, DeltasFile, MatchStatus } from "../../types";
import { itemHref } from "../../../lib/format";

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Aatrox:pickRate",
    entityType: "champion",
    entityKey: "Aatrox",
    entityName: "아트록스",
    metric: "pickRate",
    before: 0.1,
    after: 0.12,
    delta: 0.02,
    ci: [0.01, 0.03],
    n: { before: 6000, after: 6000 },
    q: 0.01,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...overrides,
  };
}

function deltasFile(rows: DeltaRecord[], counts: Partial<Record<MatchStatus, number>> = {}): DeltasFile {
  return {
    meta: {
      from: "26.16",
      to: "26.17",
      generatedAt: "2026-09-05T05:00:00.000Z",
      n: rows.length,
      counts,
      qAlpha: 0.1,
    },
    rows,
  };
}

const SITE = "https://patchgap.vercel.app";

describe("formatDeltaLine", () => {
  it("비율 지표는 %/%%p로 포맷한다", () => {
    const line = formatDeltaLine(delta({ metric: "pickRate", before: 0.1, after: 0.12, delta: 0.02, ci: [0.01, 0.03] }));
    expect(line).toContain("10.0%");
    expect(line).toContain("12.0%");
    expect(line).toContain("+2.0%p");
    expect(line).toContain("CI ±1.0");
  });

  it("골드 지표는 정수 포맷", () => {
    const line = formatDeltaLine(
      delta({ metric: "goldAt10", before: 3200, after: 3520, delta: 320, ci: [280, 360] })
    );
    expect(line).toBe("3,200 → 3,520 (+320, CI ±40)");
  });

  it("초(firstSec) 지표는 mm:ss + 부호초로 포맷", () => {
    const line = formatDeltaLine(
      delta({ metric: "firstSec", entityType: "objective", before: 480, after: 502, delta: 22, ci: [10, 34] })
    );
    expect(line).toBe("8:00 → 8:22 (+22s, CI ±12)");
  });

  it("before/after/delta가 null이면 데이터 없음", () => {
    expect(formatDeltaLine(delta({ before: null, after: null, delta: null }))).toBe("데이터 없음");
  });
});

describe("buildBriefingEmbeds", () => {
  it("미공지 상위 topN만 선택하고 |delta| 순서를 그대로 신뢰한다(이미 정렬됐다고 가정)", () => {
    const rows = [
      delta({ id: "a", status: "unannounced", delta: 0.09 }),
      delta({ id: "b", status: "unannounced", delta: 0.07 }),
      delta({ id: "c", status: "unannounced", delta: 0.05 }),
      delta({ id: "d", status: "unannounced", delta: 0.03 }),
      delta({ id: "e", status: "unannounced", delta: 0.02 }),
      delta({ id: "f", status: "unannounced", delta: 0.01 }), // topN=5 밖
    ];
    const [embed] = buildBriefingEmbeds(deltasFile(rows), { siteUrl: SITE, topN: 5 });
    expect(embed.fields).toHaveLength(5);
    const urls = embed.fields.map((f) => f.value).join("\n");
    expect(urls).toContain(itemHref("a"));
    expect(urls).toContain(itemHref("e"));
    expect(urls).not.toContain(itemHref("f"));
    expect(embed.description).toContain("미공지 6건");
  });

  it("id에 ':'가 있으면 링크가 '~' 치환 슬러그를 쓴다(퍼센트 인코딩 미사용, 2026-09-05 근본 수정)", () => {
    const rows = [delta({ id: "champion:Trundle:pickRate", status: "unannounced" })];
    const [embed] = buildBriefingEmbeds(deltasFile(rows), { siteUrl: SITE, topN: 5 });
    const urls = embed.fields.map((f) => f.value).join("\n");
    const url = `${SITE}/lol/item/champion~Trundle~pickRate/`;
    expect(urls).toContain(url);
    expect(url).not.toContain("%");
  });

  it("공지-불일치는 상위 3건만, 이름에 경고 표시가 붙는다", () => {
    const rows = [
      delta({ id: "u1", status: "unannounced" }),
      ...Array.from({ length: 5 }, (_, i) => delta({ id: `inc${i}`, status: "announced-inconsistent", matchedNoteId: "n1" })),
    ];
    const [embed] = buildBriefingEmbeds(deltasFile(rows), { siteUrl: SITE, topN: 5 });
    const warnFields = embed.fields.filter((f) => f.name.startsWith("⚠"));
    expect(warnFields).toHaveLength(3);
  });

  it("미공지 0건이면 description에 안내 문구", () => {
    const rows = [delta({ status: "no-change", q: 0.9, ci: [-0.01, 0.01] })];
    const [embed] = buildBriefingEmbeds(deltasFile(rows), { siteUrl: SITE });
    expect(embed.description).toContain("게이트를 통과한 미공지 변화 없음");
    expect(embed.fields).toHaveLength(0);
  });

  it("noteCount/matchCounts를 주면 헤드라인·footer에 반영, 없으면 생략/물음표", () => {
    const rows = [delta({ status: "unannounced" })];
    const [withCounts] = buildBriefingEmbeds(deltasFile(rows), {
      siteUrl: SITE,
      noteCount: 35,
      matchCounts: { from: 10240, to: 10118 },
    });
    // ST-11 HeroSummary와 통일된 문구("패치노트는 N개 엔티티를 말했고, 통계는 M개 변화를 말합니다").
    expect(withCounts.description).toContain("패치노트는 35개 엔티티를 말했고");
    expect(withCounts.description).toMatch(/통계는 \d+개 변화를 말합니다/);
    expect(withCounts.footer.text).toContain("n=10,240/10,118");

    const [withoutCounts] = buildBriefingEmbeds(deltasFile(rows), { siteUrl: SITE });
    expect(withoutCounts.description).not.toContain("패치노트는");
    expect(withoutCounts.description).toMatch(/^통계는 \d+개 변화를 말합니다/);
    expect(withoutCounts.footer.text).toContain("n=?/?");
  });

  it("검증된 원인은 텍스트를, 미검증은 '근거 미확인'을, 없으면 원인 줄 자체를 생략한다", () => {
    const verifiedRow = delta({
      id: "v",
      status: "unannounced",
      causes: [{ text: "간접 영향 후보", candidateNoteId: "n1", verified: true, confidence: "high" }],
    });
    const unverifiedRow = delta({
      id: "uv",
      status: "unannounced",
      causes: [{ text: "지어낸 후보", candidateNoteId: "n9", verified: false, confidence: "low" }],
    });
    const noCauseRow = delta({ id: "nc", status: "unannounced", causes: [] });

    const [embed] = buildBriefingEmbeds(deltasFile([verifiedRow, unverifiedRow, noCauseRow]), { siteUrl: SITE });
    expect(embed.fields[0].value).toContain("간접 영향 후보");
    expect(embed.fields[1].value).toContain("근거 미확인");
    expect(embed.fields[2].value.split("\n")).toHaveLength(1);
  });

  it("필드 name/value/총 문자수 제한을 지키고, 초과분은 '…외 k건'으로 표기한다", () => {
    const longCause = "가".repeat(2000);
    const rows = Array.from({ length: 40 }, (_, i) =>
      delta({
        id: `long-${i}`,
        status: "unannounced",
        causes: [{ text: longCause, candidateNoteId: "n1", verified: true, confidence: "high" }],
      })
    );
    const [embed] = buildBriefingEmbeds(deltasFile(rows), { siteUrl: SITE, topN: 40 });

    expect(embed.fields.length).toBeLessThanOrEqual(25);
    for (const f of embed.fields) {
      expect(f.name.length).toBeLessThanOrEqual(256);
      expect(f.value.length).toBeLessThanOrEqual(1024);
    }
    // 독립적으로 총 문자수를 다시 합산해 자체 검증한다(내부 카운터를 그대로 믿지 않는다).
    const total =
      embed.title.length +
      embed.description.length +
      embed.footer.text.length +
      embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0);
    expect(total).toBeLessThanOrEqual(6000);
    expect(embed.description).toMatch(/…외 \d+건/);
  });

  it("필드 25개 상한이 문자수보다 먼저 걸리는 경우도 '…외 k건'으로 표기한다", () => {
    // 값이 짧으면(≈110자/필드) 6,000자 예산보다 25개 필드 상한이 먼저 바닥난다 — 위 테스트(긴
    // causes)는 문자수 상한이 먼저 걸리는 경로만 검증했으므로, 이 테스트가 MAX_FIELDS 분기를 별도로 고정한다.
    const rows = Array.from({ length: 40 }, (_, i) => delta({ id: `short-${i}`, status: "unannounced" }));
    const [embed] = buildBriefingEmbeds(deltasFile(rows), { siteUrl: SITE, topN: 40 });

    expect(embed.fields).toHaveLength(25);
    expect(embed.description).toMatch(/…외 15건/);
  });

  it("항상 embed 1개(≤10 구조적으로 만족)", () => {
    const embeds = buildBriefingEmbeds(deltasFile([delta({})]), { siteUrl: SITE });
    expect(embeds).toHaveLength(1);
  });
});

describe("sendWebhook", () => {
  const URL = "https://discord.com/api/webhooks/123/super-secret-token";

  it("204 즉시 성공", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await sendWebhook(URL, { username: "patchgap", embeds: [] }, { fetchImpl });
    expect(result).toEqual({ status: 204, retries: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("429 → retry_after 대기 후 204 성공", async () => {
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "rate limited", retry_after: 0.25 }), { status: 429 })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await sendWebhook(URL, { username: "patchgap", embeds: [] }, { fetchImpl, sleepImpl });
    expect(result).toEqual({ status: 204, retries: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(250);
  });

  it("500이 maxRetries만큼 반복되면 그 자리에서 throw (기본 3회 시도)", async () => {
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(new Response("server error", { status: 500 }));

    await expect(
      sendWebhook(URL, { username: "patchgap", embeds: [] }, { fetchImpl, sleepImpl })
    ).rejects.toThrow(/5xx/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("400은 즉시 throw하고 에러 메시지에 웹훅 URL을 포함하지 않는다", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => new Response("bad request", { status: 400 }));

    await expect(
      sendWebhook(URL, { username: "patchgap", embeds: [] }, { fetchImpl })
    ).rejects.toThrow(/status=400/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    try {
      await sendWebhook(URL, { username: "patchgap", embeds: [] }, { fetchImpl });
      expect.unreachable("sendWebhook은 400에서 반드시 throw해야 한다");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(URL);
      expect(message).not.toContain("super-secret-token");
    }
  });

  it("429가 Retry-After 헤더만 있을 때도 대기 후 재시도한다", async () => {
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("not json", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await sendWebhook(URL, { username: "patchgap", embeds: [] }, { fetchImpl, sleepImpl });
    expect(result.status).toBe(200);
    expect(sleepImpl).toHaveBeenCalledWith(2000);
  });
});
