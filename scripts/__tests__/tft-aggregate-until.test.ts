// scripts/__tests__/tft-aggregate-until.test.ts
// C8(2026-09-28): 18.2 원본은 커밋 뒤(09-22)에 4매치가 더 붙어 2,500건이고 커밋 집계는 2,496건이다 —
// 그래서 재집계하면 같은 쌍의 숫자가 바뀌어 matchIds만 더할 수 없었다. 커밋 시각으로 자르면 정확히
// 재현된다(실측 2,496). 관측 시점 기록(observedUntil)은 C13 재수집 판단의 입력이다.
import { describe, expect, it } from "vitest";
import { cutAtUntil, observedUntilOf, parseArgs } from "../run-tft-aggregate";
import type { TftMatchSlim } from "../../src/pipeline/types";

const m = (id: string, iso: string) => ({ matchId: id, gameDatetimeMs: Date.parse(iso) }) as TftMatchSlim;

describe("run-tft-aggregate --until", () => {
  it("시각 이하 매치만 남긴다(경계 포함)", () => {
    const slim = [m("a", "2026-09-20T12:00:00Z"), m("b", "2026-09-20T12:57:00Z"), m("c", "2026-09-22T00:00:00Z")];
    expect(cutAtUntil(slim, Date.parse("2026-09-20T12:57:00Z")).map((x) => x.matchId)).toEqual(["a", "b"]);
    expect(cutAtUntil(slim, null)).toHaveLength(3);
  });
  it("관측 시점은 남은 매치의 가장 늦은 시각(ISO)", () => {
    expect(observedUntilOf([m("a", "2026-09-20T12:00:00Z"), m("b", "2026-09-21T00:00:00Z")])).toBe("2026-09-21T00:00:00.000Z");
  });
  it("--until을 ISO로 받는다", () => {
    expect(parseArgs(["--patch", "18.2", "--until", "2026-09-20T12:57Z"]).untilMs).toBe(Date.parse("2026-09-20T12:57Z"));
    expect(parseArgs(["--patch", "18.2"]).untilMs).toBeNull();
  });
});
