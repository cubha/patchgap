// src/pipeline/tft/__tests__/asset-path.test.ts
// CDragon 폴백 경로 규칙(2026-09-27). DDragon `tft-*` 카탈로그에 없는 대상(18.x 「선체분쇄자」·
// 「럭스 (검은 가시)」)은 화면이 폴백 박스를 그렸다. CDragon 원본 JSON은 아이콘을 게임 파일 경로
// (`…/x.tex`)로 주고, 공개 미러는 같은 경로를 소문자 + `.png`로 서빙한다.
import { describe, expect, it } from "vitest";
import { cdragonTftImageUrl, cdragonIconOf } from "../asset-path";

describe("cdragonTftImageUrl", () => {
  it("게임 파일 경로(.tex)를 공개 미러 png URL로 바꾼다", () => {
    expect(cdragonTftImageUrl("assets/maps/particles/tft/item_icons/ornn_items/tft9_ornnitem_hullbreaker.tex")).toBe(
      "https://raw.communitydragon.org/latest/game/assets/maps/particles/tft/item_icons/ornn_items/tft9_ornnitem_hullbreaker.png"
    );
  });
  it("대문자·.dds도 같은 규칙이다", () => {
    expect(cdragonTftImageUrl("ASSETS/UX/TFT/ChampionSplashes/TFT18_Lux.TFT_Set18.dds")).toBe(
      "https://raw.communitydragon.org/latest/game/assets/ux/tft/championsplashes/tft18_lux.tft_set18.png"
    );
  });
});

describe("cdragonIconOf", () => {
  it("유닛은 타일 → 정사각 → 기본 아이콘 순으로 고른다(DDragon 유닛 이미지가 스플래시 크롭이라 가장 가까운 것)", () => {
    expect(cdragonIconOf("unit", { icon: "a.tex", squareIcon: "b.tex", tileIcon: "c.tex" })).toBe("c.tex");
    expect(cdragonIconOf("unit", { icon: "a.tex", squareIcon: "b.tex" })).toBe("b.tex");
  });
  it("아이템·특성은 기본 아이콘", () => {
    expect(cdragonIconOf("item", { icon: "a.tex", squareIcon: "b.tex" })).toBe("a.tex");
  });
  it("아이콘이 없으면 null — 지어내지 않는다", () => {
    expect(cdragonIconOf("item", {})).toBeNull();
  });
});
