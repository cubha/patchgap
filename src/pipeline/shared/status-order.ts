// src/pipeline/shared/status-order.ts
// MatchStatus 정렬 우선순위 단일 소스 — verdict.ts(node, sortDeltas)와 compare/logic.ts(클라이언트,
// representativeStatus)가 이 파일 하나만 본다.
//
// 신설 이유(2026-09-13, below-threshold 도입): `compare/logic.ts`의 기존 `STATUS_PRIORITY`는
// 평범한 `MatchStatus[]` 배열 + `indexOf`였다 — 배열에 없는 상태값은 `indexOf`가 -1을 반환하고,
// `-1 < 다른 모든 순위`이므로 그 상태가 최우선으로 오판정된다(신규 상태를 배열에 추가하는 걸
// 깜빡해도 tsc가 못 잡는 조용한 결함). `Record<MatchStatus, number>`는 유니온을 전수 요구하는
// exhaustive 타입이라, 새 status가 `types.ts`에 추가되고 여기 누락되면 tsc가 컴파일 타임에 잡는다
// (verdict.ts의 기존 STATUS_SORT_PRIORITY·format.ts STATUS_LABELS와 동일한 SSOT 관례).
//
// fs 등 Node 전용 의존 없음 — significance.ts와 동일 원칙으로 클라이언트 번들에도 실린다
// (compare/logic.ts가 "use client" CompareExplorer.tsx에서 소비).
//
// 순위 근거: unannounced(0) > indirect-effect(1) > announced-inconsistent(2) >
// announced-consistent(3) > below-threshold(4) > insufficient-sample(5) > no-change(6).
// below-threshold는 통계적으로는 실재하는 유의 변화이지만(insufficient-sample=판정 유보와 다름)
// 실무상 무시 가능한 규모라 아래쪽에 둔다. indirect-effect(2026-09-13 신규)는 "노트에 직접
// 조항은 없지만 다른 조항의 파급효과로 설명되는 변화"라 순수 미공지 바로 다음 — 원인 체인이
// 붙어 있어 정보량은 높지만 "노트가 말하지 않은 미지의 변화"라는 차별 지표에서는 한 단계 아래다.

import type { MatchStatus } from "../types";

export const STATUS_SORT_PRIORITY: Record<MatchStatus, number> = {
  unannounced: 0,
  "indirect-effect": 1,
  "announced-inconsistent": 2,
  "announced-consistent": 3,
  "below-threshold": 4,
  "insufficient-sample": 5,
  "no-change": 6,
};

/**
 * "노트에 없는데 움직였다"에 해당하는 상태 — **Gap 소속 판정의 단일 소스**.
 *
 * 왜 이 파일인가: 이 술어를 쓰는 곳이 서버(홈 집계·스트림 그룹핑)와 클라이언트(대조표 필터)
 * 양쪽에 걸쳐 있다. `status-order.ts`는 이미 그 두 세계가 공유하는 유일한 상태 모듈이고
 * (파일 헤더: "fs 등 Node 전용 의존 없음 — 클라이언트 번들에도 실린다"), 그래서 여기 둔다.
 *
 * 왜 한 곳이어야 하는가(2026-09-17 B2): 히어로 타일·Gap 탭 배지·스트림 목록·대조표 통합
 * 필터가 **같은 집합**을 가리켜야 화면이 스스로를 반박하지 않는다. 조건을 두 곳에 적어 두면
 * 한쪽만 고쳤을 때 조용히 갈라지고, 그 어긋남은 숫자가 다르게 보일 때까지 드러나지 않는다.
 * (실제로 이번 라운드에서 타일만 49로 고치고 링크를 47짜리 화면에 두는 어긋남이 한 번 났다.)
 *
 * `indirect-effect`가 여기 포함되는 근거: 그것은 `unannounced`를 재분류한 결과라 두 상태는
 * 배타적이면서 부분집합 관계이고, 차이는 "원인이 규명됐는가" 하나뿐이다
 * (`docs/plan/PLAN-gap-display-unify-2026-09-17.md` §3 판별).
 */
export function isGapStatus(status: MatchStatus): boolean {
  return status === "unannounced" || status === "indirect-effect";
}
