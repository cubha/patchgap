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
    //
    // Python 원본에 없는 필드는 **여기 이름을 적은 것만** 통과한다(2026-09-21 ST-6). 누락을 막는
    // 원래 강도는 그대로고, 선언 없는 추가도 함께 막는다 — 골든의 의미는 "무엇이 들어 있는지
    // 전부 안다"이지 "Python과 글자까지 같다"가 아니다.
    const TS_ONLY_FIELDS = ["damageGrid"]; // 잠수함 패치 검출(F9)용 피해 격자 — Python 원본엔 없다
    expect(Object.keys(actual).sort()).toEqual([...Object.keys(expected), ...TS_ONLY_FIELDS].sort());
    for (const key of Object.keys(expected)) {
      expect(actual[key], `필드 ${key}`).toEqual(expected[key]);
    }
  });

  it("피해 격자는 부위별로 표본·최대치·최빈값을 담는다 (ST-6)", () => {
    const events = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "telemetry-sample.json"), "utf8")
    ) as TelemetryEvent[];
    const { damageGrid } = reduceTelemetry(MATCH_ID, ATTRIBUTES, events);

    for (const [weapon, reasons] of Object.entries(damageGrid)) {
      expect(weapon.startsWith("Weap"), `무기 키 ${weapon}`).toBe(true);
      for (const [reason, cell] of Object.entries(reasons)) {
        expect(cell.n, `${weapon}/${reason} 표본`).toBeGreaterThan(0);
        expect(cell.max, `${weapon}/${reason} 최대치`).toBeGreaterThan(0);
        expect(cell.top.length, `${weapon}/${reason} 최빈`).toBeLessThanOrEqual(8);
        // 최빈값은 빈도 내림차순 — 병합(mergeGrids)이 이 순서를 신뢰한다.
        const counts = cell.top.map(([, c]) => c);
        expect([...counts].sort((a, b) => b - a)).toEqual(counts);
        // 격자 값은 전부 최대치 이하다.
        for (const [value] of cell.top) expect(value).toBeLessThanOrEqual(cell.max);
      }
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
