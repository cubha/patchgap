// src/components/__tests__/gapPreview.test.ts
// 첫 화면 미공지 사례(트랙 B ST-22, lol-S23·pubg-S8). 리뷰 실측: 사이트 명제는 「패치노트에 없는 변화」인데 브리핑 첫 화면(1280×800)에
// 미공지 사례가 0건이었다 — 기본 탭이 「패치 내용」이고 미공지는 두 번째 탭 뒤였다. 탭 순서를 뒤집는 안은 두 번 기각됐으므로(재제안 금지)
// 타일 바로 아래 한 줄로 상위 사례를 보인다. 고르는 규칙: 대상당 1건(가장 큰 것), 크기순, 상위 N.
import { describe, expect, it } from "vitest";
import { pickGapPreview, type GapPreviewItem } from "../gapPreview";

const item = (key: string, score: number, text = `${key} 변화`): GapPreviewItem => ({ key, name: key, text, href: `/x/${key}/`, score });

describe("pickGapPreview", () => {
  it("크기순 상위 N", () => {
    expect(pickGapPreview([item("a", 1), item("b", 5), item("c", 3)], 2).map((i) => i.key)).toEqual(["b", "c"]);
  });
  it("대상당 한 건 — 같은 대상의 더 큰 변화가 남는다", () => {
    const out = pickGapPreview([item("a", 1, "작은"), item("a", 9, "큰"), item("b", 5)], 3);
    expect(out.map((i) => i.text)).toEqual(["큰", "b 변화"]);
  });
  it("비면 빈 배열(줄을 그리지 않는다)", () => {
    expect(pickGapPreview([], 3)).toEqual([]);
  });
});
