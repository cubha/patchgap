// ST-2 RED — LoL 어댑터. 모드 게이트와 26.17 실측 회귀를 계약으로 박는다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { diffLol, type DdragonSnapshot } from "../lol";
import { isSubmarineChange } from "../types";
import type { NoteLike } from "../note-link";

function snapshot(version: string): DdragonSnapshot {
  const read = (f: string) =>
    JSON.parse(readFileSync(`data/ddragon/${version}/${f}.json`, "utf8")).data as Record<string, unknown>;
  return { version, champions: read("champion"), items: read("item"), spells: {} } as DdragonSnapshot;
}

function notes(patch: string): NoteLike[] {
  const raw = JSON.parse(readFileSync(`data/aggregated/notes/${patch}.json`, "utf8")) as {
    items: NoteLike[];
  };
  return raw.items;
}

describe("diffLol — 모드 스코프 게이트", () => {
  it("소환사의 협곡(maps.11)이 아닌 아이템은 애초에 후보가 아니다", () => {
    // 실측 2026-09-21: 칼바람 전용 아이템 4종(도미닉 경의 인사·필멸자의 운명 = maps 30,
    // 리글의 랜턴·야생의 섬광 = maps 12/453)이 잠수함 후보로 잡혔다. 「클래식」 사건과 같은 축이다.
    const changes = diffLol(snapshot("16.16.1"), snapshot("16.17.1"), notes("26.17"), "26.17");
    const keys = new Set(changes.map((c) => c.entityKey));
    for (const aramOnly of ["223033", "223036", "223095", "773154", "773160"]) {
      expect(keys.has(aramOnly)).toBe(false);
    }
  });

  it("협곡 아이템은 통과한다", () => {
    const changes = diffLol(snapshot("16.16.1"), snapshot("16.17.1"), notes("26.17"), "26.17");
    expect(changes.some((c) => c.entityKey === "3095")).toBe(true);
  });
});

describe("diffLol — 26.16 → 26.17 회귀 (실측 고정)", () => {
  const changes = diffLol(snapshot("16.16.1"), snapshot("16.17.1"), notes("26.17"), "26.17");
  const submarines = changes.filter(isSubmarineChange);

  it("★ 잠수함은 폭풍갈퀴 가격 단 1건이다", () => {
    expect(submarines).toHaveLength(1);
    const only = submarines[0];
    expect(only.entityName).toBe("폭풍갈퀴");
    expect(only.entityKey).toBe("3095");
    expect(only.fieldPath).toBe("gold.total");
    expect(only.before).toBe(3000);
    expect(only.after).toBe(3200);
    expect(only.relChange).toBeCloseTo(200 / 3000, 10);
  });

  it("같은 아이템의 공격 속도 변경은 공지로 잡힌다 — 엔티티 단위로 뭉개지 않았다는 증거", () => {
    const speed = changes.find(
      (c) => c.entityKey === "3095" && c.fieldPath === "stats.PercentAttackSpeedMod"
    );
    expect(speed).toBeDefined();
    expect(isSubmarineChange(speed!)).toBe(false);
  });
});

describe("diffLol — 26.17 → 26.18 회귀 (실측 고정)", () => {
  it("수치 변경이 있고, 그 전부가 공지됐다 — 잠수함 0건", () => {
    const changes = diffLol(snapshot("16.17.1"), snapshot("16.18.1"), notes("26.18"), "26.18");
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.filter(isSubmarineChange)).toEqual([]);
  });

  it("노틸러스 공격력 61 → 58이 잡히고 공지로 분류된다", () => {
    const changes = diffLol(snapshot("16.17.1"), snapshot("16.18.1"), notes("26.18"), "26.18");
    const naut = changes.find(
      (c) => c.entityName === "노틸러스" && c.fieldPath === "stats.attackdamage"
    );
    expect(naut).toBeDefined();
    expect([naut!.before, naut!.after]).toEqual([61, 58]);
    expect(naut!.matchedNoteIds.length).toBeGreaterThan(0);
  });
});
