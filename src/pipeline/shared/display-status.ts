// src/pipeline/shared/display-status.ts
// 표시 전용 상태 키 — 판정 엔진의 `MatchStatus`는 그대로 두고 화면이 갈라 보여야 하는 경우만
// 여기서 매핑한다(2026-09-18, 채점 라운드1 ST-4 / 사용자 확정 M2).
//
// **왜 필요한가**: `verdict.assignStatus`는 "노트 짝이 있고 방향이 반대"와 "노트 짝이 있는데
// 관측이 유의하지 않음"을 둘 다 `announced-inconsistent`에 넣는다(verdict.ts 헤더 주석). 판정
// 엔진 관점에서는 둘 다 "선언대로 관측되지 않았다"라 같은 값이 맞다. 그러나 화면에서 둘을 같은
// 빨간 "공지-불일치" 배지로 내보내면 독자는 "패치노트가 틀렸다"로 읽는다 — 실측 26.17→26.18:
// 64건 중 59건이 비유의였고 노트 항목 128개 대부분이 빨간 배지를 달았다.
//
// **왜 MatchStatus를 늘리지 않는가**: 상태값은 판정 계약이고 파이프라인·디스코드·방법론이 전부
// 그 어휘로 말한다. 화면이 구분하고 싶은 건 "유의한가"인데 그것은 `isSignificantDelta`가 이미
// 답한다 — 새 상태를 만들면 같은 질문을 두 곳에 적게 된다. 그래서 **표시 키**만 하나 더 둔다.
//
// 클라이언트 번들에도 실린다(CompareExplorer → compare/logic) — Node 전용 의존 금지.

import type { DeltaRecord, MatchStatus } from "../types";
import { isSignificantDelta } from "./significance";
import { STATUS_SORT_PRIORITY } from "./status-order";

/** 화면 배지·칩·정의표가 쓰는 키. `announced-unobserved` = 노트 짝은 있으나 관측이 비유의. */
export type DisplayStatus = MatchStatus | "announced-unobserved";

export function displayStatus(record: DeltaRecord, qAlpha?: number): DisplayStatus {
  if (record.status === "announced-inconsistent" && !isSignificantDelta(record, qAlpha)) {
    return "announced-unobserved";
  }
  return record.status;
}

/** 대표 상태 선택용 우선순위 — `announced-unobserved`는 "일치"보다 덜 흥미롭고 "임계 미달"보다는
 * 노트가 있다는 점에서 앞선다. 값이 `STATUS_SORT_PRIORITY`와 겹치지 않도록 .5를 쓴다. */
export const DISPLAY_SORT_PRIORITY: Record<DisplayStatus, number> = {
  ...STATUS_SORT_PRIORITY,
  "announced-unobserved": STATUS_SORT_PRIORITY["announced-consistent"] + 0.5,
};
