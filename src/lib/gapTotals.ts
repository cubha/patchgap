// src/lib/gapTotals.ts
// 「미공지 Gap」 수의 **단일 소유자**(2026-09-28, PR-C D2). 게임 홈의 타일·탭과 랜딩 카드가 같은 함수를
// 부른다 — 같은 라벨이 화면마다 다른 수를 말하던 결함군(LoL 타일 35 vs 탭 36, 랜딩 vs 홈)을 구조로 막는다.
// 정의: (그 게임 화면이 「미공지」로 그리는 통계 Gap **대상**) ∪ (수치 축 대상: 잠수함 + 값 어긋남).
import type { DeltaRecord } from "@/pipeline/types";
import type { PubgDeltaRow } from "@/pipeline/match/pubg-delta";
import { displayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { isGapStatus } from "@/pipeline/shared/status-order";
import { isReportable } from "@/pipeline/shared/pubg-status";
import { gapEntityKeys, gapUnionCount, type SubmarineSummary } from "./gamedata";

/** LoL — 히어로 헤드라인(`countGapEntities`)과 같은 규칙(`isGapStatus`). */
export function lolGapTotal(rows: readonly DeltaRecord[], submarine: SubmarineSummary | null): number {
  return gapUnionCount(gapEntityKeys(rows.filter((row) => isGapStatus(row.status))), submarine);
}

/**
 * TFT 통계 Gap 행 — 보고 자격 + 대조표와 **같은** 표시 상태(`displayStatus`) 「미공지」. 상태값만 보는
 * 술어는 방향 중립(동률 노트)을 몰라 같은 대상을 홈·대조표에서 다르게 불렀다(인수검증 V1, 오른).
 */
export function tftGapRows(rows: readonly DeltaRecord[], qAlpha: number): DeltaRecord[] {
  return rows.filter((row) => isReportableRecord(row, qAlpha) && displayStatus(row, qAlpha) === "unannounced");
}

export function tftGapTotal(rows: readonly DeltaRecord[], qAlpha: number, submarine: SubmarineSummary | null): number {
  return gapUnionCount(gapEntityKeys(tftGapRows(rows, qAlpha)), submarine);
}

/** PUBG 통계 Gap 행 — 보고 자격 + `isGapStatus`(미공지 정의의 소유자). */
export function pubgGapRows(rows: readonly PubgDeltaRow[]): PubgDeltaRow[] {
  return rows.filter((row) => isReportable(row.status) && isGapStatus(row.status));
}

export function pubgGapTotal(rows: readonly PubgDeltaRow[], submarine: SubmarineSummary | null): number {
  return gapUnionCount(
    gapEntityKeys(pubgGapRows(rows).map((row) => ({ entityType: "weapon", entityKey: row.weaponKey }))),
    submarine
  );
}
