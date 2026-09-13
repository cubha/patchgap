import { describe, it, expect } from "vitest";
import {
  wilsonInterval,
  newcombeDiffInterval,
  twoProportionPValue,
  benjaminiHochberg,
  betaBinomialShrink,
  passesSampleGate,
  meanDiffInterval,
  summarize,
  WIN_RATE_MIN_N,
  FDR_ALPHA,
  Z_95,
  EFFECT_SIZE_FLOORS,
  meetsEffectFloor,
  proportionNumerator,
} from "../stats";

describe("wilsonInterval", () => {
  it("n=0이면 [0,0]이다", () => {
    expect(wilsonInterval(0, 0)).toEqual([0, 0]);
  });

  it("s=0,n=10 → 기지값 ≈[0, 0.278] (MetricGate Wilson 공식 수기 대조)", () => {
    const [low, high] = wilsonInterval(0, 10);
    expect(low).toBeCloseTo(0, 3);
    expect(high).toBeCloseTo(0.278, 3);
  });

  it("s=5,n=10 → 기지값 ≈[0.237, 0.763]", () => {
    const [low, high] = wilsonInterval(5, 10);
    expect(Math.abs(low - 0.237)).toBeLessThan(1e-3);
    expect(Math.abs(high - 0.763)).toBeLessThan(1e-3);
  });

  it("s=100,n=10240 → 폭 ±~0.002 (RESEARCH §3-1 규모 참고: 대량 표본에서 픽률류 CI는 좁다)", () => {
    const [low, high] = wilsonInterval(100, 10240);
    const halfWidth = (high - low) / 2;
    expect(Math.abs(halfWidth - 0.002)).toBeLessThan(1e-3);
  });

  it("경계는 [0,1] 밖으로 나가지 않는다(부동소수 오차 클램프)", () => {
    const [low, high] = wilsonInterval(0, 10);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
  });

  it("CI 폭 계산 예 — n=100 승률(p=0.5) 반폭 ≈0.098 (RESEARCH §3-2 근거)", () => {
    const [low, high] = wilsonInterval(50, 100);
    const halfWidth = (high - low) / 2;
    expect(Math.abs(halfWidth - 0.098)).toBeLessThan(0.01);
  });

  it("CI 폭 계산 예 — n=10000 픽률(p≈0.05) 반폭 ≈0.004", () => {
    const [low, high] = wilsonInterval(500, 10000);
    const halfWidth = (high - low) / 2;
    expect(Math.abs(halfWidth - 0.004)).toBeLessThan(1e-3);
  });
});

describe("newcombeDiffInterval", () => {
  it("(s1=56,n1=70, s2=48,n2=80) → 문헌값 대략 [-0.34,-0.06] 근방(허용 0.02)", () => {
    const [low, high] = newcombeDiffInterval(56, 70, 48, 80);
    expect(Math.abs(low - -0.34)).toBeLessThan(0.02);
    expect(Math.abs(high - -0.06)).toBeLessThan(0.02);
  });

  it("동일 비율이면 0을 포함한다", () => {
    const [low, high] = newcombeDiffInterval(50, 100, 50, 100);
    expect(low).toBeLessThanOrEqual(0);
    expect(high).toBeGreaterThanOrEqual(0);
  });

  it("diff는 p2-p1(이후-이전) 방향이다 — 승률이 오르면 구간이 양수 쪽에 있다", () => {
    const [low, high] = newcombeDiffInterval(50, 100, 90, 100);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
  });
});

describe("twoProportionPValue", () => {
  it("동일 비율 → ≈1", () => {
    expect(twoProportionPValue(50, 100, 50, 100)).toBeCloseTo(1, 5);
  });

  it("극단 차이(100% vs 0%) → <1e-6", () => {
    expect(twoProportionPValue(100, 100, 0, 100)).toBeLessThan(1e-6);
  });

  it("중간 정도 차이는 (0,1) 사이의 유의한 값", () => {
    const p = twoProportionPValue(70, 100, 50, 100);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.05);
  });

  it("실결함 회귀: n1=0(또는 n2=0)이면 0/0 NaN 대신 비유의(p=1)로 고정한다", () => {
    expect(twoProportionPValue(0, 0, 5, 10)).toBe(1);
    expect(twoProportionPValue(5, 10, 0, 0)).toBe(1);
    expect(Number.isFinite(twoProportionPValue(0, 0, 5, 10))).toBe(true);
  });
});

describe("benjaminiHochberg", () => {
  it("빈 배열 → q·rejected 모두 빈 배열", () => {
    expect(benjaminiHochberg([])).toEqual({ q: [], rejected: [] });
  });

  it("p=[0.01,0.04,0.03,0.005], alpha=0.05 → 기각 패턴·q 단조성", () => {
    const { q, rejected } = benjaminiHochberg([0.01, 0.04, 0.03, 0.005], 0.05);
    // 손대조: 정렬 0.005,0.01,0.03,0.04 / rank 1..4 → raw q = 0.02,0.02,0.04,0.04 (이미 단조)
    expect(q[3]).toBeCloseTo(0.02, 5); // idx3(p=0.005, rank1)
    expect(q[0]).toBeCloseTo(0.02, 5); // idx0(p=0.01, rank2)
    expect(q[2]).toBeCloseTo(0.04, 5); // idx2(p=0.03, rank3)
    expect(q[1]).toBeCloseTo(0.04, 5); // idx1(p=0.04, rank4)
    expect(rejected).toEqual([true, true, true, true]);

    // q는 p-value 순위를 그대로 따르는 단조 비감소 함수여야 한다(오름차순 정렬 후 확인)
    const sortedByP = [0.005, 0.01, 0.03, 0.04].map((p) => {
      const idx = [0.01, 0.04, 0.03, 0.005].indexOf(p);
      return q[idx]!; // 전부 유한 p라 null이 아님을 알고 있음(NaN 격리 케이스는 별도 테스트)
    });
    for (let i = 1; i < sortedByP.length; i++) {
      expect(sortedByP[i]).toBeGreaterThanOrEqual(sortedByP[i - 1] - 1e-9);
    }
  });

  it("alpha 인자를 생략하면 FDR_ALPHA(0.10) 기본값을 쓴다", () => {
    const withDefault = benjaminiHochberg([0.001, 0.5, 0.8]);
    const withExplicit = benjaminiHochberg([0.001, 0.5, 0.8], FDR_ALPHA);
    expect(withDefault).toEqual(withExplicit);
    expect(withDefault.rejected[0]).toBe(true);
  });

  it("q값은 항상 [0,1] 범위다(클램프)", () => {
    const { q } = benjaminiHochberg([0.9, 0.95, 0.99]);
    for (const qi of q) {
      expect(qi).toBeLessThanOrEqual(1);
      expect(qi).toBeGreaterThanOrEqual(0);
    }
  });

  it("실결함 회귀: NaN p 1건이 섞여도 나머지 유한 p의 q는 NaN 없이 계산한 것과 완전히 동일하다", () => {
    const withNaN = benjaminiHochberg([0.001, NaN, 0.5, 1e-7]);
    const withoutNaN = benjaminiHochberg([0.001, 0.5, 1e-7]);
    // NaN 위치(index 1)는 검정 미수행 → null(NaN 아님 — JSON 직렬화 시 null로 떨어져야 한다)
    expect(withNaN.q[1]).toBeNull();
    expect(withNaN.rejected[1]).toBe(false);
    // 유한 p 3개(index 0,2,3)의 q는 NaN이 아예 없는 3원소 배열([0.001,0.5,1e-7])과 값이 같다
    expect(withNaN.q[0]).toBeCloseTo(withoutNaN.q[0]!, 12);
    expect(withNaN.q[2]).toBeCloseTo(withoutNaN.q[1]!, 12);
    expect(withNaN.q[3]).toBeCloseTo(withoutNaN.q[2]!, 12);
  });

  it("실결함 회귀: ±Infinity p도 검정 집합에서 제외되고 이웃 유한 q를 오염시키지 않는다", () => {
    const { q, rejected } = benjaminiHochberg([0.01, Infinity, -Infinity, 0.02]);
    expect(q[1]).toBeNull();
    expect(q[2]).toBeNull();
    expect(rejected[1]).toBe(false);
    expect(rejected[2]).toBe(false);
    expect(q[0]).not.toBeNull();
    expect(q[3]).not.toBeNull();
    expect(Number.isFinite(q[0]!)).toBe(true);
    expect(Number.isFinite(q[3]!)).toBe(true);
  });
});

describe("betaBinomialShrink", () => {
  it("n=0 → priorMean으로 수렴", () => {
    expect(betaBinomialShrink(0, 0, 0.5, 20)).toBe(0.5);
  });

  it("n→∞(매우 큼) → 표본 비율(successes/n)로 수렴", () => {
    const shrunk = betaBinomialShrink(700000, 1000000, 0.5, 20);
    expect(shrunk).toBeCloseTo(0.7, 4);
  });

  it("저표본에서는 prior 쪽으로 당겨진다", () => {
    const shrunk = betaBinomialShrink(1, 2, 0.5, 20); // 표본비율 0.5 == prior라 당김 확인 어려우니 다른 값
    const shrunk2 = betaBinomialShrink(2, 2, 0.5, 20); // 표본비율 1.0, prior 0.5, K=20
    // (2 + 0.5*20)/(2+20) = 12/22 ≈ 0.545 — 1.0보다 prior 쪽에 훨씬 가깝다
    expect(shrunk2).toBeLessThan(1.0);
    expect(shrunk2).toBeGreaterThan(0.5);
    expect(shrunk).toBeCloseTo(0.5, 5);
  });
});

describe("passesSampleGate", () => {
  it("199/200 경계 — before 미달이면 false", () => {
    expect(passesSampleGate(199, 500, WIN_RATE_MIN_N)).toBe(false);
  });

  it("199/200 경계 — after 미달이면 false", () => {
    expect(passesSampleGate(500, 199, WIN_RATE_MIN_N)).toBe(false);
  });

  it("200/200 경계 — 정확히 최소값이면 true", () => {
    expect(passesSampleGate(200, 200, WIN_RATE_MIN_N)).toBe(true);
  });

  it("minN 기본값은 WIN_RATE_MIN_N(200)이다", () => {
    expect(passesSampleGate(200, 200)).toBe(true);
    expect(passesSampleGate(199, 200)).toBe(false);
  });
});

describe("meanDiffInterval", () => {
  it("동일 평균·분산이면 0을 중심으로 대칭 구간", () => {
    const [low, high] = meanDiffInterval(100, 10, 200, 100, 10, 200);
    expect(low).toBeCloseTo(-high, 10);
    expect(low).toBeLessThanOrEqual(0);
    expect(high).toBeGreaterThanOrEqual(0);
  });

  it("mean2가 크면 구간은 양수(mean2-mean1) 방향이다", () => {
    const [low, high] = meanDiffInterval(100, 5, 500, 120, 5, 500);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
  });

  it("z를 낮추면(90% 등) 구간이 좁아진다", () => {
    const wide = meanDiffInterval(100, 5, 500, 120, 5, 500, Z_95);
    const narrow = meanDiffInterval(100, 5, 500, 120, 5, 500, 1.0);
    expect(narrow[1] - narrow[0]).toBeLessThan(wide[1] - wide[0]);
  });
});

describe("summarize", () => {
  it("빈 배열 → n=0, mean=0, sd=0", () => {
    expect(summarize([])).toEqual({ n: 0, mean: 0, sd: 0 });
  });

  it("단일 값 → sd=0", () => {
    expect(summarize([42])).toEqual({ n: 1, mean: 42, sd: 0 });
  });

  it("일반 배열 → 표본표준편차(ddof=1)", () => {
    const { n, mean, sd } = summarize([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(n).toBe(8);
    expect(mean).toBeCloseTo(5, 6);
    expect(sd).toBeCloseTo(2.13809, 4);
  });
});

describe("meetsEffectFloor — 단위는 비율(0~1)이지 %p(1~100)가 아니다", () => {
  it("pickRate: |delta|=0.015(1.5%p)는 바닥(0.02) 미달 → false", () => {
    expect(meetsEffectFloor("pickRate", 0.015, 0.1)).toBe(false);
  });

  it("pickRate: |delta|=0.025(2.5%p)는 바닥(0.02) 초과 → true", () => {
    expect(meetsEffectFloor("pickRate", 0.025, 0.1)).toBe(true);
  });

  it("pickRate: |delta|=0.02(정확히 바닥)는 충족(>=) → true", () => {
    expect(meetsEffectFloor("pickRate", 0.02, 0.1)).toBe(true);
  });

  it("banRate: 바닥은 0.03 — 0.029는 false, 0.031은 true", () => {
    expect(meetsEffectFloor("banRate", 0.029, 0.5)).toBe(false);
    expect(meetsEffectFloor("banRate", 0.031, 0.5)).toBe(true);
  });

  it("winRate: 바닥은 0.02 — 부호 무관(음수 delta)", () => {
    expect(meetsEffectFloor("winRate", -0.025, 0.5)).toBe(true);
    expect(meetsEffectFloor("winRate", -0.015, 0.5)).toBe(false);
  });

  it("adoptionRate: 상대기준 — before=0.04, delta=0.009(상대 22.5%)는 미달", () => {
    expect(meetsEffectFloor("adoptionRate", 0.009, 0.04)).toBe(false);
  });

  it("adoptionRate: before=0.04, delta=0.011(상대 27.5%)는 충족", () => {
    expect(meetsEffectFloor("adoptionRate", 0.011, 0.04)).toBe(true);
  });

  it("adoptionRate: before=0이어도 기저 게이트(after<1%)에 걸려 미달", () => {
    // 상대변화는 무한대지만, 최종 채택률이 0.2%에 불과한 아이템은 미공지로 올리지 않는다.
    expect(meetsEffectFloor("adoptionRate", 0.002, 0)).toBe(false);
  });

  it("adoptionRate: before=0 → after가 기저(1%) 이상이면 통과(신규 급등)", () => {
    expect(meetsEffectFloor("adoptionRate", 0.015, 0)).toBe(true);
  });

  it("adoptionRate: before=0, delta=0 → 변화 없음이므로 미달", () => {
    expect(meetsEffectFloor("adoptionRate", 0, 0)).toBe(false);
  });

  it("adoptionRate 기저 게이트: 상대 33%여도 before/after 모두 1% 미만이면 미달", () => {
    // 실측(26.17→26.18 모렐로노미콘): 0.237% → 0.316%. 상대 33%지만 분모가 전체 참가자라
    // 절대 폭이 0.08%p에 불과하고, 저기저 구간은 표본 잡음에 그대로 노출된다.
    expect(meetsEffectFloor("adoptionRate", 0.00079, 0.00237)).toBe(false);
  });

  it("adoptionRate 기저 게이트: before가 1% 미만이어도 after가 1% 이상이면 통과", () => {
    // 실측(26.16→26.17 망자의 갑옷): 0.649% → 1.000%. 상대 +54%이고 결과적으로 1%대 채택률.
    expect(meetsEffectFloor("adoptionRate", 0.00351, 0.00649)).toBe(true);
  });

  it("adoptionRate 기저 게이트: 기저를 넘어도 상대 25% 미만이면 여전히 미달", () => {
    expect(meetsEffectFloor("adoptionRate", 0.004, 0.04)).toBe(false);
  });

  it("adoptionRate: before가 null이면 근거 없음 → 미달(무근거 통과 금지)", () => {
    expect(meetsEffectFloor("adoptionRate", 0.02, null)).toBe(false);
  });

  it("delta가 null이면 측정 불가 → 항상 미달", () => {
    expect(meetsEffectFloor("pickRate", null, 0.1)).toBe(false);
  });

  // 명세 변경(2026-09-13 2차): 연속 지표의 바닥이 0 → 실값으로 바뀌었다. 옛 계약("0 아닌 delta는
  // 전부 통과")을 그대로 두면 라인 골드 0.5골드 변화가 계속 미공지로 올라온다.
  it("goldAt10/goldAt14/firstSec/avgDurationSec: 미세 변화는 바닥 미달", () => {
    expect(meetsEffectFloor("goldAt10", 0.5, 6000)).toBe(false);
    expect(meetsEffectFloor("goldAt14", -0.5, 6000)).toBe(false);
    expect(meetsEffectFloor("firstSec", 1, 480)).toBe(false);
    expect(meetsEffectFloor("avgDurationSec", 0.1, 1800)).toBe(false);
  });

  it("연속지표도 delta===0이면 미달(변화 자체가 없음)", () => {
    expect(meetsEffectFloor("goldAt10", 0, 6000)).toBe(false);
  });

  it("EFFECT_SIZE_FLOORS는 DeltaMetric 8종을 전수 커버한다", () => {
    expect(Object.keys(EFFECT_SIZE_FLOORS).sort()).toEqual(
      [
        "pickRate",
        "banRate",
        "winRate",
        "adoptionRate",
        "goldAt10",
        "goldAt14",
        "firstSec",
        "avgDurationSec",
      ].sort()
    );
  });
});

describe("proportionNumerator — 비율×분모 역산(반올림)", () => {
  it("rate=0.1234, denominator=10000 → 1234", () => {
    expect(proportionNumerator(0.1234, 10000)).toBe(1234);
  });

  it("rate=null이면 분자를 알 수 없음 → null", () => {
    expect(proportionNumerator(null, 10000)).toBeNull();
  });

  it("denominator=0이면 분자는 0(정의상)", () => {
    expect(proportionNumerator(0.5, 0)).toBe(0);
  });

  it("반올림 경계 — 0.00005*10000=0.5 → banker's round 아닌 Math.round(0.5)=1", () => {
    expect(proportionNumerator(0.00005, 10000)).toBe(1);
  });
});

describe("meetsEffectFloor — 연속 지표(라인 골드·오브젝트 시각·경기 시간) 바닥", () => {
  it("goldAt14: 라인 평균 골드 상대 1.2% 변화(실측 최대치)는 미달", () => {
    // 26.16→26.17 바텀 goldAt14 +71.87 / 6210.96 = 1.17%.
    expect(meetsEffectFloor("goldAt14", 71.87, 6210.96)).toBe(false);
  });

  it("goldAt14: 상대 3% 이상이면 통과", () => {
    expect(meetsEffectFloor("goldAt14", 200, 6210.96)).toBe(true);
  });

  it("goldAt10: 서포터처럼 베이스가 낮은 라인도 같은 상대 기준을 쓴다(스케일 무관)", () => {
    expect(meetsEffectFloor("goldAt10", 100, 3000)).toBe(true); // 3.33%
    expect(meetsEffectFloor("goldAt10", 100, 4000)).toBe(false); // 2.50%
  });

  it("firstSec: 30초 미만 변화는 미달, 30초 이상은 통과", () => {
    expect(meetsEffectFloor("firstSec", 6.67, 1375)).toBe(false);
    expect(meetsEffectFloor("firstSec", -31, 1375)).toBe(true);
  });

  it("avgDurationSec: 60초 미만 변화는 미달, 60초 이상은 통과", () => {
    expect(meetsEffectFloor("avgDurationSec", 12.95, 1470)).toBe(false);
    expect(meetsEffectFloor("avgDurationSec", 61, 1470)).toBe(true);
  });
});
