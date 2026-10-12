// src/components/observation/__tests__/footnote.test.ts
// 관측 섹션 각주(트랙 B ST-12, lol-S30·pubg-S23 · ST-17 pubg-S15). 리뷰 실측: 「…지표 탭로 나타납니다」 조사 오류가 세 게임 상세
// 278장에 찍혀 있었다 — 선택지가 붙는 경우(「과 라인 선택지로」)와 안 붙는 경우를 한 템플릿으로 이어 붙여 생긴 것이다.
// 지표가 0개인 기술통계 화면(미라마)은 「관측값만 보입니다」 각주가 없는 관측을 약속했다.
import { describe, expect, it } from "vitest";
import { observationFootnote } from "../footnote";

describe("observationFootnote", () => {
  it("선택지가 없으면 「지표 탭으로」", () => {
    const t = observationFootnote({ mode: "verdict", segmentLabel: null, count: 2 });
    expect(t).toContain("지표 탭으로 나타납니다");
    expect(t).not.toContain("탭로");
  });

  it("선택지가 있으면 「지표 탭과 라인 선택지로」", () => {
    const t = observationFootnote({ mode: "verdict", segmentLabel: "라인", count: 2 });
    expect(t).toContain("지표 탭과 라인 선택지로 나타납니다");
  });

  it("기술통계 모드는 관측값만이라는 각주 — 단 지표가 0개면 각주가 없다(없는 관측을 약속하지 않는다)", () => {
    expect(observationFootnote({ mode: "descriptive", segmentLabel: null, count: 3 })).toContain("관측값만 보입니다");
    expect(observationFootnote({ mode: "descriptive", segmentLabel: null, count: 0 })).toBeNull();
  });
});
