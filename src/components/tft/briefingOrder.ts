// src/components/tft/briefingOrder.ts
// TFT 브리핑 목록 정렬 — 상태 우선순위 → 효과크기(LoL 홈과 같은 정렬). **자르지 않는다**(트랙 B ST-18, tft-S15).
//
// 전에는 `topRows(rows, 15)`로 기록 15건을 먼저 자른 뒤 대상으로 묶어, 카드 머리 「32종」과 렌더 행(12)이 어긋났고 12번째 행은
// 패널 끝에서 반쯤 잘렸다. 높이는 공용 패널 상수(`PANEL_SCROLL_BODY`)가 막고 LoL·PUBG 브리핑도 상한이 없다.
import { STATUS_SORT_PRIORITY } from "@/pipeline/shared/status-order";
import type { DeltaRecord } from "@/pipeline/types";

export function sortBriefingRows(rows: readonly DeltaRecord[]): DeltaRecord[] {
  return [...rows].sort(
    (a, z) =>
      STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[z.status] || Math.abs(z.delta ?? 0) - Math.abs(a.delta ?? 0)
  );
}
