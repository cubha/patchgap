// src/pipeline/shared/__tests__/boundary.test.ts
// 경계 판정(트랙 B ST-25, 2026-10-11 site-review pubg-S13 — §8 동등성으로 세 게임). 리뷰 실측: PUBG Crossbow −13.2%(바닥 13.2%)는
// CI [−19.9%, −6.0%]가 바닥 안쪽까지 걸치는데, CI 전체가 바닥 밖인 Beryl [+14.0%, +17.5%]과 같은 「미공지」 배지·같은 무게였다.
// 판정은 바꾸지 않는다(점추정이 바닥을 넘었다) — 확신도가 다르다는 사실만 「경계」로 구별한다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isBoundaryPubgRow, isBoundaryRecord } from "../boundary";

describe("isBoundaryRecord — LoL·TFT(DeltaRecord, 지표별 바닥)", () => {
  const rec = (delta: number, ci: [number, number]) => ({ metric: "winRate" as const, delta, before: 0.5, ci });
  it("점추정은 바닥(2%p)을 넘고 CI 안쪽 끝은 바닥 아래 → 경계", () => {
    expect(isBoundaryRecord(rec(0.03, [0.01, 0.05]))).toBe(true);
  });
  it("CI 전체가 바닥 밖 → 경계 아님", () => {
    expect(isBoundaryRecord(rec(0.05, [0.03, 0.07]))).toBe(false);
  });
  it("음수 방향도 같다", () => {
    expect(isBoundaryRecord(rec(-0.03, [-0.05, -0.01]))).toBe(true);
    expect(isBoundaryRecord(rec(-0.05, [-0.07, -0.03]))).toBe(false);
  });
  it("점추정이 바닥 아래면(표에 안 오르는 바닥 미달) 경계가 아니다", () => {
    expect(isBoundaryRecord(rec(0.01, [0.005, 0.015]))).toBe(false);
  });
  it("CI가 없으면 판단하지 않는다", () => {
    expect(isBoundaryRecord({ metric: "winRate", delta: 0.03, before: 0.5, ci: null })).toBe(false);
  });
});

describe("isBoundaryPubgRow — PUBG(상대 변화 CI, 쌍의 바닥) 실측", () => {
  const dir = path.resolve(__dirname, "../../../../data/aggregated/pubg");
  const file = fs.readdirSync(dir).find((f) => f === "deltas.json");
  it("PUBG 판정 산출물이 있다", () => expect(file).toBeDefined());
  it("Crossbow·M9·L6은 경계, Beryl·Groza는 아니다", () => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, file!), "utf8")) as {
      meta: { effectFloor: number };
      rows: { weaponName: string; relCi: [number, number]; status: string }[];
    };
    const by = (name: string) => d.rows.find((r) => r.weaponName === name)!;
    for (const name of ["Crossbow", "M9", "L6"]) expect(isBoundaryPubgRow(by(name), d.meta.effectFloor), name).toBe(true);
    for (const name of ["Beryl M762", "Groza"]) expect(isBoundaryPubgRow(by(name), d.meta.effectFloor), name).toBe(false);
  });
});
