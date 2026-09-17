// src/pipeline/shared/__tests__/cosmetic-skin.test.ts
// 스킨 매칭의 위험 방향은 **오탐**이다 — 엉뚱한 스플래시를 붙이면 "이 스킨이 나온다"는
// 거짓 정보를 이미지로 단언하게 된다. 그래서 잡아야 할 것보다 **안 잡아야 할 것**에 무게를 둔다.
import { describe, expect, it } from "vitest";
import { isMatchableSkin, matchSkinsInSummary, skinSplashPath, type SkinRef } from "../cosmetic-skin";

function skin(over: Partial<SkinRef> = {}): SkinRef {
  return { championId: "Orianna", num: 40, name: "떠오른 전설 오리아나", ...over };
}

// 실측 인덱스 일부(2026-09-17, ddragon 16.18.1 ko_KR)
const INDEX: SkinRef[] = [
  skin(),
  skin({ num: 41, name: "떠오른 전설 오리아나 (질서)" }),
  skin({ num: 42, name: "떠오른 전설 오리아나 (신화 등반자)" }),
  skin({ num: 0, name: "default" }),
  skin({ championId: "Taliyah", num: 1, name: "프렐요드 탈리야" }),
  skin({ championId: "Taliyah", num: 33, name: "프렐요드 탈리야 (질서)" }),
  skin({ championId: "Leblanc", num: 5, name: "나무정령 르블랑" }),
  skin({ championId: "Akali", num: 82, name: "창공 아칼리" }),
  skin({ championId: "Akali", num: 83, name: "창공 아칼리 (루비)" }),
  skin({ championId: "Tristana", num: 80, name: "불멸의 전설 트리스타나" }),
];

describe("isMatchableSkin", () => {
  it("기본 스킨은 후보가 아니다 — '신규 스킨'이 아니므로", () => {
    expect(isMatchableSkin(skin({ num: 0, name: "default" }))).toBe(false);
    expect(isMatchableSkin(skin({ num: 0, name: "클래식 오리아나" }))).toBe(false);
  });

  it("2글자 이하 스킨명은 후보에서 뺀다 — 우연한 부분일치 위험이 실익보다 크다", () => {
    expect(isMatchableSkin(skin({ num: 9, name: "구" }))).toBe(false);
    expect(isMatchableSkin(skin({ num: 9, name: "정수" }))).toBe(false);
    expect(isMatchableSkin(skin({ num: 9, name: "테두리" }))).toBe(true);
  });
});

describe("matchSkinsInSummary — 잡아야 할 것", () => {
  it("실측 문구를 그대로 잡는다", () => {
    const found = matchSkinsInSummary("떠오른 전설 오리아나 스킨 및 테두리", INDEX);
    expect(found.map((s) => s.num)).toEqual([40]);
  });

  it("한 줄에 나열된 3종을 전부 잡고 등장 순서를 유지한다", () => {
    const found = matchSkinsInSummary("프렐요드 탈리야, 나무정령 르블랑, 창공 아칼리 스킨", INDEX);
    expect(found.map((s) => s.name)).toEqual(["프렐요드 탈리야", "나무정령 르블랑", "창공 아칼리"]);
  });

  it("더 구체적인 이름이 있으면 그쪽을 택한다(최장 일치)", () => {
    const found = matchSkinsInSummary("떠오른 전설 오리아나 (질서) 크로마", INDEX);
    expect(found.map((s) => s.num)).toEqual([41]);
  });

  it("최장 일치가 짧은 접두를 삼킨 뒤, 겹치지 않는 다른 스킨은 여전히 잡는다", () => {
    const found = matchSkinsInSummary("창공 아칼리 (루비)와 나무정령 르블랑", INDEX);
    expect(found.map((s) => s.name)).toEqual(["창공 아칼리 (루비)", "나무정령 르블랑"]);
  });
});

describe("matchSkinsInSummary — 잡으면 안 되는 것", () => {
  it("스킨명이 없는 보상 줄은 빈 배열 — 비슷한 이미지를 끌어오지 않는다", () => {
    for (const summary of [
      "신화 정수 125개",
      "구 11개",
      "Caps 선수 테마의 아이콘 및 감정표현 15개",
      "불사의 악마 선인장 와드",
      "희망의 등불 휘장",
      "'마르틴 1' 칭호",
      "그 외 다수!",
    ]) {
      expect(matchSkinsInSummary(summary, INDEX)).toEqual([]);
    }
  });

  it("인덱스가 비면 빈 배열(자산 미보유 환경에서도 죽지 않는다)", () => {
    expect(matchSkinsInSummary("떠오른 전설 오리아나 스킨", [])).toEqual([]);
  });

  it("같은 스킨이 두 번 나와도 한 번만 돌려준다", () => {
    const found = matchSkinsInSummary("떠오른 전설 오리아나 / 떠오른 전설 오리아나", INDEX);
    expect(found).toHaveLength(1);
  });

  it("limit을 넘겨 쏟아내지 않는다", () => {
    const many = "프렐요드 탈리야 나무정령 르블랑 창공 아칼리 불멸의 전설 트리스타나";
    expect(matchSkinsInSummary(many, INDEX, 2)).toHaveLength(2);
  });
});

describe("skinSplashPath", () => {
  it("heroSplash와 같은 디렉토리 규약을 쓴다", () => {
    expect(skinSplashPath({ championId: "Orianna", num: 40 })).toBe("/dd/splash/Orianna_40.jpg");
    expect(skinSplashPath({ championId: "Aatrox", num: 0 })).toBe("/dd/splash/Aatrox_0.jpg");
  });
});
