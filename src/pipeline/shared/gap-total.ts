// src/pipeline/shared/gap-total.ts
// 「미공지 Gap」 대상 수의 **단일 정의**(2026-09-28, PR-C D2) — 순수 함수만(파일 I/O 없음).
// 게임 홈 타일·탭·랜딩 카드(`lib/gapTotals`)와 디스코드 브리핑 헤드라인(`scripts/run-notify.ts`)이 모두
// 여기를 부른다. 같은 라벨이 화면·알림마다 다른 수를 말하던 결함군(LoL 사이트 36 vs 디스코드 35)을 막는다.
// 정의: (그 게임 화면이 「미공지」로 그리는 통계 Gap **대상**) ∪ (수치 축 대상: 잠수함 + 값 어긋남).
import type { DeltaRecord } from "../types";
import type { PubgDeltaRow } from "../match/pubg-delta";
import type { GameDataDiffFile } from "../gamedata/types";
import { isSubmarineChange } from "../gamedata/types";
import { buildNoteMismatchIndexFromChanges, buildSubmarineIndexFromChanges } from "../gamedata/submarine";
import { displayStatus } from "./display-status";
import { isReportableRecord } from "./reportable";
import { isGapStatus } from "./status-order";
import { isReportable } from "./pubg-status";

const keyOf = (row: { entityType: string; entityKey: string }) => `${row.entityType}:${row.entityKey}`;

/** 수치 축 대상 키 — 잠수함 + 공지값 불일치(화면 `summarizeGameData`의 `entities`·`mismatches`와 같은 색인). */
export function numericAxisKeys(file: Pick<GameDataDiffFile, "changes"> | null): Set<string> {
  if (!file) return new Set();
  return new Set(
    [
      ...buildSubmarineIndexFromChanges(file.changes.filter(isSubmarineChange)).entities(),
      ...buildNoteMismatchIndexFromChanges(file.changes).entities(),
    ].map(keyOf)
  );
}

function unionSize(statKeys: Iterable<string>, numericKeys: ReadonlySet<string>): number {
  return new Set([...statKeys, ...numericKeys]).size;
}

/** LoL — 통계 쪽 술어는 `countGapEntities`와 같은 `isGapStatus`이고, 거기에 수치 축 대상을 합친다(그래서 수는 그보다 크거나 같다). */
export function lolGapTotal(rows: readonly DeltaRecord[], numericKeys: ReadonlySet<string>): number {
  return unionSize(rows.filter((row) => isGapStatus(row.status)).map(keyOf), numericKeys);
}

/**
 * TFT 통계 Gap 행 — 보고 자격 + 대조표와 **같은** 표시 상태(`displayStatus`) 「미공지」. 상태값만 보는
 * 술어는 방향 중립(동률 노트)을 몰라 같은 대상을 홈·대조표에서 다르게 불렀다(인수검증 V1, 오른).
 */
export function tftGapRows(rows: readonly DeltaRecord[], qAlpha: number): DeltaRecord[] {
  return rows.filter((row) => isReportableRecord(row, qAlpha) && displayStatus(row, qAlpha) === "unannounced");
}

export function tftGapTotal(rows: readonly DeltaRecord[], qAlpha: number, numericKeys: ReadonlySet<string>): number {
  return unionSize(tftGapRows(rows, qAlpha).map(keyOf), numericKeys);
}

/**
 * 브리핑 Gap 탭 **지표 축 목록**의 행(ST-10, 2026-10-08) — 통계 Gap 행에서 수치 축 대상을 **뺀** 것. 한 대상은 한 섹션에만
 * 선다(수치 축이 이긴다 — 증거 등급). 전에는 렝가·아무무가 두 섹션에 다 올라 있었고, 머리 숫자(행 수 26)가 대조표 미공지
 * 칩(대상 수 21)과 달랐다. 이 목록의 대상 수 + 수치 축 대상 수 = `tftGapTotal`(타일)이 항등식이다.
 */
export function tftMetricGapRows(rows: readonly DeltaRecord[], qAlpha: number, numericKeys: ReadonlySet<string>): DeltaRecord[] {
  return tftGapRows(rows, qAlpha).filter((row) => !numericKeys.has(keyOf(row)));
}

/** PUBG 통계 Gap 행 — 보고 자격 + `isGapStatus`(미공지 정의의 소유자). */
export function pubgGapRows(rows: readonly PubgDeltaRow[]): PubgDeltaRow[] {
  return rows.filter((row) => isReportable(row.status) && isGapStatus(row.status));
}

export function pubgGapTotal(rows: readonly PubgDeltaRow[], numericKeys: ReadonlySet<string>): number {
  return unionSize(pubgGapRows(rows).map((row) => `weapon:${row.weaponKey}`), numericKeys);
}

/** PUBG 지표 축 목록 — `tftMetricGapRows`와 같은 규칙(무기 키). */
export function pubgMetricGapRows(rows: readonly PubgDeltaRow[], numericKeys: ReadonlySet<string>): PubgDeltaRow[] {
  return pubgGapRows(rows).filter((row) => !numericKeys.has(`weapon:${row.weaponKey}`));
}
