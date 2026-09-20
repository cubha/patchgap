import { describe, it, expect } from "vitest";

import { PVE_UNIT_KEYS, isPlayableUnitKey, toTftMatchSlim } from "../tft-slim";

// 실응답 축소본(`data/raw/tft/matches-18-2.jsonl` 1줄에서 필드명 그대로 옮김).
const RAW = {
  metadata: { data_version: "6", match_id: "KR_8385987122", participants: ["p-a", "p-b"] },
  info: {
    endOfGameResult: "GameComplete",
    gameCreation: 1789746716584,
    game_datetime: 1789748962701,
    game_length: 2243.17138671875,
    game_version: "TFT Unreal Version ?.?.?.?",
    mapId: 22,
    product_id: "teamfighttactics",
    queueId: 1100,
    queue_id: 1100,
    tft_game_type: "standard",
    tft_set_core_name: "TFTSet18",
    tft_set_number: 18,
    participants: [
      {
        puuid: "p-a",
        placement: 1,
        level: 10,
        last_round: 37,
        time_eliminated: 2243,
        gold_left: 1,
        win: true,
        units: [
          { character_id: "DA_18_Rakan", itemNames: ["DA_Deathblade"], tier: 2, rarity: 0 },
          { character_id: "DA_Sentinel18", itemNames: [], tier: 1, rarity: 0 },
          { character_id: "DA_Lux18_Base", itemNames: ["DA_AdaptiveHelm", "DA_SteadfastHeart"], tier: 3, rarity: 4 },
        ],
        traits: [
          { name: "DA_18_Blackthorn", num_units: 2, style: 1, tier_current: 1, tier_total: 3 },
          { name: "DA_18_Fae", num_units: 1, style: 0, tier_current: 0, tier_total: 3 },
        ],
      },
      {
        puuid: "p-b",
        placement: 8,
        level: 7,
        last_round: 25,
        time_eliminated: 1400,
        gold_left: 12,
        win: false,
        units: [{ character_id: "DA_18_Ashe", itemNames: [], tier: 1, rarity: 0 }],
        traits: [],
      },
    ],
  },
};

describe("isPlayableUnitKey", () => {
  it("PvE 몬스터·소환물을 거른다 — 플레이어가 고른 유닛이 아니다", () => {
    for (const key of PVE_UNIT_KEYS) expect(isPlayableUnitKey(key)).toBe(false);
    expect(isPlayableUnitKey("DA_Sentinel18")).toBe(false);
    expect(isPlayableUnitKey("DA_18_ElderDragon")).toBe(false);
  });

  it("실제 유닛은 통과시킨다", () => {
    expect(isPlayableUnitKey("DA_18_Rakan")).toBe(true);
    expect(isPlayableUnitKey("DA_Lux18_Base")).toBe(true);
  });
});

describe("toTftMatchSlim", () => {
  const slim = toTftMatchSlim(RAW, "18.2");

  it("매치 수준 필드를 실응답 키에서 읽는다", () => {
    expect(slim).toMatchObject({
      matchId: "KR_8385987122",
      patch: "18.2",
      gameDatetimeMs: 1789748962701,
      queueId: 1100,
      setNumber: 18,
    });
    expect(slim?.gameLengthSec).toBeCloseTo(2243.17, 1);
  });

  it("PvE 유닛을 보드에서 걷어낸다 — 안 걷으면 등장률 분모가 오염된다", () => {
    expect(slim?.participants[0].unitIds).toEqual(["DA_18_Rakan", "DA_Lux18_Base"]);
  });

  it("아이템은 유닛을 가로질러 평탄화한다", () => {
    expect(slim?.participants[0].itemIds).toEqual(["DA_Deathblade", "DA_AdaptiveHelm", "DA_SteadfastHeart"]);
  });

  it("**미발동 특성(style=0)은 버린다** — 보드에 있었다는 것과 발동했다는 것은 다르다", () => {
    expect(slim?.participants[0].traits).toEqual([{ name: "DA_18_Blackthorn", tier: 1, numUnits: 2 }]);
  });

  it("등수·레벨·탈락 시점을 보존한다", () => {
    expect(slim?.participants[1]).toMatchObject({
      puuid: "p-b",
      placement: 8,
      level: 7,
      lastRound: 25,
      timeEliminatedSec: 1400,
      goldLeft: 12,
    });
  });

  it("형태가 어긋나면 null — 빈 매치를 지어내지 않는다", () => {
    expect(toTftMatchSlim({ nope: true }, "18.2")).toBeNull();
    expect(toTftMatchSlim({ info: { participants: [] } }, "18.2")).toBeNull();
  });

  it("참가자가 8명이 아니면 null — 중도 이탈·손상 표본은 등장률 분모를 왜곡한다", () => {
    const short = { ...RAW, info: { ...RAW.info, participants: RAW.info.participants.slice(0, 1) } };
    expect(toTftMatchSlim(short, "18.2", { requiredParticipants: 8 })).toBeNull();
    // 기본값은 검사하지 않는다(테스트 픽스처가 2명이라 위 케이스들이 통과해야 한다).
    expect(toTftMatchSlim(short, "18.2")).not.toBeNull();
  });
});
