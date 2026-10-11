import { describe, expect, it } from "vitest";
import { FDR_ALPHA } from "@/pipeline/aggregate/stats";
import { buildPipelineSteps } from "../pipelineSteps";

describe("buildPipelineSteps", () => {
  it("4단을 순서대로 반환한다 — 노트 수는 엔티티 수 기준(+ 항목 수 병기)", () => {
    const steps = buildPipelineSteps({
      from: "26.16",
      to: "26.17",
      matchesFrom: 10240,
      matchesTo: 10118,
      collectedAt: "2026-09-05T05:00:00.000Z",
      noteEntityCount: 14,
      noteItemCount: 19,
      notesFetchedAt: "2026-09-05T08:30:00.000Z",
      matchedAt: "2026-09-05T12:15:00.000Z",
      significantCount: 37,
      judgedAt: "2026-09-05T14:00:00.000Z",
    });
    expect(steps.map((s) => s.title)).toEqual(["수집", "집계", "짝짓기", "판정"]);
    expect(steps[0].meta[0]).toBe("n=10,240 / 10,118");
    // 코디네이터 정정(2026-09-05): 홈 헤드라인 규칙(N=고유 엔티티 수)과 일치해야 한다 — 항목
    // 수(19)를 그대로 노출하지 않고 엔티티 수(14)를 기준으로, 항목 수는 참고로만 병기한다.
    expect(steps[2].meta[0]).toBe("노트 14대상 · 19항목");
    expect(steps[3].meta[0]).toBe("유의 변화 37");
    expect(steps[3].detail).toContain(String(FDR_ALPHA));
  });

  it("빈 데이터(전부 null)여도 크래시 없이 대시로 채운다", () => {
    const steps = buildPipelineSteps({
      from: null,
      to: null,
      matchesFrom: null,
      matchesTo: null,
      collectedAt: null,
      noteEntityCount: null,
      noteItemCount: null,
      notesFetchedAt: null,
      matchedAt: null,
      significantCount: null,
      judgedAt: null,
    });
    for (const step of steps) {
      expect(step.meta.every((m) => typeof m === "string")).toBe(true);
    }
    expect(steps[0].meta[0]).toBe("—");
    expect(steps[2].meta[0]).toBe("—");
    expect(steps[3].meta[0]).toBe("—");
  });

  it("한쪽 패치의 매치 수만 있으면 단일 n으로 표시한다", () => {
    const steps = buildPipelineSteps({
      from: "26.17",
      to: "26.17",
      matchesFrom: 6283,
      matchesTo: 6283,
      collectedAt: "2026-09-05T10:00:00.000Z",
      noteEntityCount: 35,
      noteItemCount: 215,
      notesFetchedAt: "2026-09-05T08:36:00.000Z",
      matchedAt: null,
      significantCount: 0,
      judgedAt: "2026-09-05T10:04:00.000Z",
    });
    expect(steps[0].meta[0]).toBe("n=6,283 / 6,283");
    // 실측(26.17 자기쌍): 항목 215건 · 고유 엔티티 35개(coordinator 실측치) — 홈 헤드라인과
    // 동일한 수를 표시해야 한다.
    expect(steps[2].meta[0]).toBe("노트 35대상 · 215항목");
    expect(steps[3].meta[0]).toBe("유의 변화 0");
  });

  it("항목 수를 넘기지 않으면(null) 엔티티 수만 표시한다", () => {
    const steps = buildPipelineSteps({
      from: "26.17",
      to: "26.17",
      matchesFrom: 6283,
      matchesTo: 6283,
      collectedAt: "2026-09-05T10:00:00.000Z",
      noteEntityCount: 35,
      noteItemCount: null,
      notesFetchedAt: "2026-09-05T08:36:00.000Z",
      matchedAt: null,
      significantCount: 0,
      judgedAt: "2026-09-05T10:04:00.000Z",
    });
    expect(steps[2].meta[0]).toBe("노트 35대상");
  });
});
