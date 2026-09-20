// src/pipeline/aggregate/stats.ts
// 통계 게이트 — Wilson CI, Newcombe 차이 CI, BH-FDR 다중비교 보정, beta-binomial 축소.
// 외부 통계 라이브러리 의존 0 (SCOPE §3 "통계" 채택 근거: 함수 규모, 판정 로직 투명성).
// 전부 순수 함수 — 부수효과 없음. 소비처(ST-06 집계기·ST-08 verdict)는 이 파일이 export하는
// 시그니처만 본다. 근거: docs/research/RESEARCH-patchgap-2026-09-05.md §3-2,
// docs/plan/PLAN-patchgap.md ①F2·②제약("n≥200 게이트 + Newcombe CI 비중첩 + BH-FDR q<0.10").

import type { DeltaMetric, Interval } from "../types";

/** 승률 최소 n 게이트(§2 제약). 표본이 이 미만이면 "insufficient-sample"로 떨어진다. */
export const WIN_RATE_MIN_N = 200;

/** BH-FDR 유의수준(§2 제약: "BH-FDR q<0.10"). */
export const FDR_ALPHA = 0.1;

/** 95% 신뢰수준 z값 — Wilson/Newcombe/평균차 CI 공통 기본값. */
export const Z_95 = 1.96;

/**
 * 오차함수(erf) 근사 — |x|<=4는 매클로린 급수를 항별 재귀(t_n = t_(n-1) * -x²(2n-1)/(n(2n+1)))로
 * 직접 합산해 배정밀도에 가까운 정확도를 낸다(수치 검증: |erf(1)-0.8427007929497149|~1e-16,
 * |erf(4)-0.99999998458|~5e-12 — node로 기지값 대조 완료).
 * |x|>4는 series 항이 지수적으로 커졌다 줄어드는 과정에서 상쇄오차(catastrophic cancellation)로
 * 무너지므로(실측: erf(5)가 series로 1.00000007 — 오차 7e-8) sign(x)*1로 클램프한다.
 * 이때 최대 오차는 erfc(4)=1.5e-8로 스펙 목표(<1e-7)를 만족한다.
 */
function erf(x: number): number {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax > 4) return sign;
  let term = ax;
  let sum = term;
  for (let n = 1; n < 300; n++) {
    term *= (-ax * ax * (2 * n - 1)) / (n * (2 * n + 1));
    sum += term;
    if (Math.abs(term) < 1e-18) break;
  }
  return sign * (2 / Math.sqrt(Math.PI)) * sum;
}

/** 표준정규 누적분포함수 Φ(x) — erf 기반. `src/pipeline/match/delta.ts`의 `meanDiffPValue`도
 * 이 구현을 재사용한다(2026-09-05 리팩토링 — 이전엔 delta.ts가 동일한 erf 근사를 로컬로
 * 중복 구현했다, `erfApprox`/`normalCdfApprox`). */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Wilson score interval — 단일 비율(픽률·밴률·승률)의 CI. n=0이면 [0,0].
 * 경계는 비율의 정의역([0,1]) 밖으로 나가지 않도록 클램프한다(부동소수 오차로 0 미만/1 초과가
 * 나올 수 있음 — 실측: successes=0 케이스에서 low가 -2e-17로 나옴).
 */
export function wilsonInterval(successes: number, n: number, z = Z_95): Interval {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const low = (center - margin) / denom;
  const high = (center + margin) / denom;
  return [Math.max(0, low), Math.min(1, high)];
}

/**
 * Newcombe(1998) 방법 10 — 두 독립 비율 차이(p2-p1, 즉 "이후"-"이전")의 CI. 각 그룹의 Wilson
 * CI [l,u]를 구한 뒤 hybrid score 결합식으로 차이 구간을 만든다:
 *   low  = (p2-p1) - sqrt((p2-l2)^2 + (u1-p1)^2)
 *   high = (p2-p1) + sqrt((u2-p2)^2 + (p1-l1)^2)
 * 인자 순서는 (이전 s1,n1) → (이후 s2,n2)로 aggregate/verdict 소비처의 "전/후" 명명과 맞춘다.
 */
export function newcombeDiffInterval(
  s1: number,
  n1: number,
  s2: number,
  n2: number,
  z = Z_95
): Interval {
  const p1 = n1 === 0 ? 0 : s1 / n1;
  const p2 = n2 === 0 ? 0 : s2 / n2;
  const [l1, u1] = wilsonInterval(s1, n1, z);
  const [l2, u2] = wilsonInterval(s2, n2, z);
  const diff = p2 - p1;
  const low = diff - Math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2);
  const high = diff + Math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2);
  return [low, high];
}

/**
 * 풀드(pooled) z검정 양측 p-value — 두 독립 비율이 같다는 귀무가설 검정.
 * pooled 비율의 분산이 0(두 그룹 다 100% 또는 0%)이면 se=0 → 비율이 같으면 p=1, 다르면
 * (귀무가설상 불가능한 관측이므로) p=0으로 처리한다.
 * n1===0 또는 n2===0이면 해당 쪽 비율(s/n)이 0/0=NaN으로 정의되지 않는다 — 검정 불가이므로
 * 비유의(p=1)로 고정한다(실측 결함: 26.16→26.17 실데이터 게이트에서 포지션별 승률 n=0인
 * 챔피언 102건이 이 경로로 NaN을 냈고, benjaminiHochberg의 정렬·누적-min 단계에서 나머지
 * 1,857건의 q까지 연쇄 오염시켰다 — 챔피언 행 전부 q=null로 깨진 원인).
 */
export function twoProportionPValue(s1: number, n1: number, s2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 1;
  const p1 = s1 / n1;
  const p2 = s2 / n2;
  const pooled = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return p1 === p2 ? 1 : 0;
  const z = (p1 - p2) / se;
  // 양측 p = 2*(1-Φ(|z|))
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * Benjamini-Hochberg FDR 보정 — p-value 배열 → 보정된 q-value + 기각 여부(동일 순서로 반환).
 * 표준 절차: p 오름차순 정렬 → q_(i) = p_(i)*m/i → 뒤에서부터 누적최소로 단조화 → [0,1] 클램프
 * → 원래 순서로 환원. rejected[i] = q[i] <= alpha.
 *
 * 비유한(NaN/±Infinity) p는 검정 집합에서 제외한다(m=유한 개수만) — 정렬 기반 누적최소 절차라
 * NaN 하나가 섞이면 비교(`a.p - b.p`)가 전부 무의미해져 정렬 위치가 흔들리고, 그 이웃 순위의
 * q까지 NaN으로 전파된다(실측 결함: p 배열에 NaN 1건이 섞이자 델타 1,966건 중 1,859건의 q가
 * null로 깨졌다 — twoProportionPValue/meanDiffPValue 쪽 근본 원인은 별도로 고쳤지만, 이 함수도
 * 방어적으로 NaN을 격리해야 향후 유사 결함이 다시 전체를 오염시키지 않는다). 비유한 위치의 q는
 * "검정 미수행"을 뜻하는 `null`을 반환한다(DeltaRecord.q가 이미 `number | null` 계약 — 호출부
 * 변경 불필요). 유한 p들의 q값은 NaN이 아예 없을 때와 완전히 동일해야 한다(테스트로 고정).
 */
export function benjaminiHochberg(
  pValues: number[],
  alpha = FDR_ALPHA
): { q: (number | null)[]; rejected: boolean[] } {
  const m = pValues.length;
  if (m === 0) return { q: [], rejected: [] };

  const finiteIndexed = pValues
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => Number.isFinite(p));
  finiteIndexed.sort((a, b) => a.p - b.p);

  const mFinite = finiteIndexed.length;
  const qSorted = finiteIndexed.map(({ p }, k) => (p * mFinite) / (k + 1));
  for (let k = mFinite - 2; k >= 0; k--) {
    qSorted[k] = Math.min(qSorted[k], qSorted[k + 1]);
  }

  const q = new Array<number | null>(m).fill(null);
  for (let k = 0; k < mFinite; k++) {
    q[finiteIndexed[k].i] = Math.min(1, qSorted[k]);
  }
  const rejected = q.map((qi) => qi !== null && qi <= alpha);
  return { q, rejected };
}

/**
 * 경험적 베이즈(empirical Bayes) 축소 평균 — 저표본 챔피언 승률이 극단으로 튀는 것을 완화한다.
 * n=0 → priorMean로 수렴, n→∞ → 표본 비율(successes/n)로 수렴.
 */
export function betaBinomialShrink(
  successes: number,
  n: number,
  priorMean: number,
  priorStrength: number
): number {
  return (successes + priorMean * priorStrength) / (n + priorStrength);
}

/** 승률 최소 n 게이트 — 전/후 둘 다 minN 이상이어야 통과. */
export function passesSampleGate(nBefore: number, nAfter: number, minN = WIN_RATE_MIN_N): boolean {
  return nBefore >= minN && nAfter >= minN;
}

// ─── 효과크기 바닥(effect-size floor) — 미공지 판정 2차 게이트 ───
//
// 통계적 유의성(q<FDR_ALPHA && CI가 0을 안 포함)만으로는 미공지를 판정할 수 없다: n≈10,000
// 표본에서는 0.2%p 픽률 변화도 유의해진다. 픽/밴은 경기당 고정 슬롯(제로섬)이라 한 챔피언의
// 상승이 다수 챔피언의 강제 하락으로 상쇄되고, 그 하락분이 개별적으로 "유의"하게 잡혀 전부
// 미공지로 계상되는 실측 결함이 있었다(2026-09-13, 26.16→26.17 미공지 277건 중 84%가 픽/밴,
// |delta| 중앙값 0.76%p — docs/plan/PLAN-unannounced-effect-size-floor-2026-09-13.md ①).
// 이 바닥은 "짝 없음(미공지 후보)" 판정에만 적용한다 — 소비처(verdict.assignStatus)가 강제한다.
//
// 단위 주의: delta/before는 전부 비율(0~1)이다. %p(1~100 스케일)가 아니다 — delta.ts가 만드는
// pickRate/banRate/winRate/adoptionRate 델타는 전부 `n/분모` 형태의 비율 차이다(UI가 표시 시점에만
// ×100 한다). 여기 상수도 반드시 같은 스케일(0.02 = 2.0%p)로 정의한다.
export interface EffectFloor {
  /** "absolute" = |delta| >= value(비율 단위) · "relative" = |delta|/|before| >= value */
  kind: "absolute" | "relative";
  value: number;
  /**
   * 기저 게이트(선택) — `max(|before|, |after|)`가 이 값 미만이면 상대변화율이 아무리 커도
   * 미달 처리한다. 상대 바닥만 쓰는 지표에서 **저기저 잡음**을 막기 위한 장치다(2026-09-13 추가).
   *
   * 왜 필요한가(실측): 아이템 채택률의 분모는 `totalParticipants`(경기수×10, 168챔피언 전체)라
   * 절대 %p가 구조적으로 희석된다 — 그래서 절대 바닥이 아니라 상대 25%를 쓴다. 그런데 상대
   * 기준만 두면 기저가 0.2%인 아이템이 0.08%p만 움직여도 "상대 33%"로 통과한다(26.17→26.18
   * 모렐로노미콘 0.237%→0.316%). 그 구간은 표본 잡음과 구분되지 않고, 화면에는 "0.1%p"로 찍혀
   * 발견처럼 보이지도 않는다. 절대 co-floor를 얹으면 방금 부정한 %p 축을 다시 들이는 셈이므로,
   * **"애초에 쓰이던 아이템인가"** 라는 다른 축으로 건다.
   *
   * `before`가 아니라 `max(before, after)`인 이유: before=0/극소에서 급등한 경우(0% → 1.5%)는
   * 저기저 잡음이 아니라 실제 채택 전환이라 살려야 한다.
   */
  minBase?: number;
}

/**
 * `DeltaMetric` 8종 전수 — 새 metric이 추가되면 tsc가 이 Record 누락을 컴파일 타임에 잡는다
 * (types.ts METRIC_KIND/METRIC_LABELS와 동일한 SSOT 관례).
 *
 * **연속 지표에도 바닥을 건다**(2026-09-13 2차, 최초 도입 때의 `value: 0`을 실값으로 교체).
 * 근거는 두 가지다:
 *   ① 구조적 — 이 지표들을 갖는 엔티티(lane/objective/summary)는 `match/entity-match.ts`가
 *      매칭 루프에서 `entityType !== "champion" && !== "item"`을 `continue`로 건너뛴다. 즉
 *      **패치노트와 짝지어질 수 있는 경로가 아예 없다.** 실측으로도 두 패치쌍 15행 전부
 *      matchedNoteIds=0이다. "짝이 없다"가 관측이 아니라 전제인 행을 "미공지 변화"로 부르면
 *      제품의 차별 지표가 항상 참인 명제로 오염된다.
 *   ② 규모 — 실측 라인 골드 변화는 최대 75골드(상대 1.36%)다. 14분 시점 75골드는 아이템 한
 *      칸을 못 바꾸는 차이이고, 라인 평균 골드는 어느 챔피언이 그 라인에 섰는지(메타 구성)에
 *      따라 그만큼은 늘 흔들린다.
 * 바닥을 상대(골드)로 둔 이유: 라인별 베이스가 서포터 4.2k~바텀 6.2k로 달라 절대 골드 바닥은
 * 라인마다 다른 엄격도가 된다. firstSec/avgDurationSec은 절대 초가 직관적이라 절대 기준.
 * 이 바닥은 "선언 대상이 아니니 영구히 숨긴다"가 아니다 — 라인 골드가 3%(바텀 기준 186골드)
 * 움직이면 그건 노트 없이 일어난 진짜 이상 신호이므로 다시 미공지로 올라온다.
 */
export const EFFECT_SIZE_FLOORS: Record<DeltaMetric, EffectFloor> = {
  pickRate: { kind: "absolute", value: 0.02 },
  banRate: { kind: "absolute", value: 0.03 },
  winRate: { kind: "absolute", value: 0.02 },
  adoptionRate: { kind: "relative", value: 0.25, minBase: 0.01 },
  goldAt10: { kind: "relative", value: 0.03 },
  goldAt14: { kind: "relative", value: 0.03 },
  firstSec: { kind: "absolute", value: 30 },
  avgDurationSec: { kind: "absolute", value: 60 },
  // ── TFT (2026-09-20) ──────────────────────────────────────────────────────
  // top4Rate: 8인 전투에서 상위 4등은 **정의상 기저 50%**다. winRate와 분포가 같으므로
  // 같은 절대 바닥을 쓴다 — 다른 값을 고르려면 근거가 따로 있어야 하는데, 없다.
  top4Rate: { kind: "absolute", value: 0.02 },
  // playRate: 유닛 등장률은 기저가 지표마다 수십 배 차이 난다(코어 유닛 60% vs 틈새 3%).
  // 절대 %p를 쓰면 저기저 유닛은 절대 안 걸리고 고기저 유닛만 걸린다 — adoptionRate와 같은
  // 이유로 상대 바닥 + 저기저 차단(minBase)을 쓴다.
  playRate: { kind: "relative", value: 0.25, minBase: 0.01 },
  // avgPlacement: 값이 1~8 고정 범위라 상대 변화가 의미를 못 만든다(4.50→4.60은 2.2%인데
  // 실제로는 꽤 큰 이동이다). 0.15등은 8인 전투에서 한 판 걸러 한 계단이 밀리는 정도다.
  avgPlacement: { kind: "absolute", value: 0.15 },
};

/**
 * 효과크기 바닥 충족 여부. `delta===null`(측정 불가)은 항상 미달 — "무근거 문장은 회색" 원칙과
 * 같은 이유로 측정 불가를 미공지로 승격시키지 않는다. relative 바닥은 `before===null`이면 근거가
 * 없으므로 미달, `before===0`이고 `delta!==0`이면 상대변화가 정의상 무한대이므로 통과시킨다(절대
 * 바닥이 아니라 상대 바닥을 쓰는 지표에서만 발생 — 채택률처럼 극저 베이스에서 신규 등장한 변화를
 * 놓치지 않기 위함. q/CI 게이트가 이미 그 앞단에서 미세 표본 잡음을 걸러낸 뒤라는 전제).
 */
export function meetsEffectFloor(
  metric: DeltaMetric,
  delta: number | null,
  before: number | null
): boolean {
  if (delta === null) return false;
  const floor = EFFECT_SIZE_FLOORS[metric];

  // 기저 게이트(설정된 지표만) — 상대 바닥의 저기저 잡음 차단. EffectFloor.minBase 주석 참고.
  if (floor.minBase !== undefined) {
    if (before === null) return false;
    const base = Math.max(Math.abs(before), Math.abs(before + delta));
    if (base < floor.minBase) return false;
  }

  if (floor.kind === "absolute") {
    return Math.abs(delta) >= floor.value && delta !== 0;
  }
  // relative
  if (before === null) return false;
  if (before === 0) return delta !== 0;
  return Math.abs(delta) / Math.abs(before) >= floor.value;
}

/**
 * 비율(rate)과 분모(denominator)로부터 원시 분자(횟수)를 역산한다 — `delta.ts`의 banRate 역산
 * (`Math.round(banRate * totalMatches)`)과 동일한 원칙을 헬퍼로 공유해, pickRate/adoptionRate/
 * winRate 분자도 verdict 단계에서 참조 가능하게 한다. `DeltaRecord`에 필드를 추가하지 않고
 * 파생 계산으로 해결한 이유는 PLAN ②-2 참고 — 소비자 없는 필드가 커밋 대상 JSON 스키마를
 * 불필요하게 부풀리기 때문이다.
 */
export function proportionNumerator(rate: number | null, denominator: number): number | null {
  if (rate === null) return null;
  if (denominator === 0) return 0;
  return Math.round(rate * denominator);
}

/**
 * 연속 지표(골드·게임 시간 등)의 두 그룹 평균 차이(mean2-mean1) CI — Welch 근사
 * (등분산 가정 없이 se = sqrt(sd1²/n1 + sd2²/n2), z 배수로 정규근사 — 표본이 커
 * t-분포 자유도 보정 없이 z=1.96 정규근사로 충분하다는 전제, PLAN 통계 스택과 동일 원칙).
 */
export function meanDiffInterval(
  mean1: number,
  sd1: number,
  n1: number,
  mean2: number,
  sd2: number,
  n2: number,
  z = Z_95
): Interval {
  const diff = mean2 - mean1;
  const se = Math.sqrt((sd1 * sd1) / n1 + (sd2 * sd2) / n2);
  const margin = z * se;
  return [diff - margin, diff + margin];
}

/** 숫자 배열 → n·평균·표본표준편차(ddof=1). n<2면 sd=0. n=0이면 mean=0. */
export function summarize(values: number[]): { n: number; mean: number; sd: number } {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0 };
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  if (n === 1) return { n, mean, sd: 0 };
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(variance) };
}
