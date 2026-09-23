// src/components/methodology/__tests__/slots.test.ts
// 방법론 9슬롯의 **순서와 앵커**를 고정한다(UX-BRIEF §8-4).
//
// 슬롯 **충족 여부**는 테스트가 아니라 타입이 지킨다(`Record<MethodologySlotKey, …>`) — 하나라도
// 비우면 tsc가 막는다. 여기서 재는 것은 타입이 못 재는 것, 즉 순서·앵커·부재 표현이다.
import { describe, expect, it } from "vitest";
import { METHODOLOGY_SLOTS, isUnusedAxis, slotDef } from "../slots";

describe("§8-4 9슬롯", () => {
  it("순서가 고정이다 — 표본 → 신뢰 → 게이트 → 해석 → 표시 규칙 → 추정 원인 → 수치 축 → 알림 → 한계", () => {
    expect(METHODOLOGY_SLOTS.map((s) => s.key)).toEqual([
      "sample",
      "pipeline",
      "gate",
      "verdict",
      "display",
      "cause",
      "gamedata",
      "notify",
      "limits",
    ]);
  });

  it("슬롯은 9개다 — 늘리거나 줄이면 세 게임이 동시에 달라진다", () => {
    expect(METHODOLOGY_SLOTS).toHaveLength(9);
  });

  it("앵커는 기존 링크가 쓰는 두 개뿐이다 — 바꾸면 그 링크가 죽는다", () => {
    // `#gates` = 상세의 「판정 규칙 보기 →」 · `#discord` = 세 홈의 디스코드 패널(§8-1).
    expect(slotDef("gate").anchor).toBe("gates");
    expect(slotDef("notify").anchor).toBe("discord");
    const anchored = METHODOLOGY_SLOTS.filter((s) => s.anchor !== null);
    expect(anchored).toHaveLength(2);
  });

  it("제목·아이브로가 비어 있지 않다 — 카드 머리를 게임이 다시 쓰지 않는다", () => {
    for (const slot of METHODOLOGY_SLOTS) {
      expect(slot.eyebrow.length, slot.key).toBeGreaterThan(0);
      expect(slot.title.length, slot.key).toBeGreaterThan(0);
    }
  });

  it("등록되지 않은 키를 조회하면 던진다 — 조용히 undefined를 그리지 않는다", () => {
    // @ts-expect-error 등록되지 않은 키
    expect(() => slotDef("nope")).toThrow();
  });
});

describe("쓰지 않는 축", () => {
  it("사유 문자열을 가진 객체만 「미사용」으로 본다", () => {
    expect(isUnusedAxis({ unused: "이 게임은 …" })).toBe(true);
    expect(isUnusedAxis(null)).toBe(false);
    expect(isUnusedAxis("문자열")).toBe(false);
  });
});
