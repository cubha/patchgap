// src/components/compare/logic.ts
// 대조표 순수 로직 — 상태 필터·정렬·좌 내비게이터 검색/섹션 필터·델타 셀 포맷·커버리지 집계.
// 렌더(CompareExplorer.tsx 등)와 분리해 단위 테스트한다(완료 조건 "상태 필터·정렬 로직(순수
// 함수)"). UX-BRIEF §3 "02 대조표" 기준.

import { isGapStatus } from "@/pipeline/shared/status-order";
import { isDisplayExcludedNote } from "@/pipeline/shared/excluded-notes";
import type { DeltaRecord, PatchNoteItem, PatchNoteSection } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { fmtCiHalf, fmtDeltaInt, fmtDeltaSec, fmtInt, fmtPp } from "@/lib/format";
import { absDelta, countRelevantNoteEntities, metricKind } from "@/components/home/logic";
import { parseLaneAxis, type LaneAxis } from "@/lib/lane";
import { STATUS_SORT_PRIORITY } from "@/pipeline/shared/status-order";
import { DISPLAY_SORT_PRIORITY, displayStatus, type DisplayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "./entityRows";

/**
 * 상태 필터 칩 — 2026-09-18 라운드6(사용자 C5·C1) **4종**. 이전 10종(전체·공지-일치·공지-불일치·
 * 공지 · 관측 미확인·공지 · 바닥 미달·노트에 없는 변화·미공지·간접 영향·표본 부족·바닥 미달)은
 * 판정 엔진 어휘를 그대로 칩으로 옮긴 것이라 "공지된 내용은 공지된 내용인데 상세 value가 나뉜다"는
 * 지적을 받았다. 화면이 답할 질문은 둘이다 — 노트가 말한 것인가 · 노트와 반대로 움직였는가.
 * 노이즈 3종(표본 부족·바닥 미달·변화 없음)은 표에 올리지 않으므로 칩도 없다(배지 1종 = 칩 1종 불변식
 * 유지 — 표에 없는 상태의 칩은 항상 0건을 가리키게 된다).
 */
export const STATUS_FILTERS: ReadonlyArray<{ key: DisplayStatus | "all"; label: string }> = [
  { key: "all", label: "전체" },
  { key: "announced", label: "공지" },
  { key: "announced-anomaly", label: "공지 · 이상 관측" },
  { key: "unannounced", label: "미공지" },
];

/** 표시 키 동등비교 — `unannounced`는 `indirect-effect`까지 함께 남긴다(displayStatus가 한 키로
 * 접는다). 소속 판정을 여기서 다시 쓰지 않는다. */
export function filterByStatus(rows: DeltaRecord[], key: string, qAlpha?: number): DeltaRecord[] {
  if (key === "all") return rows;
  return rows.filter((r) => displayStatus(r, qAlpha) === key);
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
export type SortKey = "absDelta" | "q" | "n" | "priority";

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
    // 2026-09-18(채점 라운드1 ST-9): 기본 정렬. |Δ| 단독이면 첫 화면이 라인골드 "바닥 미달"
    // 6행으로 채워진다(실측) — 골드는 절대값이 커서 비율 지표를 항상 이긴다. 상태 우선순위
    // (미공지 → 간접 → 불일치 → …)를 먼저 보고, 같은 상태 안에서만 |Δ|로 가른다.
    if (key === "priority") {
      const rank = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
      const cmp = rank !== 0 ? -rank : absDelta(a) - absDelta(b);
      return direction === "asc" ? cmp : -cmp;
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
 * 없으면 null. 우선순위는 `DISPLAY_SORT_PRIORITY`(exhaustive `Record` — 새 표시 키가 등록되지 않으면
 * tsc가 잡는다; 옛 `indexOf` 구현은 미등록 상태를 -1로 최우선 오판정했다, 2026-09-13). */
export function representativeStatus(noteId: string, rows: DeltaRecord[], qAlpha?: number): DisplayStatus | null {
  let best: DisplayStatus | null = null;
  let bestRank = Infinity;
  for (const row of rows) {
    if (!row.matchedNoteIds.includes(noteId)) continue;
    const shown = displayStatus(row, qAlpha);
    const rank = DISPLAY_SORT_PRIORITY[shown];
    if (rank < bestRank) {
      bestRank = rank;
      best = shown;
    }
  }
  return best;
}

/** 좌 내비 항목 1개 = 엔티티 1개(2026-09-18 라운드6, 사용자 L4 "챔피언, 아이템 별로 하나의 항목으로
 * 묶어서 표시"). 줄 목록은 문서 순서 그대로, 스킬은 첫 등장 순서로 중복 제거. */
export interface NoteEntityGroup {
  /** 대표 id = 첫 줄 id(선택·React key). */
  id: string;
  entity: string;
  section: PatchNoteSection;
  notes: PatchNoteItem[];
  skills: string[];
}

export function groupNotesForNav(items: readonly PatchNoteItem[]): NoteEntityGroup[] {
  const order: string[] = [];
  const byEntity = new Map<string, NoteEntityGroup>();
  for (const item of items) {
    // 의회 투표 결과·게임 모드 섹션 줄은 SR 엔티티 항목이 아니다 — 홈·엔티티 수와 같은 술어(라운드6 보완 1·5).
    if (isDisplayExcludedNote(item)) continue;
    const key = `${item.section}:${item.entity}`;
    const group = byEntity.get(key);
    if (group) {
      group.notes.push(item);
      if (item.skill && !group.skills.includes(item.skill)) group.skills.push(item.skill);
      continue;
    }
    byEntity.set(key, {
      id: item.id,
      entity: item.entity,
      section: item.section,
      notes: [item],
      skills: item.skill ? [item.skill] : [],
    });
    order.push(key);
  }
  return order.map((key) => byEntity.get(key)!);
}

/**
 * 엔티티 묶음의 배지 — 그 묶음의 줄들에 짝지어진 행 중 **보고 가능**(유의·바닥 통과·노이즈 아님)한
 * 것만 보고 최우선 표시 키를 낸다. 하나도 없으면 null이고 호출부는 배지 대신 "유의한 관측 없음"을
 * 쓴다(사용자 C1 — 비유의 관측에 배지를 달지 않는다). 델타 테이블 행(`buildEntityRows`)과 같은
 * 잣대라 배지가 있는데 표에 행이 없는 일은 생기지 않는다.
 */
export function navBadgeStatus(
  noteIds: readonly string[],
  rows: readonly DeltaRecord[],
  qAlpha?: number
): DisplayStatus | null {
  let best: DisplayStatus | null = null;
  for (const row of rows) {
    if (!row.matchedNoteIds.some((id) => noteIds.includes(id))) continue;
    if (!isReportableRecord(row, qAlpha)) continue;
    const shown = displayStatus(row, qAlpha);
    if (best === null || DISPLAY_SORT_PRIORITY[shown] < DISPLAY_SORT_PRIORITY[best]) best = shown;
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
  /** 미공지(`unannounced`+`indirect-effect`) **엔티티** 수 — 커버리지 바·히어로 타일·Gap 탭이 같은 단위를
   * 쓴다(2026-09-18 라운드6 재판정 보완 4: 관측 행 49 vs 엔티티 28이 설명 없이 병존했다). */
  gapEntityCount: number;
}

export function computeCoverage(rows: DeltaRecord[], notes: NotesFile | null): CoverageStats {
  let matchedCount = 0;
  let unannouncedCount = 0;
  let lowSampleCount = 0;
  let belowThresholdCount = 0;
  let indirectEffectCount = 0;
  const gapEntities = new Set<string>();
  for (const row of rows) {
    if (row.status === "announced-consistent" || row.status === "announced-inconsistent") matchedCount++;
    else if (row.status === "unannounced") unannouncedCount++;
    else if (row.status === "insufficient-sample") lowSampleCount++;
    else if (row.status === "below-threshold") belowThresholdCount++;
    else if (row.status === "indirect-effect") indirectEffectCount++;
    if (isGapStatus(row.status)) gapEntities.add(`${row.entityType}:${row.entityKey}`);
  }
  return {
    noteEntityCount: countRelevantNoteEntities(notes),
    noteItemCount: notes?.meta.itemCount ?? 0,
    matchedCount,
    unannouncedCount,
    lowSampleCount,
    belowThresholdCount,
    indirectEffectCount,
    gapEntityCount: gapEntities.size,
  };
}
