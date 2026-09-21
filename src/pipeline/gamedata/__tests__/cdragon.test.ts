// src/pipeline/gamedata/__tests__/cdragon.test.ts
// RED — CDragon 수치 스냅숏을 **파이프라인 안에서** 만든다.
//
// 왜 지금 만드나(2026-09-21): `data/cdragon/{16.17,16.18}/tft.json` 두 개는 파이프라인 **밖에서**
// 손으로 만들어져 커밋됐다(`grep -ri communitydragon` 결과 0건). 수치 축과 노트 카탈로그가 둘 다
// 이 파일에 의존하게 된 지금, 수집 코드가 없으면 **패치마다 사람이 손으로 스냅숏을 늘려야 한다**.
// DDragon은 `run-ddragon.ts`가 이미 패치마다 받아 온다 — 그 자리에 있어야 할 짝이 비어 있었다.
//
// 추출 규칙은 커밋된 두 파일을 역산해 확정했다(아래 테스트가 그 규칙의 계약이다).
import { describe, expect, it } from "vitest";

import { extractTftSnapshot } from "../cdragon";
import { branchOfDdragonVersion, cdragonUrl, parseArgs } from "../../../../scripts/run-cdragon";

const RAW = {
  sets: {
    "18": {
      name: "Set18",
      champions: [
        {
          apiName: "TFT_BlueGolem",
          name: "골렘",
          cost: 1,
          // `null` 스탯은 PvE 몬스터에 실제로 있다(협곡 바위 게 `hp`).
          stats: { armor: 40, hp: 600, range: null },
          ability: { name: "골렘의 강타", variables: [{ name: "Damage", value: [100, 300] }] },
        },
        {
          apiName: "DA_Brambleback18",
          name: "덩굴정령",
          cost: 2,
          stats: { damage: 115 },
          ability: { name: "가시", variables: [] },
        },
      ],
    },
    "17": { name: "Set17", champions: [{ apiName: "TFT17_Old", name: "옛유닛", cost: 1, stats: {}, ability: {} }] },
  },
  items: [
    { apiName: "DA_TheGoldenDragon", name: "황금 드래곤", effects: { BonusHealth: 600, "{857f7819}": 1 } },
    // **숫자가 하나도 없는 effects는 버린다** — 실측 18건이 `{"Gold": null}` 같은 자리표시자였다.
    { apiName: "TFT16_Augment_BandleBounty", name: "밴들 현상금 I", effects: { Gold: null } },
    { apiName: "TFT13_NoEffects", name: "효과없음", effects: {} },
  ],
};

describe("extractTftSnapshot — 커밋된 스냅숏의 모양을 재현한다", () => {
  const out = extractTftSnapshot(RAW, 18);

  it("세트를 그 번호로 박는다", () => {
    expect(out.set).toBe("TFTSet18");
  });

  it("유닛은 해당 세트 것만, 원본 순서대로", () => {
    expect(Object.keys(out.units)).toEqual(["TFT_BlueGolem", "DA_Brambleback18"]);
  });

  it("유닛은 이름·비용·스탯·스킬 변수만 남긴다 — 아이콘·설명·역할은 버린다", () => {
    expect(out.units.TFT_BlueGolem).toEqual({
      name: "골렘",
      cost: 1,
      stats: { armor: 40, hp: 600 },
      ability: { Damage: [100, 300] },
    });
  });

  it("★ 값이 `null`인 스탯은 키째 버린다 — 남기면 diff가 허위 변경을 낸다", () => {
    // `diffValueMap`은 **한쪽에만 있는 키도 변경**으로 읽는다. `null`을 담아 두면 다음 패치에
    // 값이 들어오는 순간 "없음 → 600"이 되어 잠수함으로 잡힌다. 실측 근거: 커밋된 스냅숏의
    // `TFT9_SLIME_Crab`에 `hp`가 아예 없는데 원본에는 `"hp": null`이 있다.
    expect(out.units.TFT_BlueGolem.stats).not.toHaveProperty("range");
  });

  it("스킬 변수가 없으면 빈 객체 — 키 자체를 빼지 않는다", () => {
    expect(out.units.DA_Brambleback18.ability).toEqual({});
  });

  it("★ 아이템은 **숫자 effect가 하나라도 있는 것만** 남긴다", () => {
    expect(Object.keys(out.items)).toEqual(["DA_TheGoldenDragon"]);
  });

  it("해시 이름 effect도 그대로 남긴다 — 거르는 일은 diff 단계의 몫이다", () => {
    expect(out.items.DA_TheGoldenDragon.effects).toEqual({ BonusHealth: 600, "{857f7819}": 1 });
  });

  it("없는 세트를 요구하면 조용히 빈 스냅숏을 내지 않고 던진다", () => {
    expect(() => extractTftSnapshot(RAW, 19)).toThrow(/Set 19/);
  });
});

describe("run-cdragon — 버전 라벨과 URL", () => {
  it("DDragon 최신에서 브랜치 라벨을 만든다 — 16.18.1 → 16.18", () => {
    expect(branchOfDdragonVersion("16.18.1")).toBe("16.18");
  });

  it("읽을 수 없으면 던진다", () => {
    expect(() => branchOfDdragonVersion("16")).toThrow(/버전 형식/);
  });

  it("미러 경로를 만든다", () => {
    expect(cdragonUrl("16.18", "ko_kr")).toBe(
      "https://raw.communitydragon.org/16.18/cdragon/tft/ko_kr.json"
    );
  });

  it("★ --version은 디렉터리 이름이 되므로 형식을 강제한다", () => {
    // `parseCliArgs`의 `patch` 타입이 존재하는 이유와 같다 — 임의 문자열이 경로 조합으로
    // 흘러들면 GH Actions 컨텍스트에서 그대로 파일 경로가 된다.
    expect(() => parseArgs(["--patch", "18.2", "--version", "../../etc"])).toThrow(/--version/);
    expect(parseArgs(["--patch", "18.2", "--version", "16.18"]).version).toBe("16.18");
  });

  it("버전을 안 주면 빈 문자열 — 실행 시 DDragon 최신으로 채운다", () => {
    expect(parseArgs(["--patch", "18.2"]).version).toBe("");
  });
});
