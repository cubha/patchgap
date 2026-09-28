// src/lib/gapTotals.ts
// 화면 쪽 어댑터 — 「미공지 Gap」 정의는 `pipeline/shared/gap-total.ts`가 소유한다(디스코드 브리핑도 같은
// 함수를 쓴다). 여기는 화면이 이미 들고 있는 `SubmarineSummary`를 수치 축 키로 바꿔 넘길 뿐이다.
import type { DeltaRecord } from "@/pipeline/types";
import type { PubgDeltaRow } from "@/pipeline/match/pubg-delta";
import * as gap from "@/pipeline/shared/gap-total";
import type { SubmarineSummary } from "./gamedata";

export { tftGapRows, pubgGapRows } from "@/pipeline/shared/gap-total";

function keysOf(submarine: SubmarineSummary | null): Set<string> {
  return new Set(
    [...(submarine?.entities ?? []), ...(submarine?.mismatches ?? [])].map((e) => `${e.entityType}:${e.entityKey}`)
  );
}

export const lolGapTotal = (rows: readonly DeltaRecord[], submarine: SubmarineSummary | null) =>
  gap.lolGapTotal(rows, keysOf(submarine));

export const tftGapTotal = (rows: readonly DeltaRecord[], qAlpha: number, submarine: SubmarineSummary | null) =>
  gap.tftGapTotal(rows, qAlpha, keysOf(submarine));

export const pubgGapTotal = (rows: readonly PubgDeltaRow[], submarine: SubmarineSummary | null) =>
  gap.pubgGapTotal(rows, keysOf(submarine));
