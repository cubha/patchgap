// src/pipeline/collect/pubg/__tests__/telemetry-reduce.test.ts
// **크로스 언어 골든** — TypeScript 이식본이 Python 원본과 같은 값을 내는지 본다.
//
// 이 축의 원본 구현은 `docs/plan/provenance/2026-09-16-pubg-harvest/telemetry.py`이고,
// 커밋된 집계(`data/aggregated/pubg/**`)는 **그 Python이 만든 축약 7,217건**에서 나왔다.
// 이식본이 조금이라도 다르게 세면 다음 패치의 수치가 이전 패치와 비교 불가능해진다 —
// 그런데 원본 텔레메트리는 보관하지 않으므로(매치당 30MB), 나중에는 재검증할 방법도 없다.
//
// 검증은 두 단계로 했다:
//  ① 실전 1건 전수 비교(2026-09-20): 29,883 이벤트 매치 하나를 내려받아 이식본으로 줄인 결과가
//     커밋돼 있던 Python 산출 `data/raw/pubg/telemetry-reduced/50faa6d7-….json`과
//     **19개 필드 전부 일치**했다. 그 원본(16MB)은 커밋할 수 없다.
//  ② 이 테스트: 그 매치에서 분기별로 이벤트를 솎아낸 픽스처(119건)와, **같은 Python 코드로**
//     만든 기대 산출을 함께 커밋해 두고 매 실행 비교한다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { parseMatchDefinition, reduceTelemetry, type TelemetryEvent } from "../telemetry-reduce";

const FIXTURES = path.join(__dirname, "fixtures");
const MATCH_ID = "50faa6d7-2ca6-4cd5-b1e0-1c523d28dcee";
/** 실제 `/matches/{id}` 응답의 attributes(그 매치의 값 그대로). */
const ATTRIBUTES = {
  createdAt: "2026-09-15T23:26:49Z",
  mapName: "Savage_Main",
  gameMode: "solo-fpp",
  duration: 6339,
};

describe("PUBG 텔레메트리 축약 — Python 원본과 동일", () => {
  it("픽스처를 줄인 결과가 Python 산출과 같다", () => {
    const events = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "telemetry-sample.json"), "utf8")
    ) as TelemetryEvent[];
    const expected = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "telemetry-sample.expected.json"), "utf8")
    ) as Record<string, unknown>;

    const actual = reduceTelemetry(MATCH_ID, ATTRIBUTES, events) as unknown as Record<string, unknown>;

    // 키 집합부터 본다 — 필드가 하나 빠지면 집계가 조용히 0으로 읽는다.
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected)) {
      expect(actual[key], `필드 ${key}`).toEqual(expected[key]);
    }
  });

  it("패치 라벨은 LogMatchDefinition에서만 나온다 — 형식이 바뀌면 null", () => {
    expect(
      parseMatchDefinition("match.bro.official.pc-2018-43.steam.solo-fpp.as.2026.09.15.g-abc")
    ).toEqual({ matchType: "official", patch: "pc-2018-43", telMode: "solo-fpp", region: "as" });
    // `/matches/{id}` 응답에는 패치 필드가 없다 — 못 읽으면 그 매치는 집계에서 빠져야 한다.
    expect(parseMatchDefinition("match.bro.official.steam.solo-fpp.as")).toBeNull();
    expect(parseMatchDefinition("")).toBeNull();
  });

  it("비경쟁 매치(airoyale·competitive 등)도 라벨은 읽는다 — 거르는 곳은 집계다", () => {
    // 표본의 절반가량이 비경쟁 매치였다(PLAN §6-1). 축약 단계에서 버리면 그 사실이 안 보인다.
    expect(
      parseMatchDefinition("match.bro.airoyale.pc-2018-43.steam.squad.na.2026.09.15.g-x")?.matchType
    ).toBe("airoyale");
  });

  it("무기가 아닌 획득은 세지 않는다", () => {
    const events: TelemetryEvent[] = [
      { _T: "LogItemPickup", item: { category: "Weapon", itemId: "Item_Weapon_AK47_C" } },
      { _T: "LogItemPickup", item: { category: "Attachment", itemId: "Item_Attach_X" } },
      { _T: "LogItemPickup", item: null },
    ];
    const out = reduceTelemetry("m", { createdAt: null, mapName: null, gameMode: null, duration: null }, events);
    expect(out.weaponPickup).toEqual({ Item_Weapon_AK47_C: 1 });
  });

  it("봇과 사람을 accountId 접두로 가른다", () => {
    const events: TelemetryEvent[] = [
      { _T: "LogPlayerLogin", accountId: "ai.abc" },
      { _T: "LogPlayerCreate", character: { accountId: "account.real1" } },
      { _T: "LogPlayerCreate", character: { accountId: "account.real1" } }, // 중복은 한 번만
    ];
    const out = reduceTelemetry("m", { createdAt: null, mapName: null, gameMode: null, duration: null }, events);
    expect({ nBots: out.nBots, nHumans: out.nHumans }).toEqual({ nBots: 1, nHumans: 1 });
  });
});
