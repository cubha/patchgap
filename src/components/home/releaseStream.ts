// src/components/home/releaseStream.ts
// 릴리즈노트 스트림 조립 — notes.json의 items[]를 entity로 묶어(원본 문서 순서 유지) "정상"
// (matched) 그룹을 만들고, 노트가 없는데 통계적으로 유의한 델타만 관측된
// ("status==='unannounced'") 엔티티를 |delta| 내림차순으로 정렬한 unannounced 그룹을 만든다.
// HANDOFF-redesign-2026-09-10.md §4-1 "챔피언 카드 → 스킬 행" groupBy 요구사항 구현. 렌더
// (ReleaseNoteStream 등)는 ST-H 몫 — 이 모듈은 순수 조립 로직만 담당한다(부수효과 없음).
//
// 2026-09-10 계약 변경(verify-impl 축B, 폐기됨 — 아래 2026-09-14 참고): 이전 계약은 "미공지를
// 스트림 상단에 몰아 삽입"이었다가, "노트 순서 그대로 두고 그 사이에 균등 분산 삽입"으로
// 바뀌었다(상단 몰림이 노트 스트림을 화면 밖으로 밀어내 설계 논지를 지웠기 때문).
//
// 2026-09-14 계약 변경(사용자 지시, 균등 분산 자체 폐기): "패치내용을 메인에서 즉시 확인할 수
// 있도록 → 탭전환하면 패치내용에는 없는 Gap을 보여줄 수 있도록" — 홈이 "패치 내용"/"미공지
// Gap" 탭 2개로 나뉘면서(ReleaseNoteStream.tsx) 두 그룹을 한 스트림에 섞어 배치할 이유가
// 사라졌다. 지금은 단순 연결 `[...matched, ...unannounced]`이고, `interleave()`가 지키던
// "미공지 최소 1건을 스트림 최상단에 승격"(HANDOFF §1-1, 패치노트 요약 사이트로 오인 방지)
// 불변식은 Gap 탭이 카운트 배지와 함께 상시 노출되는 것으로 대체된다(탭 UI가 보장, 이 모듈의
// 책임 밖). 인과 앵커(causes[].candidateNoteId 위치에 삽입)는 이전부터 **의도적으로 쓰지
// 않는다** — 시안에 없는 메커니즘이고, 실데이터에서도 앵커 보유 그룹은 소수였다.

import type { DeltaRecord, DeltasFile, PatchNoteItem } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { isGapStatus } from "./logic";
import { selectReportableObservation } from "./streamVerdict";
import { indexNoteDeltas } from "./noteDeltaIndex";
import { isCosmeticGroup } from "@/pipeline/shared/cosmetic-note";

export interface MatchedStreamGroup {
  kind: "matched";
  entity: string;
  notes: PatchNoteItem[];
}

export interface UnannouncedStreamGroup {
  kind: "unannounced";
  entity: string;
  /** `unannounced` **와** `indirect-effect` 행이 함께 들어온다(2026-09-17 B2 통합). */
  deltas: DeltaRecord[];
}

export type ReleaseStreamGroup = MatchedStreamGroup | UnannouncedStreamGroup;

/** delta===null은 "측정 불가"로 취급해 정렬 우선순위를 가장 낮춘다(ST-08 verdict.sortDeltas·
 * home/logic.ts의 absDelta와 동일 관례 — 이 파일은 독립 SubTask 파일이라 재사용 대신 동일
 * 규칙을 로컬로 둔다). */
function absDelta(record: DeltaRecord): number {
  return record.delta === null ? -Infinity : Math.abs(record.delta);
}

/** notes.json items를 entity로 묶는다 — 그룹 순서는 각 entity가 items 배열에서 처음 등장한
 * 순서(=패치노트 문서 순서)를 그대로 유지한다. */
function groupNotesByEntity(items: PatchNoteItem[]): MatchedStreamGroup[] {
  const order: string[] = [];
  const byEntity = new Map<string, PatchNoteItem[]>();
  for (const item of items) {
    const group = byEntity.get(item.entity);
    if (group) {
      group.push(item);
    } else {
      byEntity.set(item.entity, [item]);
      order.push(item.entity);
    }
  }
  return order.map((entity) => ({ kind: "matched" as const, entity, notes: byEntity.get(entity)! }));
}

/** 그룹 내 |delta| 최댓값 — 미공지 그룹 정렬 기준. */
function maxAbsDelta(records: DeltaRecord[]): number {
  return records.reduce((max, r) => Math.max(max, absDelta(r)), -Infinity);
}

/**
 * Gap 상태(`unannounced` + `indirect-effect`) 델타 행을 `entityType:entityName`으로 묶는다.
 * 파이프라인의 `status`가 이미 "짝 없음+유의"를 보장하므로(MatchStatus 주석 참고) 여기서
 * 노트와의 재매칭은 하지 않는다 — `matchedNoteIds`가 비어 있다는 전제를 그대로 신뢰한다.
 *
 * **2026-09-17(B2) 계약 변경**: 이전엔 `unannounced`만 받았고 `indirect-effect`는 홈 하단
 * 전용 섹션(`IndirectEffectPanel`)이 따로 그렸다. 사용자가 "동일한 목적으로 보이는데 다른
 * 영역에 별도로 표기되니 혼돈됨"을 지적해 한 곳으로 합쳤다 — 두 상태는 배타적이지만
 * `indirect-effect`가 `unannounced`의 부분집합(재분류 결과)이라 원래 같은 질문의 답이다.
 * 소속 판정은 `logic.isGapStatus` 한 곳만 본다(타일·배지·목록 정합).
 */
function groupUnannouncedDeltas(rows: DeltaRecord[]): UnannouncedStreamGroup[] {
  const order: string[] = [];
  const byEntity = new Map<string, DeltaRecord[]>();
  for (const row of rows) {
    if (!isGapStatus(row.status)) continue;
    const key = `${row.entityType}:${row.entityName}`;
    const group = byEntity.get(key);
    if (group) {
      group.push(row);
    } else {
      byEntity.set(key, [row]);
      order.push(key);
    }
  }
  const groups: UnannouncedStreamGroup[] = order.map((key) => {
    const deltas = byEntity.get(key)!;
    return { kind: "unannounced" as const, entity: deltas[0].entityName, deltas };
  });
  return groups.sort((a, b) => maxAbsDelta(b.deltas) - maxAbsDelta(a.deltas));
}

/**
 * 릴리즈노트 스트림 조립 — 공지(matched) 그룹은 패치노트 원본 순서, 미공지(unannounced)
 * 그룹은 |delta| 내림차순이고, 반환 배열은 `[...matched, ...unannounced]`다(2026-09-14,
 * 균등 분산 폐기 — 파일 헤더 주석 참고). `notes`/`deltas` 어느 한쪽이 없어도(`null`) throw하지
 * 않고 있는 쪽만으로 조립한다(ST-11 빈 상태 카드 관례와 동일). 소비처(ReleaseNoteStream.tsx)가
 * `group.kind`로 탭별 목록을 걸러낸다 — 이 함수는 두 그룹을 나누지 않고 이어붙이기만 한다.
 */
/** "패치 내용" 탭의 티어(2026-09-18, 채점 라운드1 ST-8 / advisor 권장 A안).
 * 0 = 노트와 반대 방향의 유의한 관측(공지-불일치) · 1 = 노트대로 관측됨 · 2 = 바닥을 넘는 관측
 * 없음 · 3 = 치장(관측 대상 아님). 관측 선택은 카드가 쓰는 것과 **같은 함수**
 * (`selectReportableObservation`)라 정렬된 자리와 카드 문구가 어긋나지 않는다. */
export type ContentTier = 0 | 1 | 2 | 3;

export function contentTier(
  group: MatchedStreamGroup,
  noteDeltas: Record<string, DeltaRecord>,
  qAlpha?: number
): ContentTier {
  if (isCosmeticGroup(group.notes)) return 3;
  const rows: DeltaRecord[] = [];
  const seen = new Set<string>();
  for (const note of group.notes) {
    const row = noteDeltas[note.id];
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      rows.push(row);
    }
  }
  const observation = selectReportableObservation(rows, qAlpha);
  if (!observation) return 2;
  return observation.status === "announced-inconsistent" ? 0 : 1;
}

/**
 * 공지(matched) 그룹을 티어 순으로 안정 정렬한다 — **티어 안에서는 패치노트 순서 그대로**.
 * 실측(2026-09-18 프로덕션): 첫 행이 "홀 오브 레전드(치장)"이고 이어 8행이 "관측 변화 없음"
 * 이었다. UX-BRIEF 01의 수용 기준 "상단 캡처가 패치노트 요약 사이트로 읽히면 실패"를 집행한다.
 * 숨기지 않는다 — 16건은 그대로 아래에 있다.
 */
export function sortMatchedGroups(
  groups: readonly MatchedStreamGroup[],
  deltas: DeltasFile | null,
  qAlpha?: number
): MatchedStreamGroup[] {
  // page.tsx와 **같은** 역색인(best-row) — 사전이 다르면 정렬된 자리와 카드 문구가 어긋난다.
  const noteDeltas = indexNoteDeltas(deltas?.rows ?? [], qAlpha);
  return groups
    .map((group, index) => ({ group, index, tier: contentTier(group, noteDeltas, qAlpha) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((entry) => entry.group);
}

export function buildReleaseStream(
  notes: NotesFile | null,
  deltas: DeltasFile | null
): ReleaseStreamGroup[] {
  const matched = groupNotesByEntity(notes?.items ?? []);
  const unannounced = groupUnannouncedDeltas(deltas?.rows ?? []);
  return [...matched, ...unannounced];
}
