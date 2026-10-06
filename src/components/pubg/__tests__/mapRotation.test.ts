// 맵 상세 기술통계 모드의 원인 칸 문장(2026-10-06). 시안은 「42.3에만 비켄디·데스턴, 43.1에만 미라마·파라모」를
// 손으로 적었다 — 패치마다 낡는 문장이라(AdapterMatrix 머리글이 18.1 → 18.2에 멈춰 있던 것과 같은 결함) 산출물의
// `onlyBefore`/`onlyAfter`에서 만든다.
import { describe, expect, it } from "vitest";
import { mapRotationSentence } from "../mapRotation";

describe("mapRotationSentence", () => {
  it("한쪽 구간에만 있는 맵을 패치와 함께 이름으로 말한다", () => {
    expect(
      mapRotationSentence({ from: "42.3", to: "43.1", onlyBefore: ["DihorOtok_Main", "Kiki_Main"], onlyAfter: ["Desert_Main", "Chimera_Main"] })
    ).toBe("맵 풀 로테이션(42.3에만 비켄디·데스턴, 43.1에만 미라마·파라모)이 점유율을 함께 움직입니다.");
  });

  it("한쪽만 바뀌었으면 그쪽만 말한다", () => {
    expect(mapRotationSentence({ from: "1", to: "2", onlyBefore: [], onlyAfter: ["Desert_Main"] })).toBe(
      "맵 풀 로테이션(2에만 미라마)이 점유율을 함께 움직입니다."
    );
  });

  it("맵 풀이 같으면 로테이션을 지어내지 않는다", () => {
    expect(mapRotationSentence({ from: "1", to: "2", onlyBefore: [], onlyAfter: [] })).toBe(
      "두 패치의 맵 풀은 같습니다."
    );
  });
});
