// src/components/compare/toolbarRules.ts
// 대조표 도구모음의 **규칙** — 칩 세트·개수·정렬·검색(UX-BRIEF §8-3). 순수 함수만 둔다.
//
// **왜 게임 중립인가**: 세 대조표는 행 타입이 서로 다르다(LoL `DeltaRecord` · TFT 엔티티 행 ·
// PUBG `PubgDeltaRow`). 그래서 행을 받지 않고 **접근자**(`statusOf`·`effectOf`·`nameOf`)를 받는다 —
// 데이터 필드는 게임 몫이고(§8-0) 거르고 세고 줄 세우는 규칙만 여기 몫이다.
//
// **왜 필요했나**(§8-7 #7 실측): 상태 칩이 LoL 4종·PUBG 3종·TFT 0종, 개수 표기는 PUBG만,
// 검색은 LoL만, 정렬은 PUBG만이었다. 같은 메뉴인데 쓸 수 있는 도구가 게임마다 달랐다.
import { DISPLAY_SORT_PRIORITY, type DisplayStatus } from "@/pipeline/shared/display-status";

export type CompareFilterKey = "all" | DisplayStatus;

/**
 * 상태 칩 — **표에 올라가는 판정만** 칩이 된다(배지 1종 = 칩 1종 불변식). 노이즈 3종(표본 부족·
 * 바닥 미달·변화 없음)은 세 게임 모두 표에 올리지 않으므로 칩도 없다. 이 목록이 `logic.ts`의
 * `STATUS_FILTERS`를 대체한다 — 어휘가 두 곳에 있으면 한쪽만 고쳐진다.
 *
 * 키를 `all`·표시 키 그대로 쓰는 이유: 홈 3타일이 `/{game}/compare/#unannounced`로 착지하는데
 * 해시와 칩 키가 같아야 받는 쪽이 성립한다.
 */
export const COMPARE_FILTERS: ReadonlyArray<{ key: CompareFilterKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "announced", label: "공지" },
  { key: "announced-anomaly", label: "공지 · 이상 관측" },
  { key: "unannounced", label: "미공지" },
];

export type CompareSortKey = "priority" | "effect" | "name";

/**
 * 정렬 3종. **기본은 판정 우선순위**다 — |Δ| 단독을 기본으로 두면 절대값이 큰 지표(LoL 라인 골드,
 * PUBG 고점유 무기)가 첫 화면을 채우고 정작 발견이 아래로 밀린다(2026-09-18 실측).
 */
export const COMPARE_SORTS: ReadonlyArray<{ key: CompareSortKey; label: string }> = [
  { key: "priority", label: "판정 우선순위" },
  { key: "effect", label: "변화 크기" },
  { key: "name", label: "이름" },
];

export function matchesFilter(status: DisplayStatus, key: CompareFilterKey): boolean {
  return key === "all" || status === key;
}

/** 칩마다 몇 건인지 — **모든 칩 키를 채운다**(빠진 키는 화면에 `undefined`로 나간다). */
export function countByFilter<T>(
  rows: readonly T[],
  statusOf: (row: T) => DisplayStatus
): Record<CompareFilterKey, number> {
  const out = Object.fromEntries(COMPARE_FILTERS.map((f) => [f.key, 0])) as Record<
    CompareFilterKey,
    number
  >;
  for (const row of rows) {
    const status = statusOf(row);
    for (const f of COMPARE_FILTERS) if (matchesFilter(status, f.key)) out[f.key] += 1;
  }
  return out;
}

export interface CompareAccessors<T> {
  statusOf: (row: T) => DisplayStatus;
  /** 변화 크기 — 부호 없는 값으로 받는다(단위·지표는 게임 몫). */
  effectOf: (row: T) => number;
  nameOf: (row: T) => string;
}

/** 새 배열을 돌려준다 — 입력은 서버가 준 읽기 전용 배열일 수 있다. */
export function sortRows<T>(
  rows: readonly T[],
  key: CompareSortKey,
  acc: CompareAccessors<T>
): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (key === "name") return acc.nameOf(a).localeCompare(acc.nameOf(b));
    const byEffect = Math.abs(acc.effectOf(b)) - Math.abs(acc.effectOf(a));
    if (key === "effect") return byEffect;
    const rank =
      DISPLAY_SORT_PRIORITY[acc.statusOf(a)] - DISPLAY_SORT_PRIORITY[acc.statusOf(b)];
    return rank !== 0 ? rank : byEffect;
  });
  return copy;
}

/** 대상 이름 부분 일치. 좌 내비와 **같은 질의**를 쓴다 — 검색창이 화면에 둘 있으면 안 된다. */
export function searchRows<T>(rows: readonly T[], query: string, nameOf: (row: T) => string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => nameOf(row).toLowerCase().includes(q));
}
