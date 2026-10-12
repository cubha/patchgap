// src/components/BoundaryMark.tsx
// 「경계」 보조 표기(트랙 B ST-25, pubg-S13 · 세 게임). 판정 배지 **옆**에 테두리만 — 판정을 바꾸지 않고 확신도가 다르다는 사실만 말한다.
// 색은 기존 토큰(`--muted` 글자·`--border` 테두리)만 쓴다. 뜻은 title과 방법론이 말한다.
import type { DeltaRecord } from "@/pipeline/types";
import { isBoundaryRecord } from "@/pipeline/shared/boundary";

export const BOUNDARY_TITLE = "경계 — 95% 신뢰구간의 안쪽 끝이 효과크기 바닥 아래입니다. 판정은 섰지만 확신이 약합니다.";
/** 방법론 문장 — 세 게임 방법론이 같은 말을 한다. */
export const BOUNDARY_RULE =
  "판정 배지 옆 「경계」는 점추정은 효과크기 바닥을 넘었지만 95% 신뢰구간의 0에 가까운 끝이 바닥 아래라는 뜻입니다. 판정은 바꾸지 않고, 신뢰구간 전체가 바닥 밖인 판정보다 확신이 약하다는 사실만 구별합니다.";

export default function BoundaryMark() {
  return (
    <span data-boundary title={BOUNDARY_TITLE} className="ml-1.5 inline-flex rounded-pill border border-border px-1.5 font-mono text-xs text-muted">
      경계
    </span>
  );
}

/** 엔티티 행(LoL·TFT) — 그린 지표 셀이 **전부** 경계일 때만. 하나라도 CI 전체가 바닥 밖이면 그 행의 판정은 확신이 있다. */
export function rowIsBoundary(records: readonly DeltaRecord[]): boolean {
  return records.length > 0 && records.every((r) => isBoundaryRecord(r));
}
