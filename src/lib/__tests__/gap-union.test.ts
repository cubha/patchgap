// src/lib/__tests__/gap-union.test.ts
// C15(2026-09-28, 사용자 결정 D2 지금분) — 「미공지 Gap」은 **대상**을 센다(사용자 확정 7: 세는 단위는 대상).
// TFT만 타일이 행 수(35)를 셌고, 탭은 행 35 + 잠수함 4 = 39로 **이중 집계**(마스터 이가 통계 Gap이자 잠수함)
// + 단위 혼합이었다. 대상 합집합이면 타일 31 · 탭 34.
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { gapEntityKeys, gapUnionCount } from "../gamedata";
import type { SubmarineSummary } from "../gamedata";

const row = (entityType: string, entityKey: string) => ({ entityType, entityKey }) as { entityType: string; entityKey: string };
const sub = (keys: [string, string][], mismatch: [string, string][] = []) =>
  ({
    entities: keys.map(([entityType, entityKey]) => ({ entityType, entityKey, entityName: entityKey, changes: [] })),
    mismatches: mismatch.map(([entityType, entityKey]) => ({ entityType, entityKey, entityName: entityKey, changes: [] })),
  }) as unknown as SubmarineSummary;

describe("미공지 Gap 대상 합집합", () => {
  it("행이 아니라 대상을 센다 — 한 대상의 두 지표는 하나", () => {
    expect(gapEntityKeys([row("unit", "A"), row("unit", "A"), row("trait", "B")]).size).toBe(2);
  });
  it("통계 Gap과 잠수함이 겹치는 대상은 한 번만 센다", () => {
    const keys = gapEntityKeys([row("unit", "MasterYi"), row("unit", "B")]);
    expect(gapUnionCount(keys, sub([["unit", "MasterYi"], ["item", "C"]]))).toBe(3);
  });
  it("값 어긋남(mismatch) 대상도 합집합에 든다", () => {
    expect(gapUnionCount(new Set(), sub([], [["unit", "D"]]))).toBe(1);
  });
  it("수치 축이 없으면 통계 Gap 대상 수 그대로", () => {
    expect(gapUnionCount(new Set(["unit:A"]), null)).toBe(1);
  });
});
