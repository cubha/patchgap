// src/pipeline/match/__tests__/cause-factuality.test.ts
// C3(2026-09-28 잔여 로드맵) — 원인 문장의 인과 **사실성** 결정론 검사 3종. 인용 노트 실재·대상 일치는
// 이미 본다. 여기서는 문장이 **숫자로 단정한 것**이 근거와 맞는지만 본다(해석은 LLM 몫으로 남긴다).
import { describe, expect, it } from "vitest";
import {
  arrowClaimsGrounded,
  signedPercentClaimsGrounded,
  totalDropAttributionGrounded,
  unsignedPercentChangeClaimsGrounded,
} from "../cause-factuality";

const note = (before: string, after: string, summary = `x: ${before} ⇒ ${after}`) => ({ before, after, summary });

describe("① 「A→B」 수치 ↔ 인용 노트 before/after", () => {
  it("노트 수치와 맞으면 통과(범위·부분 인용 포함)", () => {
    expect(arrowClaimsGrounded("갈라진 하늘 공격력 45→40 너프로", [note("45", "40")], [])).toBe(true);
    expect(arrowClaimsGrounded("베인 W가 최대 체력의 6%→4%(1레벨)로 깎이며", [note("6~10%", "4~10%")], [])).toBe(true);
    expect(arrowClaimsGrounded("르블랑 W 계수가 80%에서 90%로 올라", [note("주문력의 80%", "주문력의 90%")], [])).toBe(true);
  });
  it("노트에 없는 수치를 단정하면 실패", () => {
    expect(arrowClaimsGrounded("갈라진 하늘 공격력 50→40 너프로", [note("45", "40")], [])).toBe(false);
    expect(arrowClaimsGrounded("공격력 45→40", [note("40", "45")], [])).toBe(false); // 방향을 뒤집은 인용
  });
  it("한 줄에 두 수치가 섞인 원문은 요약 문자열의 쌍으로도 본다(C11 전 18.2 「소매치기」)", () => {
    const combined = note("3골드", "2골드, 골드 생성 확률: 15% ⇒ 20%", "소매치기: 가격: 3골드 ⇒ 2골드, 골드 생성 확률: 15% ⇒ 20%");
    expect(arrowClaimsGrounded("골드 생성 확률이 15%에서 20%로 올라", [combined], [])).toBe(true);
  });
  it("델타 자신의 수치(표본 n 등)는 근거다", () => {
    expect(arrowClaimsGrounded("표본이 4156→5789로 급증", [note("25%", "35%")], [4156, 5789])).toBe(true);
  });
  it("화살표 주장이 없으면 판단하지 않는다(통과)", () => {
    expect(arrowClaimsGrounded("폭풍갈퀴 상향으로 원딜 선호가 커졌습니다.", [note("1", "2")], [])).toBe(true);
  });
});

describe("② 부호 붙은 「±X%」 ↔ 상대 변화·재분배 기대치(PUBG)", () => {
  it("허용 값과 소수 첫째 자리까지 맞으면 통과", () => {
    expect(signedPercentClaimsGrounded("기대치 +1.9%로 +26.3%에는 크게 못 미칩니다.", [0.0193, 0.2632])).toBe(true);
  });
  it("허용 값에 없는 부호 백분율은 실패", () => {
    expect(signedPercentClaimsGrounded("재분배로 +12.0%가 설명됩니다.", [0.0193, 0.2632])).toBe(false);
  });
  it("부호 없는 백분율(노트 수치 「30% 감소」)은 판단하지 않는다", () => {
    expect(signedPercentClaimsGrounded("RPD·M249 스폰 30% 감소분이", [0.0193])).toBe(true);
  });
});

// 2026-09-28 이월 R14: 부호 없는 「17.9% 줄어」는 ②가 보지 않았다. 변화 동사가 붙은 백분율은 **변화량 주장**
// 이므로, 이 델타·쌍 맥락의 허용 값이거나 인용 노트가 말한 수치여야 한다.
describe("②′ 부호 없는 「X% 줄어/늘어」 ↔ 허용 값 또는 인용 노트 수치(PUBG)", () => {
  it("허용 값(전체 획득 −17.9%)과 맞으면 통과", () => {
    expect(unsignedPercentChangeClaimsGrounded("전체 획득 수가 17.9% 줄어든 영향입니다.", [-0.179], [])).toBe(true);
  });
  it("허용 값에도 노트 수치에도 없으면 실패", () => {
    expect(unsignedPercentChangeClaimsGrounded("전체 획득 수가 12.0% 줄어든 영향입니다.", [-0.179, 0.0193], [30])).toBe(false);
  });
  it("인용 노트가 말한 수치(「스폰 30% 감소」)면 통과", () => {
    expect(unsignedPercentChangeClaimsGrounded("RPD·M249 스폰이 30% 감소해 몫이 옮겨졌습니다.", [0.0193], [30])).toBe(true);
  });
  it("변화 동사가 없는 백분율(점유율 값)은 판단하지 않는다", () => {
    expect(unsignedPercentChangeClaimsGrounded("점유율 5.6% 수준입니다.", [], [])).toBe(true);
  });
  it("부호가 붙은 것은 ②의 몫이라 여기서 보지 않는다(이중 판정 금지)", () => {
    expect(unsignedPercentChangeClaimsGrounded("−12.0% 줄었습니다.", [0.179], [])).toBe(true);
  });
  it("%p(퍼센트포인트)는 비율 변화가 아니라 보지 않는다", () => {
    expect(unsignedPercentChangeClaimsGrounded("2.1%p 늘었습니다.", [], [])).toBe(true);
  });
});

describe("③ 「전체 획득 감소」 귀속 ↔ 인용 노트 무기 비중", () => {
  it("인용 노트 무기가 이전 전체 획득의 50% 미만인데 전체 감소를 그 탓으로 돌리면 실패", () => {
    expect(totalDropAttributionGrounded("전체 획득 수가 17.9% 줄어든 것은 RPD·M249 스폰 감소 때문입니다.", 0.02)).toBe(false);
  });
  it("비중이 50% 이상이면 통과, 전체 감소를 말하지 않으면 판단하지 않는다", () => {
    expect(totalDropAttributionGrounded("전체 획득 수가 줄어든 것은 이 조정 때문입니다.", 0.6)).toBe(true);
    expect(totalDropAttributionGrounded("RPD·M249 스폰이 줄어 Beryl이 반사 이익을 얻었습니다.", 0.02)).toBe(true);
  });
  it("비중을 모르면(null) 판단하지 않는다", () => {
    expect(totalDropAttributionGrounded("전체 획득 수가 줄어든 것은 이 조정 때문입니다.", null)).toBe(true);
  });
});
