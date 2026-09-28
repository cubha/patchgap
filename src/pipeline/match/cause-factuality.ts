// src/pipeline/match/cause-factuality.ts
// 원인 문장의 인과 **사실성** 결정론 검사(2026-09-28, C3). 순수 함수만.
//
// 검증 게이트는 인용 노트의 실재·인용 가능·대상 일치까지만 봤다. 문장이 **숫자로 단정한 것**은 아무도
// 보지 않아, PUBG Groza 원인이 전체 획득 −17.9%를 RPD·M249(두 무기 몫 약 2%p) 탓으로 돌린 문장이
// verified로 나갔다(PLAN-residuals-sweep §⑥ C3). 인과 **해석**은 LLM 영역으로 남기고, 여기서는 숫자로
// 검산할 수 있는 세 형태만 본다 — 걸리면 verified=false(회색)이지 문장을 고치지 않는다.
//
// 연결 전 실측(2026-09-28, 커밋 5쌍 verified 원인 567건 중 화살표 주장): 원 규칙으로 2건이 걸렸고 둘 다
// 사실이었다 — 한 줄에 두 수치가 섞인 원문(→ 노트 요약 문자열의 쌍도 본다)과 델타 자신의 표본 n
// (→ 델타 수치도 근거다). 근거의 **출처**를 넓힌 것이지 허용 오차를 넓힌 것이 아니다.

/** 인용 노트(또는 같은 대상의 형제 노트) 한 건에서 수치 근거로 쓰는 필드. */
export interface ArrowSource {
  before: string | null;
  after: string | null;
  summary: string;
}

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const numbersOf = (text: string): number[] => (text.match(NUMBER) ?? []).map((m) => Number(m.replace(/,/g, "")));

// 「45→40」·「45 ⇒ 40」·「80%에서 90%로」 — 좌·우는 숫자로 시작하는 연속열(`/`·`~`·`%`·`.`·`,` 포함).
const TOKEN = String.raw`(\d[\d.,/~%]*)`;
const ARROW_PAIR = new RegExp(`${TOKEN}\\s*(?:→|⇒|->)\\s*${TOKEN}`, "g");
const FROM_TO_PAIR = new RegExp(`${TOKEN}\\s*(?:초|골드)?에서\\s*${TOKEN}\\s*(?:초|골드)?\\s*로`, "g");

/** 문장(또는 노트 요약)에서 수치 쌍 (좌 숫자들, 우 숫자들)을 뽑는다. */
export function arrowPairs(text: string): [number[], number[]][] {
  const out: [number[], number[]][] = [];
  for (const re of [ARROW_PAIR, FROM_TO_PAIR]) {
    for (const m of text.matchAll(re)) out.push([numbersOf(m[1]), numbersOf(m[2])]);
  }
  return out;
}

const within = (xs: readonly number[], ys: readonly number[]) => xs.every((x) => ys.includes(x));

/**
 * ① 문장의 「A→B」가 근거와 맞나. 각 쌍의 좌 숫자는 어떤 근거의 이전 값에, 우 숫자는 **같은 근거의**
 * 이후 값에 들어 있어야 한다(방향을 뒤집어 인용하면 실패). 근거 = 인용 노트·형제 노트의 before/after와
 * 요약 문자열 속 쌍, 그리고 델타 자신의 수치(`ownNumbers` — 좌·우 모두 그 안이면 통과). 쌍이 없으면 통과.
 */
export function arrowClaimsGrounded(text: string, sources: readonly ArrowSource[], ownNumbers: readonly number[]): boolean {
  const claims = arrowPairs(text);
  if (claims.length === 0) return true;
  const evidence: [number[], number[]][] = sources.flatMap((s) => [
    [numbersOf(s.before ?? ""), numbersOf(s.after ?? "")] as [number[], number[]],
    ...arrowPairs(s.summary),
  ]);
  return claims.every(
    ([left, right]) =>
      (within(left, ownNumbers) && within(right, ownNumbers)) ||
      evidence.some(([b, a]) => within(left, b) && within(right, a))
  );
}

// 부호가 **명시된** 백분율만 — 「+26.3%」·「−17.9%」. 부호 없는 「30% 감소」는 노트 수치일 수 있어 보지 않는다.
const SIGNED_PERCENT = /([+\-−])\s?(\d+(?:\.\d+)?)%(?!p)/g;

/**
 * ② 부호 붙은 「±X%」가 이 델타의 상대 변화·재분배 기대치 등 허용 값(비율, 0.263 = 26.3%) 중 하나와
 * 소수 첫째 자리까지 맞나. PUBG 지시문이 이 수치들을 사용자 메시지로 주므로, 그 밖의 부호 백분율은
 * 지어낸 것이다.
 */
export function signedPercentClaimsGrounded(text: string, allowed: readonly number[]): boolean {
  const allowedTenths = allowed.map((v) => Math.round(Math.abs(v) * 1000));
  for (const m of text.matchAll(SIGNED_PERCENT)) {
    const tenths = Math.round(Number(m[2]) * 10);
    if (!allowedTenths.some((a) => Math.abs(a - tenths) <= 1)) return false;
  }
  return true;
}

const TOTAL_DROP = /전체\s*(?:무기\s*)?획득(?:[^.。]|\.\d)*?(?:감소|줄)/;

/** 전체 감소를 한 조항 탓으로 돌리려면 그 조항 무기가 이전 전체 획득의 과반이어야 한다. */
export const TOTAL_DROP_MIN_SHARE = 0.5;

/**
 * ③ 문장이 「전체 획득 감소」를 인용 노트 탓으로 돌리는데, 그 노트 무기들의 이전 획득 비중 합이
 * 50% 미만이면 실패 — 작은 몫의 변화로는 전체 감소를 설명할 수 없다(Groza 사례: 두 무기 ≈2%).
 * 비중을 모르면(`null`) 판단하지 않는다.
 */
export function totalDropAttributionGrounded(text: string, citedShare: number | null): boolean {
  if (citedShare === null || !TOTAL_DROP.test(text)) return true;
  return citedShare >= TOTAL_DROP_MIN_SHARE;
}
