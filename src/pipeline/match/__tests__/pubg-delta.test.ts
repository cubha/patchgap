// src/pipeline/match/__tests__/pubg-delta.test.ts
// PUBG 판정 로직 검증 — 이 모듈의 load-bearing 지점 2개를 건다:
//   ① 효과크기 바닥을 LoL 값이 아니라 **데이터에서** 유도하는가(deriveEffectFloor)
//   ② 공지 대조가 CI 포함이 아니라 **비율 밴드**로 판정하는가(classify)
// ②는 2026-09-16에 실제로 뒤집힌 규칙이다 — CI 포함 방식은 시행수가 커질수록 공지값을 거의
// 항상 배제해 모든 공지 항목을 "불일치"로 만든다(RPD -26.0% [-27.3, -24.7]가 공지 -30%를
// 배제해 오탐으로 찍혔다). 그 회귀를 막는 것이 이 파일의 주 목적이다.
import { describe, expect, it } from "vitest";
import {
  conservativeEffect,
  ANNOUNCED_RATIO_BAND,
  classify,
  deriveEffectFloor,
  relChangeInterval,
  PICKUP_MIN_N,
  type PubgNoteItem,
} from "../pubg-delta";

const NOTE_SPAWN: PubgNoteItem = {
  id: "note:pubg-43.1:spawn:lmg",
  patch: "43.1",
  weaponKeys: ["Item_Weapon_RPD_C"],
  stat: "스폰율",
  before: "100%",
  after: "70%",
  direction: "nerf",
  expectedRelChange: -0.3,
  summary: "스폰율 30% 감소",
  anchorUrl: "https://www.pubg.com/en/news/11057",
};

/** 관측 축이 설계되지 않은 공지 항목(반동·ADS 등) — 숫자를 지어내면 안 된다. */
const NOTE_UNVERIFIABLE: PubgNoteItem = { ...NOTE_SPAWN, id: "note:recoil", expectedRelChange: null };

const BIG_N = { before: 30_000, after: 20_000 };

describe("relChangeInterval", () => {
  it("점유율 비율 변화와 그 신뢰구간을 낸다", () => {
    const { rel, ci } = relChangeInterval(3000, 100_000, 2000, 100_000);
    expect(rel).toBeCloseTo(-1 / 3, 2);
    expect(ci[0]).toBeLessThan(rel);
    expect(ci[1]).toBeGreaterThan(rel);
  });

  it("한쪽이 0이면 판정 불가로 0을 낸다(지어내지 않는다)", () => {
    expect(relChangeInterval(0, 100, 5, 100).rel).toBe(0);
    expect(relChangeInterval(5, 100, 0, 100).ci).toEqual([0, 0]);
  });

  it("시행수가 커질수록 CI가 좁아진다", () => {
    const small = relChangeInterval(300, 10_000, 200, 10_000);
    const large = relChangeInterval(30_000, 1_000_000, 20_000, 1_000_000);
    const width = (ci: readonly [number, number]) => ci[1] - ci[0];
    expect(width(large.ci)).toBeLessThan(width(small.ci));
  });
});

describe("deriveEffectFloor", () => {
  const rows = (changes: number[]) =>
    changes.map((relChange, i) => ({
      weaponKey: `W${i}`,
      relChange,
      n: { before: 1000, after: 1000 },
    }));

  it("패치노트가 언급하지 않은 무기들의 분포에서 바닥을 유도한다", () => {
    // 언급 없는 무기 10종이 0~9% 사이로 흔들린다 → 90분위 ≈ 0.09
    const floor = deriveEffectFloor(
      rows([0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09]),
      new Set()
    );
    expect(floor).toBeCloseTo(0.09, 2);
  });

  it("언급된 무기는 귀무분포에서 제외한다 — 자기 자신으로 바닥을 만들면 안 된다", () => {
    const all = rows([0.01, 0.02, 0.03, 0.9]);
    all[3]!.weaponKey = "Item_Weapon_RPD_C";
    const withMention = deriveEffectFloor(all, new Set(["Item_Weapon_RPD_C"]));
    const withoutMention = deriveEffectFloor(all, new Set());
    expect(withMention).toBeLessThan(withoutMention);
    expect(withMention).toBeLessThanOrEqual(0.03);
  });

  it("시행수 미달 무기는 분포를 부풀리므로 뺀다", () => {
    const noisy = [
      { weaponKey: "A", relChange: 0.01, n: { before: 1000, after: 1000 } },
      { weaponKey: "B", relChange: 0.02, n: { before: 1000, after: 1000 } },
      { weaponKey: "TINY", relChange: 5, n: { before: 3, after: 2 } },
    ];
    expect(deriveEffectFloor(noisy, new Set())).toBeLessThanOrEqual(0.02);
  });

  it("귀무분포가 비면 Infinity — 바닥을 모르면 아무것도 승격시키지 않는다", () => {
    expect(deriveEffectFloor([], new Set())).toBe(Infinity);
  });
});

describe("classify", () => {
  it("시행수 미달이면 표본부족", () => {
    expect(
      classify(-0.5, [-0.6, -0.4], { before: PICKUP_MIN_N - 1, after: 5000 }, null, 0.1)
    ).toBe("insufficient-sample");
  });

  it("공지값의 밴드 안이면 공지-일치 — CI가 공지값을 배제해도 그렇다", () => {
    // 2026-09-16 실측 회귀 케이스: RPD -26.0% [-27.3%, -24.7%] vs 공지 -30%.
    // CI는 -0.30을 포함하지 않지만 비율 0.867이 밴드 안이므로 일치여야 한다.
    const status = classify(-0.26, [-0.273, -0.247], BIG_N, NOTE_SPAWN, 0.1);
    expect(status).toBe("announced-consistent");
  });

  it("공지값의 절반도 안 움직였으면 공지-불일치", () => {
    expect(classify(-0.12, [-0.14, -0.1], BIG_N, NOTE_SPAWN, 0.1)).toBe("announced-inconsistent");
  });

  it("공지값보다 과하게 움직여도 공지-불일치", () => {
    expect(classify(-0.6, [-0.65, -0.55], BIG_N, NOTE_SPAWN, 0.1)).toBe("announced-inconsistent");
  });

  it("방향이 반대면 크기를 볼 것도 없이 공지-불일치", () => {
    expect(classify(0.3, [0.25, 0.35], BIG_N, NOTE_SPAWN, 0.1)).toBe("announced-inconsistent");
  });

  it("관측 축이 없는 공지 항목은 판정하지 않고 회색으로 남긴다", () => {
    expect(classify(-0.9, [-0.95, -0.85], BIG_N, NOTE_UNVERIFIABLE, 0.1)).toBe("no-change");
  });

  it("짝이 없고 유의하며 바닥을 넘으면 미공지", () => {
    expect(classify(0.2, [0.15, 0.25], BIG_N, null, 0.1)).toBe("unannounced");
  });

  it("짝이 없고 유의하지만 바닥 미달이면 임계 미달 — 미공지로 승격시키지 않는다", () => {
    expect(classify(0.05, [0.03, 0.07], BIG_N, null, 0.1)).toBe("below-threshold");
  });

  it("CI가 0을 포함하면 변화 없음", () => {
    expect(classify(0.2, [-0.05, 0.45], BIG_N, null, 0.1)).toBe("no-change");
  });

  it("밴드는 공지값을 기준으로 대칭이 아니라 비율이다", () => {
    const [lo, hi] = ANNOUNCED_RATIO_BAND;
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(1);
    // 경계 바로 안/밖
    const inside = classify(-0.3 * hi * 0.99, [-1, -0.01], BIG_N, NOTE_SPAWN, 0.1);
    const outside = classify(-0.3 * hi * 1.01, [-1, -0.01], BIG_N, NOTE_SPAWN, 0.1);
    expect(inside).toBe("announced-consistent");
    expect(outside).toBe("announced-inconsistent");
  });
});

// 2026-09-16 verify-impl B-4 — 목록 첫 줄이 "가장 흔들리는 발견"이 되던 정렬을 바꿨다.
describe("conservativeEffect", () => {
  it("구간이 0을 가로지르면 주장할 하한이 없다", () => {
    expect(conservativeEffect([-0.05, 0.12])).toBe(0);
  });

  it("양쪽이 같은 부호면 0에 가까운 끝을 쓴다", () => {
    expect(conservativeEffect([0.139, 0.174])).toBeCloseTo(0.139, 6);
    expect(conservativeEffect([-0.176, -0.093])).toBeCloseTo(0.093, 6);
  });

  it("점추정이 큰 넓은 구간보다 점추정이 작은 좁은 구간을 위로 올린다", () => {
    // 실측: L6 +20.2% [+10.6, +30.6] vs Beryl M762 +15.7% [+13.9, +17.4]
    expect(conservativeEffect([0.139, 0.174])).toBeGreaterThan(conservativeEffect([0.106, 0.306]));
  });
});
