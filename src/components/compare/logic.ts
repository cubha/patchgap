// src/components/compare/logic.ts
// 대조표 순수 로직 — 상태 필터·정렬·좌 내비게이터 검색/섹션 필터·델타 셀 포맷·커버리지 집계.
// 렌더(CompareExplorer.tsx 등)와 분리해 단위 테스트한다(완료 조건 "상태 필터·정렬 로직(순수
// 함수)"). UX-BRIEF §3 "02 대조표" 기준.

import type { DeltaRecord, MatchStatus, PatchNoteItem, PatchNoteSection } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { fmtCiHalf, fmtDeltaInt, fmtDeltaSec, fmtInt, fmtPp } from "@/lib/format";
import { absDelta, countRelevantNoteEntities, metricKind } from "@/components/home/logic";
import { parseLaneAxis, type LaneAxis } from "@/lib/lane";
import { STATUS_SORT_PRIORITY, isGapStatus } from "@/pipeline/shared/status-order";

/** 상태 필터 칩 6종(UX-BRIEF "02 대조표" 필터 바) — "no-change"는 칩이 없다(전체=필터 없음이라
 * no-change 행도 "전체"에서는 그대로 보인다, ST-11.md 구현 결정 참고). `below-threshold`는
 * 2026-09-13 신규 — 통계적으로 유의하지만 효과크기 바닥 미달인 델타(기본 접힘/비강조, 대조표
 * 탭에서만 명시적으로 선택해야 보인다). `key`를 `MatchStatus | "all"`로 좁혀(2026-09-05 리팩토링)
 * 오타로 존재하지 않는 상태값을 넣으면 컴파일 타임에 잡는다 — `filterByStatus`/
 * `CompareExplorer.tsx`의 `statusFilter` 상태는 URL 해시에서도 올 수 있어 여전히 `string`을
 * 받는다(런타임 값이라 타입으로 좁힐 수 없음). */
/** 상태 하나가 아니라 **묶음**을 가리키는 필터 키. 홈 히어로 타일·Gap 탭이 세는 집합
 * (`unannounced` + `indirect-effect`)을 대조표에서도 그대로 표현할 수 있어야 한다 —
 * 2026-09-17(B2) 전에는 타일이 49를 말하면서 47만 보이는 화면으로 링크했다. */
export const GAP_FILTER_KEY = "gap";

export const STATUS_FILTERS: ReadonlyArray<{ key: MatchStatus | "all" | typeof GAP_FILTER_KEY; label: string }> = [
  { key: "all", label: "전체" },
  { key: "announced-consistent", label: "공지-일치" },
  { key: "announced-inconsistent", label: "공지-불일치" },
  { key: GAP_FILTER_KEY, label: "노트에 없는 변화" },
  { key: "unannounced", label: "미공지" },
  { key: "indirect-effect", label: "간접 영향" },
  { key: "insufficient-sample", label: "표본 부족" },
  { key: "below-threshold", label: "임계 미달" },
];

/** `gap`은 두 상태를 함께 통과시킨다. 개별 상태 칩(미공지·간접 영향)도 남겨 둔다 — 통합은
 * "같은 질문의 답"이라는 뜻이지 둘을 구분할 수 없다는 뜻이 아니다.
 *
 * 소속 판정은 **여기서 다시 쓰지 않고** `shared/status-order.ts`의 `isGapStatus`를 부른다.
 * 조건을 두 곳에 적어 두면 한쪽만 고쳤을 때 홈 타일(49)과 이 화면(47)이 조용히 갈라진다 —
 * 이번 라운드에 실제로 한 번 난 어긋남이고, acceptance-critic이 그 재발 경로를 지적했다. */
export function filterByStatus(rows: DeltaRecord[], key: string): DeltaRecord[] {
  if (key === "all") return rows;
  if (key === GAP_FILTER_KEY) return rows.filter((r) => isGapStatus(r.status));
  return rows.filter((r) => r.status === key);
}

/**
 * 라인 필터 — 확정 시안(2026-09-10)이 대조표 필터바에도 라인 6종을 두므로 신설했다.
 * `"all"`은 전체 통과. 특정 라인을 고르면 남는 행은 둘뿐이다:
 *  - 챔피언 position-scope 행(`champion:{key}:{pos}:{metric}`) — `parseLaneAxis`가 판정
 *  - 라인 엔티티 행(`lane:{pos}:{metric}` — 골드@10/14) — entityType/entityKey로 판정
 *
 * 결과적으로 **밴률은 라인 선택 시 자동으로 사라진다** — 밴은 라인 무관이라 position-scope
 * 행에 banRate가 없고(ChampionStat.ci.ban은 scope!=="all"에서 null), all-scope 행은
 * `parseLaneAxis`가 `"all"`을 돌려주므로 특정 라인과 절대 일치하지 않는다. HANDOFF §6
 * "라인별 밴률 컬럼 — 컬럼 자체를 만들지 말 것"을 별도 분기 없이 구조로 만족한다.
 */
export function filterByLane(rows: DeltaRecord[], lane: LaneAxis): DeltaRecord[] {
  if (lane === "all") return rows;
  return rows.filter(
    (r) =>
      parseLaneAxis(r.id) === lane || (r.entityType === "lane" && r.entityKey === lane)
  );
}

/** 헤더 정렬 3키(ST-11 프롬프트 "헤더 정렬(클라이언트, |Δ|·q·n)"). q는 낮을수록(더 유의할수록)
 * 우선이므로 오름차순, |Δ|·n은 클수록 우선이므로 내림차순이 기본 방향이다. */
export type SortKey = "absDelta" | "q" | "n";

function nOf(record: DeltaRecord): number {
  return record.n.before + record.n.after;
}

export function sortRows(rows: DeltaRecord[], key: SortKey, direction: "asc" | "desc" = "desc"): DeltaRecord[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    // |Δ|·n은 "값이 클수록 우선"이라 desc(기본값)가 -cmp(큰 값 먼저)다. q는 반대로 "값이 작을수록
    // (더 유의할수록) 우선"이므로 desc가 오히려 +cmp(작은 값 먼저)여야 세 키 모두 "desc = 더
    // 흥미로운/중요한 행이 먼저"라는 사용자 관점의 일관된 기본 방향을 유지한다.
    if (key === "q") {
      const cmp = (a.q ?? Infinity) - (b.q ?? Infinity);
      return direction === "desc" ? cmp : -cmp;
    }
    const cmp = key === "absDelta" ? absDelta(a) - absDelta(b) : nOf(a) - nOf(b);
    return direction === "asc" ? cmp : -cmp;
  });
  return copy;
}

/** 좌 내비게이터 섹션 탭 대상 — 프로토타입은 챔피언/아이템/시스템 3탭만 두고 "기타"는 없다. */
export const NAV_SECTIONS: ReadonlyArray<{ key: PatchNoteSection; label: string }> = [
  { key: "champion", label: "챔피언" },
  { key: "item", label: "아이템" },
  { key: "system", label: "시스템" },
];

export function filterNotesBySection(items: PatchNoteItem[], section: PatchNoteSection): PatchNoteItem[] {
  return items.filter((item) => item.section === section);
}

export function filterNotesBySearch(items: PatchNoteItem[], query: string): PatchNoteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.entity.toLowerCase().includes(q) ||
      (item.skill ?? "").toLowerCase().includes(q) ||
      (item.stat ?? "").toLowerCase().includes(q)
  );
}

/** 노트 id → 그 노트와 짝지어진 델타들의 "대표 상태"(우선순위 최상위 1개). 짝지어진 델타가 하나도
 * 없으면 null(호출부가 "관측 없음" muted로 렌더). 우선순위는 `shared/status-order.ts`의
 * `STATUS_SORT_PRIORITY`(verdict.ts와 공유하는 단일 소스)를 쓴다 — 이전엔 로컬 `MatchStatus[]`
 * 배열 + `indexOf`였는데, 배열에 없는 상태값은 `indexOf`가 -1을 반환해 그 상태가 "최우선"으로
 * 오판정되는 결함이 있었다(tsc가 못 잡음, 2026-09-13 below-threshold 도입 시 발견). exhaustive
 * `Record`는 새 status가 여기 등록되지 않으면 tsc가 컴파일 타임에 잡는다. */
export function representativeStatus(noteId: string, rows: DeltaRecord[]): MatchStatus | null {
  let best: MatchStatus | null = null;
  let bestRank = Infinity;
  for (const row of rows) {
    if (!row.matchedNoteIds.includes(noteId)) continue;
    const rank = STATUS_SORT_PRIORITY[row.status];
    if (rank < bestRank) {
      bestRank = rank;
      best = row.status;
    }
  }
  return best;
}

/** 변동 칩(▲▼•) — insufficient-sample은 판정 보류라 delta 부호와 무관하게 항상 "•"(회색)로
 * 표시한다(프로토타입 `.delta-flat` 대응). */
export function directionSymbol(record: DeltaRecord): { symbol: string; colorClass: string } {
  if (record.status === "insufficient-sample" || record.delta === null || record.delta === 0) {
    return { symbol: "•", colorClass: "text-muted" };
  }
  return record.delta > 0
    ? { symbol: "▲", colorClass: "text-success" }
    : { symbol: "▼", colorClass: "text-danger" };
}

/** Δ 셀 텍스트 — insufficient-sample은 프로토타입처럼 "—"(승률 n 게이트 미달 상태에서는 델타
 * 수치 자체를 신뢰할 수 없다는 뜻, ST-11.md 구현 결정). */
export function formatDeltaCell(record: DeltaRecord): string {
  if (record.status === "insufficient-sample" || record.delta === null) return "—";
  const kind = metricKind(record.metric);
  if (kind === "pp") return fmtPp(record.delta);
  if (kind === "sec") return fmtDeltaSec(record.delta);
  return fmtDeltaInt(record.delta);
}

/** 95% CI 셀 텍스트 — DeltaValue.tsx의 kind별 스케일링 규칙과 동일(pp는 ×100, sec/gold는 그대로). */
export function formatCiCell(record: DeltaRecord): string {
  if (record.status === "insufficient-sample") return "—";
  const kind = metricKind(record.metric);
  if (kind === "pp") return fmtCiHalf([record.ci[0] * 100, record.ci[1] * 100], 1);
  if (kind === "sec") return `${fmtCiHalf(record.ci, 0)}s`;
  return fmtCiHalf(record.ci, 0);
}

/** n 셀 텍스트 — insufficient-sample은 실제 카운트 대신 "n<200"(게이트 조건 자체를 표기, 프로토타입
 * `02-comparison-table.html` 그대로). */
export function formatNCell(record: DeltaRecord): string {
  if (record.status === "insufficient-sample") return "n<200";
  return `${fmtInt(record.n.before)}/${fmtInt(record.n.after)}`;
}

/** 짝 셀 텍스트 — matchedNoteId(예: "note:26.17:champion:qiyana:5a6d587d")를 그대로 쓰기엔 너무
 * 길어 마지막 콜론 세그먼트(해시)만 남겨 짧게 표기한다("—"는 짝 없음). */
export function shortNoteId(matchedNoteId: string | null): string {
  if (!matchedNoteId) return "—";
  const parts = matchedNoteId.split(":");
  return parts[parts.length - 1] ?? matchedNoteId;
}

/** 하단 커버리지 바 집계 — "노트 N엔티티(M항목) 중 관측 짝 K · 미공지 U · 표본 부족 I". N은 홈
 * 헤드라인과 동일 정의(엔티티 단위 묶음, countRelevantNoteEntities)를 재사용해 두 화면 수치를
 * 일치시킨다.
 *
 * `noteEntityCount`/`noteItemCount` 리네임(HANDOFF-redesign-2026-09-10.md §4-1, 2026-09-10):
 * 기존 `noteItemCount`가 실제 값은 엔티티 수인데 `CoverageBar.tsx`가 "노트 N**항목** 중"으로
 * 렌더해 홈(`home/logic.ts` `HeadlineStats`)과 정확히 같은 클래스의 오라벨이었다 — HANDOFF
 * 명시 범위는 홈뿐이었으나 사용자 승인으로 함께 고친다(같은 결함을 한쪽만 고치면 화면 간 수치
 * 해석이 갈린다). */
export interface CoverageStats {
  noteEntityCount: number;
  noteItemCount: number;
  matchedCount: number;
  unannouncedCount: number;
  lowSampleCount: number;
  /** 2026-09-13 신규 — 통계적으로 유의하지만 효과크기 바닥 미달(`below-threshold`)인 건수.
   * `unannouncedCount`(여전히 `status==='unannounced'`만)와 별도 카운트로 노출해 CoverageBar가
   * 기본 비강조로 덧붙인다. */
  belowThresholdCount: number;
  /** 2026-09-13 신규 — 노트 직접 조항은 없으나 다른 조항의 파급효과로 설명되는 건수
   * (`indirect-effect`). `unannouncedCount`에서 빠져나간 만큼이 여기로 온다. */
  indirectEffectCount: number;
}

export function computeCoverage(rows: DeltaRecord[], notes: NotesFile | null): CoverageStats {
  let matchedCount = 0;
  let unannouncedCount = 0;
  let lowSampleCount = 0;
  let belowThresholdCount = 0;
  let indirectEffectCount = 0;
  for (const row of rows) {
    if (row.status === "announced-consistent" || row.status === "announced-inconsistent") matchedCount++;
    else if (row.status === "unannounced") unannouncedCount++;
    else if (row.status === "insufficient-sample") lowSampleCount++;
    else if (row.status === "below-threshold") belowThresholdCount++;
    else if (row.status === "indirect-effect") indirectEffectCount++;
  }
  return {
    noteEntityCount: countRelevantNoteEntities(notes),
    noteItemCount: notes?.meta.itemCount ?? 0,
    matchedCount,
    unannouncedCount,
    lowSampleCount,
    belowThresholdCount,
    indirectEffectCount,
  };
}
