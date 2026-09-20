// src/pipeline/match/tft-delta.ts
// TFT 패치 간 델타 — 두 `TftAggregate`를 받아 `DeltaRecord[]`를 낸다.
//
// **판정 엔진은 한 줄도 고치지 않는다.** 이 파일은 `stats.ts`의 통계 함수와 `verdict.ts`의
// `assignStatus`를 **호출만** 한다. 그렇게 할 수 있는 이유는 TFT 지표가 전부 LoL과 같은 모양이기
// 때문이다:
//   - `playRate`·`top4Rate` → 두 비율 차이 → `newcombeDiffInterval` + `twoProportionPValue`
//   - `avgPlacement`       → 두 평균 차이 → `meanDiffInterval` + 정규근사 p값
// 그래서 TFT는 LoL·PUBG와 **같은 표시 규칙을 상속한다** — `STATUS_SORT_PRIORITY`(정렬),
// `isReportableRecord`(표본부족·바닥 제외), `displayStatus`(회색 접기)가 전부 `DeltaRecord`만
// 보기 때문이다. 새 술어를 만들지 않는다(만드는 순간 세 게임이 갈린다).
//
// **PUBG와 달리 별도 판정 경로를 두지 않은 이유**: PUBG는 관측 축이 무기 점유율 하나뿐이라
// 자체 `classify()`가 더 단순했다. TFT는 비율 2종 + 평균 1종에 엔티티가 수십 개라 LoL과 구조가
// 같고, 그러면 엔진을 공유하는 편이 화면 규칙까지 공짜로 따라온다.
import {
  FDR_ALPHA,
  benjaminiHochberg,
  meanDiffInterval,
  newcombeDiffInterval,
  normalCdf,
  twoProportionPValue,
} from "../aggregate/stats";
import { TFT_MIN_BOARDS, type TftAggregate, type TftEntityStat } from "../aggregate/tft-boards";
import type { DeltaEntityType, DeltaMetric, DeltaRecord, Interval } from "../types";

/** 집계 산출물 위치 — 근거 링크(`DeltaEvidence.aggregatePath`)에 그대로 실린다. */
function aggPath(patch: string, bucket: string, key: string): string {
  return `data/aggregated/tft/boards-${patch}.json#${bucket}[key=${key}]`;
}

interface Draft {
  id: string;
  entityType: DeltaEntityType;
  entityKey: string;
  entityName: string;
  metric: DeltaMetric;
  before: number;
  after: number;
  delta: number;
  ci: Interval;
  n: { before: number; after: number };
  p: number;
  aggregatePath: string;
}

/** 두 평균의 차이에 대한 양측 p값 — `delta.ts`의 `meanDiffPValue`와 같은 정규근사다. */
function meanDiffP(
  meanBefore: number,
  sdBefore: number,
  nBefore: number,
  meanAfter: number,
  sdAfter: number,
  nAfter: number
): number {
  const se = Math.sqrt((sdBefore * sdBefore) / nBefore + (sdAfter * sdAfter) / nAfter);
  if (!Number.isFinite(se) || se === 0) return 1;
  const z = (meanAfter - meanBefore) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

function displayName(stat: TftEntityStat & { name?: string | null }): string {
  return stat.name ?? stat.key;
}

/** 이름이 붙은 집계 행(집계 스크립트가 카탈로그 조인으로 채운다). */
export type NamedStat = TftEntityStat & { name?: string | null };

export interface TftAggregateNamed extends Omit<TftAggregate, "units" | "traits" | "items"> {
  units: NamedStat[];
  traits: NamedStat[];
  items: NamedStat[];
}

function bucketDrafts(
  beforeRows: readonly NamedStat[],
  afterRows: readonly NamedStat[],
  beforeBoards: number,
  afterBoards: number,
  entityType: DeltaEntityType,
  bucket: string,
  afterPatch: string
): Draft[] {
  const beforeByKey = new Map(beforeRows.map((r) => [r.key, r]));
  const drafts: Draft[] = [];

  for (const after of afterRows) {
    const before = beforeByKey.get(after.key);
    if (!before) continue; // 신규 엔티티 — 이전 패치에 없던 것은 "변화"가 아니다.
    const name = displayName(after);
    const idBase = `${entityType}:${after.key}`;

    // ① 등장률 — 분모는 전체 보드 수.
    {
      const ci = newcombeDiffInterval(before.boards, beforeBoards, after.boards, afterBoards);
      drafts.push({
        id: `${idBase}:playRate`,
        entityType,
        entityKey: after.key,
        entityName: name,
        metric: "playRate",
        before: before.playRate,
        after: after.playRate,
        delta: after.playRate - before.playRate,
        ci,
        n: { before: beforeBoards, after: afterBoards },
        p: twoProportionPValue(before.boards, beforeBoards, after.boards, afterBoards),
        aggregatePath: aggPath(afterPatch, bucket, after.key),
      });
    }

    // ② 순방률 — 분모는 **그 엔티티가 등장한 보드 수**. 표본 게이트를 여기서 건다.
    if (before.boards >= TFT_MIN_BOARDS && after.boards >= TFT_MIN_BOARDS) {
      const top4Before = Math.round(before.top4Rate * before.boards);
      const top4After = Math.round(after.top4Rate * after.boards);
      drafts.push({
        id: `${idBase}:top4Rate`,
        entityType,
        entityKey: after.key,
        entityName: name,
        metric: "top4Rate",
        before: before.top4Rate,
        after: after.top4Rate,
        delta: after.top4Rate - before.top4Rate,
        ci: newcombeDiffInterval(top4Before, before.boards, top4After, after.boards),
        n: { before: before.boards, after: after.boards },
        p: twoProportionPValue(top4Before, before.boards, top4After, after.boards),
        aggregatePath: aggPath(afterPatch, bucket, after.key),
      });

      // ③ 평균 등수 — 표준편차가 있어야 p값을 낼 수 있다(집계가 함께 낸다).
      //    `!= null`이어야 한다(`!== null` 아님). **낡은 집계 JSON엔 이 필드가 아예 없어서**
      //    undefined가 들어오고, `!== null`은 그걸 통과시켜 se=NaN → ci=[null,null]·q=1로
      //    조용히 죽는다(2026-09-20 실측: avgPlacement 159건이 전부 그렇게 나갔다).
      const sdBefore = before.placementSd;
      const sdAfter = after.placementSd;
      if (typeof sdBefore === "number" && typeof sdAfter === "number") {
        drafts.push({
          id: `${idBase}:avgPlacement`,
          entityType,
          entityKey: after.key,
          entityName: name,
          metric: "avgPlacement",
          before: before.avgPlacement,
          after: after.avgPlacement,
          delta: after.avgPlacement - before.avgPlacement,
          ci: meanDiffInterval(before.avgPlacement, sdBefore, before.boards, after.avgPlacement, sdAfter, after.boards),
          n: { before: before.boards, after: after.boards },
          p: meanDiffP(before.avgPlacement, sdBefore, before.boards, after.avgPlacement, sdAfter, after.boards),
          aggregatePath: aggPath(afterPatch, bucket, after.key),
        });
      }
    }
  }
  return drafts;
}

/**
 * `status`는 항상 `"no-change"` 자리표시자로 둔다 — `verdict.assignStatus`가 짝짓기 결과와 함께
 * 최종 판정으로 덮어쓴다(LoL `delta.ts`와 같은 계약).
 */
export function buildTftDeltas(before: TftAggregateNamed, after: TftAggregateNamed): DeltaRecord[] {
  const drafts: Draft[] = [
    ...bucketDrafts(before.units, after.units, before.boards, after.boards, "unit", "units", after.patch),
    ...bucketDrafts(before.traits, after.traits, before.boards, after.boards, "trait", "traits", after.patch),
    ...bucketDrafts(before.items, after.items, before.boards, after.boards, "item", "items", after.patch),
  ];

  // BH-FDR은 **전체 델타에 한 번** 건다 — 버킷별로 따로 걸면 보정이 약해져 위양성이 는다.
  const { q } = benjaminiHochberg(
    drafts.map((d) => d.p),
    FDR_ALPHA
  );

  return drafts.map((draft, index) => ({
    id: draft.id,
    entityType: draft.entityType,
    entityKey: draft.entityKey,
    entityName: draft.entityName,
    metric: draft.metric,
    before: draft.before,
    after: draft.after,
    delta: draft.delta,
    ci: draft.ci,
    n: draft.n,
    q: q[index],
    status: "no-change",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: {
      // 원천 매치 ID 표본은 아직 붙이지 않는다 — 붙일 수 있는데 안 하는 게 아니라,
      // 보드 단위 샘플링 규칙을 정하지 않았다. 빈 배열이 곧 "근거 링크 없음"이고
      // 화면은 그것을 회색으로 읽는다(무근거 회색 원칙).
      matchIds: [],
      aggregatePath: draft.aggregatePath,
      noteAnchor: null,
    },
  }));
}
