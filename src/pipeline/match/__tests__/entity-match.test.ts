import { describe, it, expect } from "vitest";
import { modeScopeFromAnchorUrl } from "../../shared/mode-scope";
import type { DdragonChampion, DdragonData, DdragonItem } from "../ddragon";
import { matchDeterministic } from "../entity-match";
import type { DeltaRecord, PatchNoteItem } from "../../types";

// 디스크 I/O 없이 매핑 인덱스만 필요한 최소 DdragonData — loadDdragon() 없이 직접 구성한다
// (entity-match.ts는 이미 로드된 객체를 주입받는 순수 함수라 이렇게 테스트하는 게 정직하다).
function makeDdragon(): DdragonData {
  const champions: Record<string, DdragonChampion> = {
    Aatrox: { id: "Aatrox", key: 266, name: "아트록스" },
    Graves: { id: "Graves", key: 104, name: "그레이브즈" },
  };
  const itemsByKoName: Record<string, DdragonItem[]> = {
    폭풍갈퀴: [
      { id: 3095, name: "폭풍갈퀴", into: [], from: [], gold: { base: 700, purchasable: true, total: 3200, sell: 2240 }, tags: [] },
    ],
    "세계 지도집": [
      { id: 3865, name: "세계 지도집", into: [], from: [], gold: { base: 400, purchasable: true, total: 400, sell: 160 }, tags: [] },
    ],
    "룬 나침반": [
      { id: 3866, name: "룬 나침반", into: [], from: [], gold: { base: 400, purchasable: true, total: 800, sell: 320 }, tags: [] },
    ],
    "빛과 어둠": [
      { id: 9999, name: "빛과 어둠", into: [], from: [], gold: { base: 0, purchasable: true, total: 3000, sell: 0 }, tags: [] },
    ],
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
      byKoName: (name) => itemsByKoName[name] ?? [],
      isCompleted: () => true,
    },
  };
}

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
    ...overrides,
    // modeScope는 앵커에서 파생시킨다 — 실제 데이터의 불변식(파서·마이그레이션이 같은 규칙을
    // 쓴다)과 픽스처를 어긋나게 두면, 모드 앵커를 쓰는 케이스가 조용히 core로 테스트된다.
    modeScope: overrides.modeScope ?? modeScopeFromAnchorUrl(overrides.anchorUrl ?? "https://example.com/#patch-aatrox"),
  };
}

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:Aatrox:winRate",
    entityType: "champion",
    entityKey: "Aatrox",
    entityName: "아트록스",
    metric: "winRate",
    before: 0.5,
    after: 0.55,
    delta: 0.05,
    ci: [0.01, 0.09],
    n: { before: 300, after: 300 },
    q: 0.01,
    status: "no-change",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...overrides,
  };
}

describe("matchDeterministic", () => {
  it("같은 챔피언(entityKey)이면 노트를 델타에 블로킹한다", () => {
    const ddragon = makeDdragon();
    const notes = [note({ id: "n1" })];
    const deltas = [delta({ id: "champion:Aatrox:winRate", entityKey: "Aatrox" })];

    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.get("champion:Aatrox:winRate")?.noteIds).toEqual(["n1"]);
  });

  it("매핑되지 않는 엔티티명은 mappingFailures에 담긴다", () => {
    const ddragon = makeDdragon();
    const notes = [note({ id: "n1", entity: "존재하지않는챔피언" })];
    const deltas: DeltaRecord[] = [];

    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.mappingFailures).toEqual(["존재하지않는챔피언"]);
    expect(result.matches.size).toBe(0);
  });

  it("같은 엔티티의 노트가 여럿이면 하나의 묶음(noteIds 배열)으로 본다", () => {
    const ddragon = makeDdragon();
    const notes = [
      note({ id: "n1", skill: "Q" }),
      note({ id: "n2", skill: "W" }),
      note({ id: "n3", skill: "E" }),
    ];
    const deltas = [delta({ id: "champion:Aatrox:pickRate", entityKey: "Aatrox" })];

    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.get("champion:Aatrox:pickRate")?.noteIds).toEqual(["n1", "n2", "n3"]);
  });

  it("노트 방향 다수결(buff 2 vs nerf 1)이 buff면 관측 상승과 일치 시 consistent", () => {
    const ddragon = makeDdragon();
    const notes = [
      note({ id: "n1", direction: "buff" }),
      note({ id: "n2", direction: "buff" }),
      note({ id: "n3", direction: "nerf" }),
    ];
    const deltas = [delta({ id: "champion:Aatrox:winRate", entityKey: "Aatrox", delta: 0.05 })];

    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.get("champion:Aatrox:winRate")?.directionAgreement).toBe("consistent");
  });

  it("노트가 nerf인데 관측이 상승이면 inconsistent", () => {
    const ddragon = makeDdragon();
    const notes = [note({ id: "n1", direction: "nerf" })];
    const deltas = [delta({ id: "champion:Aatrox:winRate", entityKey: "Aatrox", delta: 0.05 })];

    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.get("champion:Aatrox:winRate")?.directionAgreement).toBe("inconsistent");
  });

  it("노트 방향이 동률(buff 1, nerf 1)이면 neutral", () => {
    const ddragon = makeDdragon();
    const notes = [
      note({ id: "n1", direction: "buff" }),
      note({ id: "n2", direction: "nerf" }),
    ];
    const deltas = [delta({ id: "champion:Aatrox:winRate", entityKey: "Aatrox", delta: 0.05 })];

    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.get("champion:Aatrox:winRate")?.directionAgreement).toBe("neutral");
  });

  it("adjust/unknown 노트만 있으면 다수결에서 기권 처리되어 neutral", () => {
    const ddragon = makeDdragon();
    const notes = [note({ id: "n1", direction: "adjust" }), note({ id: "n2", direction: "unknown" })];
    const deltas = [delta({ id: "champion:Aatrox:winRate", entityKey: "Aatrox", delta: 0.05 })];

    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.get("champion:Aatrox:winRate")?.directionAgreement).toBe("neutral");
  });

  it("아이템은 entityType=item으로 블로킹된다", () => {
    const ddragon = makeDdragon();
    const notes = [note({ id: "n1", section: "item", entity: "폭풍갈퀴", direction: "nerf" })];
    const deltas = [
      delta({
        id: "item:3095:adoptionRate",
        entityType: "item",
        entityKey: "3095",
        entityName: "폭풍갈퀴",
        metric: "adoptionRate",
        delta: -0.02,
      }),
    ];

    const result = matchDeterministic(notes, deltas, ddragon);
    const match = result.matches.get("item:3095:adoptionRate");
    expect(match?.noteIds).toEqual(["n1"]);
    expect(match?.directionAgreement).toBe("consistent"); // nerf 노트 + 하락 관측 = 일치
  });

  it("lane/objective/summary 엔티티는 애초에 매칭 대상이 아니다", () => {
    const ddragon = makeDdragon();
    const notes = [note({ id: "n1" })];
    const deltas = [
      delta({
        id: "lane:TOP:goldAt10",
        entityType: "lane",
        entityKey: "TOP",
        entityName: "탑",
        metric: "goldAt10",
      }),
    ];
    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.size).toBe(0);
  });

  it("system/other 섹션 노트는 애초에 블로킹 후보에서 제외된다", () => {
    const ddragon = makeDdragon();
    const notes = [note({ id: "n1", section: "system", entity: "아트록스" })];
    const deltas = [delta({ id: "champion:Aatrox:winRate", entityKey: "Aatrox" })];
    const result = matchDeterministic(notes, deltas, ddragon);
    expect(result.matches.size).toBe(0);
  });
});

describe("modeScope 게이트 — 다른 게임 모드의 노트는 SR 델타와 짝짓지 않는다(2026-09-19)", () => {
  // 실측 배경: 26.18 "클래식"(LoL 클래식 — 2010~2017 시점 챔피언 복각 모드) 섹션의 피오라 65줄이
  // section="champion"으로 재분류돼 SR 피오라 델타와 짝지어졌고, 화면에 "공지"로 떴다.
  // 26.16→26.17 쌍에서는 짝지어진 351행 중 186행이 모드 노트에만 걸려 있었다.
  const ddragon = makeDdragon();

  it("클래식 모드 노트는 같은 챔피언이라도 버킷에 들어가지 않는다", () => {
    const outcome = matchDeterministic(
      [note({ id: "note:mode:1", modeScope: "classic", anchorUrl: "https://x/#patch-classic" })],
      [delta({ id: "champion:Aatrox:winRate", entityType: "champion", entityKey: "Aatrox" })],
      ddragon
    );
    expect(outcome.matches.size).toBe(0);
  });

  it("아레나·아수라장 노트도 마찬가지다", () => {
    for (const scope of ["arena", "aram"] as const) {
      const outcome = matchDeterministic(
        [note({ id: `note:mode:${scope}`, modeScope: scope })],
        [delta({ id: "champion:Aatrox:winRate", entityType: "champion", entityKey: "Aatrox" })],
        ddragon
      );
      expect(outcome.matches.size).toBe(0);
    }
  });

  it("모드 노트만 있으면 매핑 실패로도 세지 않는다 — 애초에 SR 대상이 아니다", () => {
    const outcome = matchDeterministic(
      [note({ id: "note:mode:2", entity: "존재하지않는챔피언", modeScope: "classic" })],
      [],
      ddragon
    );
    expect(outcome.mappingFailures).toHaveLength(0);
  });

  it("core 노트는 종전대로 짝지어진다(회귀 방지)", () => {
    const outcome = matchDeterministic(
      [note({ id: "note:core:1" })],
      [delta({ id: "champion:Aatrox:winRate", entityType: "champion", entityKey: "Aatrox" })],
      ddragon
    );
    expect(outcome.matches.get("champion:Aatrox:winRate")?.noteIds).toEqual(["note:core:1"]);
  });
});

// 2026-09-27: 26.19 아이템 섹션의 h4 하나가 두 아이템을 함께 말했다(「세계 지도집과 룬 나침반」).
// 통째로는 DDragon에 없어 매핑 실패로 버려졌고, 두 아이템의 델타가 노트와 짝지어지지 않았다.
describe("matchDeterministic — 합친 이름 노트", () => {
  const combined = note({
    id: "note:26.19:item:세계-지도집과-룬-나침반:c6bf0dd0",
    patch: "26.19",
    section: "item",
    entity: "세계 지도집과 룬 나침반",
    skill: null,
    anchorUrl: "https://example.com/#patch-items",
  });

  it("통째로 해소되지 않고 모든 조각이 아이템으로 해소되면 조각 각각에 짝짓는다", () => {
    const deltas = [
      delta({ id: "item:3865:adoptionRate", entityType: "item", entityKey: "3865", entityName: "세계 지도집" }),
      delta({ id: "item:3866:adoptionRate", entityType: "item", entityKey: "3866", entityName: "룬 나침반" }),
    ];
    const outcome = matchDeterministic([combined], deltas, makeDdragon());
    expect(outcome.matches.get("item:3865:adoptionRate")?.noteIds).toEqual([combined.id]);
    expect(outcome.matches.get("item:3866:adoptionRate")?.noteIds).toEqual([combined.id]);
    expect(outcome.mappingFailures).toEqual([]);
  });

  it("이름에 「과/와」가 있어도 통째로 해소되면 쪼개지 않는다", () => {
    const whole = note({ ...combined, id: "n-whole", entity: "빛과 어둠" });
    const deltas = [delta({ id: "item:9999:adoptionRate", entityType: "item", entityKey: "9999", entityName: "빛과 어둠" })];
    const outcome = matchDeterministic([whole], deltas, makeDdragon());
    expect(outcome.matches.get("item:9999:adoptionRate")?.noteIds).toEqual(["n-whole"]);
  });

  it("조각 하나라도 해소되지 않으면 쪼개지 않고 매핑 실패로 보고한다", () => {
    const partial = note({ ...combined, id: "n-partial", entity: "세계 지도집과 없는 아이템" });
    const outcome = matchDeterministic([partial], [], makeDdragon());
    expect(outcome.mappingFailures).toEqual(["세계 지도집과 없는 아이템"]);
  });
});

