import { describe, it, expect } from "vitest";

import {
  cdragonSetNames,
  fetchTftCatalog,
  isCurrentSetKey,
  selectCurrentSetNames,
  setNumberOfPatch,
} from "../tft-catalog";

describe("setNumberOfPatch", () => {
  it("패치 주번호가 곧 세트 번호다", () => {
    expect(setNumberOfPatch("18.2")).toBe(18);
    expect(setNumberOfPatch("19.1")).toBe(19);
  });

  it("읽을 수 없으면 조용히 넘어가지 않고 던진다", () => {
    expect(() => setNumberOfPatch("알수없음")).toThrow(/세트 번호/);
  });
});

describe("isCurrentSetKey — 실측 키 형태", () => {
  it("경로에 세트가 박힌 유닛 키를 받는다", () => {
    expect(isCurrentSetKey("Maps/Shipping/Map22/Sets/TFTSet18/Shop/DA_Lux18_Base", 18)).toBe(true);
  });

  it("철 지난 세트의 같은 이름 유닛은 거른다", () => {
    expect(isCurrentSetKey("Maps/Shipping/Map22/Sets/TFTSet15/Shop/TFT15_Lux", 18)).toBe(false);
    expect(isCurrentSetKey("Maps/Shipping/Map22/Sets/TFTSetTutorial/Shop/TFTTutorial_Zed", 18)).toBe(false);
  });

  it("DA_ 네임스페이스(특성·증강)를 받는다", () => {
    expect(isCurrentSetKey("DA_18_Blackthorn", 18)).toBe(true);
    expect(isCurrentSetKey("DA_TheGoldenDragon", 18)).toBe(true);
  });

  it("DA_ 키에 다른 세트 번호가 박혀 있으면 거른다 — 세트가 바뀌면 조용히 섞인다", () => {
    expect(isCurrentSetKey("DA_18_Blackthorn", 19)).toBe(false);
    expect(isCurrentSetKey("DA_17_Something", 18)).toBe(false);
    // 번호가 없는 DA_ 항목은 세트 무관이라 받는다.
    expect(isCurrentSetKey("DA_TheGoldenDragon", 19)).toBe(true);
  });

  it("세트 없는 잡키는 거른다 — 「12골드」 오탐의 진원지다", () => {
    expect(isCurrentSetKey("TFT_Item_Gold12", 18)).toBe(false);
    expect(isCurrentSetKey("TFTEvent5YR_Coven", 18)).toBe(false);
  });
});

describe("selectCurrentSetNames", () => {
  const file = {
    data: {
      "Maps/Shipping/Map22/Sets/TFTSet18/Shop/DA_Lux18_Base": { name: "럭스" },
      "Maps/Shipping/Map22/Sets/TFTSet15/Shop/TFT15_Lux": { name: "럭스" },
      "Maps/Shipping/Map22/Sets/TFTSet15/Shop/TFT15_Kobuko": { name: "코부코(구)" },
      DA_18_Blackthorn: { name: "검은 가시" },
      TFT_Item_Gold12: { name: "12골드" },
      DA_18_NoName: {},
    },
  };

  it("현행 세트 이름만, 중복 없이, 정렬해서 돌려준다", () => {
    expect(selectCurrentSetNames(file, 18)).toEqual(["검은 가시", "럭스"]);
  });

  it("이름 없는 항목은 버린다", () => {
    expect(selectCurrentSetNames(file, 18)).not.toContain("");
  });
});

describe("fetchTftCatalog", () => {
  it("버전을 주면 versions.json을 조회하지 않는다", async () => {
    const calls: string[] = [];
    const fake: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      return new Response(JSON.stringify({ data: { DA_18_X: { name: "테스트" } } }), { status: 200 });
    };
    const catalog = await fetchTftCatalog({ patch: "18.2", version: "16.18.1", fetchImpl: fake });
    expect(calls.some((u) => u.includes("versions.json"))).toBe(false);
    expect(calls).toHaveLength(4);
    expect(catalog.units).toEqual(["테스트"]);
  });

  it("실패를 삼키지 않는다", async () => {
    const fake: typeof fetch = async () => new Response("nope", { status: 503 });
    await expect(fetchTftCatalog({ patch: "18.2", version: "16.18.1", fetchImpl: fake })).rejects.toThrow(/503/);
  });
});

// 2026-09-21 — DDragon `tft-champion.json`에 **덩굴정령·어미 부리가 아예 없어서** 그 두 줄이
// 「대상 미해소」로 버려졌고, 잠수함 판정이 그만큼 틀렸다(`docs/plan/VERIFY-tft-submarine-2026-09-21.md` §3).
// CDragon 추출본에는 둘 다 `DA_Brambleback18`·`DA_CrimsonRaptor18`로 있다 — 카탈로그를 보강한다.
describe("cdragonSetNames — CDragon 추출본으로 카탈로그를 보강한다", () => {
  const snapshot = {
    set: "TFTSet18",
    units: {
      DA_Brambleback18: { name: "덩굴정령" },
      DA_CrimsonRaptor18: { name: "어미 부리" },
      TFT_BlueGolem: { name: "골렘" },
      DA_18_NoName: {},
    },
    items: {
      DA_18_YordleSpirit: { name: "요들 수호령" },
      TFT17_MarketOffering_1star4cost_Eve: { name: "4단계" },
      DA_TheGoldenDragon: { name: "황금 드래곤" },
    },
  };

  it("현행 세트 이름만 뽑는다", () => {
    expect(cdragonSetNames(snapshot, 18)).toEqual({
      units: ["덩굴정령", "어미 부리"],
      items: ["요들 수호령", "황금 드래곤"],
    });
  });

  it("★ 철 지난 세트의 표시명 「4단계」를 들이지 않는다 — DDragon에서 이미 겪은 오탐이다", () => {
    expect(cdragonSetNames(snapshot, 18).items).not.toContain("4단계");
  });

  it("세트가 패치와 어긋나면 조용히 쓰지 않고 던진다", () => {
    expect(() => cdragonSetNames({ ...snapshot, set: "TFTSet17" }, 18)).toThrow(/세트/);
  });
});

describe("fetchTftCatalog — CDragon 보강", () => {
  const fake: typeof fetch = async () =>
    new Response(JSON.stringify({ data: { DA_18_X: { name: "카직스" } } }), { status: 200 });

  it("유닛·아이템에 CDragon 이름을 더하되 중복은 만들지 않는다", async () => {
    const catalog = await fetchTftCatalog({
      patch: "18.2",
      version: "16.18.1",
      fetchImpl: fake,
      cdragon: {
        set: "TFTSet18",
        units: { DA_Brambleback18: { name: "덩굴정령" }, DA_Kha18: { name: "카직스" } },
        items: { DA_18_YordleSpirit: { name: "요들 수호령" } },
      },
    });
    expect(catalog.units).toEqual(["카직스", "덩굴정령"]);
    expect(catalog.items).toEqual(["카직스", "요들 수호령"]);
    // 특성·증강은 CDragon 추출본에 없다 — 손대지 않는다.
    expect(catalog.traits).toEqual(["카직스"]);
  });

  it("주지 않으면 기존 동작 그대로다", async () => {
    const catalog = await fetchTftCatalog({ patch: "18.2", version: "16.18.1", fetchImpl: fake });
    expect(catalog.units).toEqual(["카직스"]);
  });
});
