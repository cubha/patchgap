// src/components/tft/entityRows.ts
// 델타 목록 → **엔티티 행 × 지표 열**. LoL 대조표(`components/compare/entityRows.ts`)와 같은 구조다.
//
// **왜 평평한 표가 아닌가**(2026-09-20 실측으로 뒤집힌 판단): 처음엔 델타를 한 줄씩 늘어놓고
// `상태 우선순위 → |delta|`로 정렬했다. 그런데 TFT 지표는 단위가 섞여 있다 — 평균 등수는
// 0.3~0.6 규모, 비율은 0.02~0.17 규모다. 절대값으로 2차 정렬하면 **등수가 항상 이긴다**:
// 실측에서 대조표 상위 15행이 전부 「평균 등수」였고, 순방률의 큰 발견이 아래로 밀렸다.
// LoL이 같은 `|delta|` 정렬을 쓰면서도 그 문제를 안 겪는 이유는 **표 구조**에 있다 — 지표가
// 각자 열을 가지면 애초에 서로 순위를 다투지 않는다. 그래서 정렬 규칙을 바꾸는 대신
// 구조를 LoL에 맞춘다.
import { EFFECT_SIZE_FLOORS } from "@/pipeline/aggregate/stats";
import { displayStatus, DISPLAY_SORT_PRIORITY, type DisplayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import {
  buildSubmarineIndexFromChanges,
  submarineOnlyEntities,
  type SubmarineIndex,
} from "@/pipeline/gamedata/submarine";
import type { GameDataChange } from "@/pipeline/gamedata/types";
import type { DeltaEntityType, DeltaMetric, DeltaRecord } from "@/pipeline/types";

/** 열 순서 — 채택(등장) → 성과(순방·등수). LoL의 픽/밴 → 승률 순서와 같은 뜻이다. */
export const TFT_METRICS: readonly DeltaMetric[] = ["playRate", "top4Rate", "avgPlacement"];

export interface TftEntityRow {
  key: string;
  name: string;
  entityType: DeltaEntityType;
  /** 지표 → 그 엔티티의 관측. 없으면 undefined(표에서 `—`). */
  cells: Partial<Record<DeltaMetric, DeltaRecord>>;
  /** 행 배지 — 이 엔티티의 관측 중 **가장 앞선** 판정. */
  status: DisplayStatus;
  /** 정렬용 — 바닥 대비 배수의 최대값. 단위가 사라지므로 지표를 가로질러 비교할 수 있다. */
  strength: number;
  /** 근거 링크(짝지어진 노트가 있으면). */
  noteAnchor: string | null;
  /** 이 엔티티의 원본 수치 변경 중 패치노트에 없는 것. 비면 수치 축에서는 할 말이 없다. */
  submarineChanges: readonly GameDataChange[];
}

/**
 * 바닥 대비 배수 — `|delta| / floor`. 절대값을 그대로 쓰면 단위가 큰 지표가 이긴다.
 * 상대 바닥은 기저 대비로 환산해 같은 축에 올린다.
 */
export function effectStrength(record: DeltaRecord): number {
  const delta = record.delta;
  if (delta === null) return 0;
  const floor = EFFECT_SIZE_FLOORS[record.metric];
  if (floor.kind === "absolute") {
    return floor.value === 0 ? 0 : Math.abs(delta) / floor.value;
  }
  const base = record.before;
  if (base === null || base === 0) return 0;
  const relative = Math.abs(delta / base);
  return floor.value === 0 ? 0 : relative / floor.value;
}

export function buildTftEntityRows(
  rows: readonly DeltaRecord[],
  qAlpha?: number,
  /** 수치 축 색인. 지표 축 게이트를 못 넘긴 잠수함도 **행을 만든다**(2026-09-21 사용자 지시). */
  submarine?: SubmarineIndex
): TftEntityRow[] {
  const byEntity = new Map<string, TftEntityRow>();

  for (const record of rows) {
    // 보고 자격은 **공용 술어 하나**가 정한다 — 표본부족·바닥 미달·무변화는 여기서 걸린다.
    if (!isReportableRecord(record, qAlpha)) continue;

    const key = `${record.entityType}:${record.entityKey}`;
    const shown = displayStatus(record, qAlpha);
    const strength = effectStrength(record);

    const existing = byEntity.get(key);
    if (!existing) {
      byEntity.set(key, {
        key,
        name: record.entityName,
        entityType: record.entityType,
        cells: { [record.metric]: record },
        status: shown,
        strength,
        noteAnchor: record.evidence.noteAnchor,
        submarineChanges: [],
      });
      continue;
    }
    existing.cells[record.metric] = record;
    if (DISPLAY_SORT_PRIORITY[shown] < DISPLAY_SORT_PRIORITY[existing.status]) existing.status = shown;
    if (strength > existing.strength) existing.strength = strength;
    existing.noteAnchor ??= record.evidence.noteAnchor;
  }

  // 수치 축을 얹는다. 지표 축 게이트(표본 부족·바닥 미달·무변화)는 **지표 축에만** 건다 —
  // 패치노트에 없는 수치 변경은 지표가 안 움직여도 발견이다(2026-09-21 사용자 지시).
  // 실측: TFT 18.1→18.2 잠수함 37건 중 26건이 델타 행을 갖지 않는다.
  if (submarine) {
    for (const row of byEntity.values()) {
      const changes = submarine.changesOf(row.entityType, row.key.split(":")[1] ?? "");
      if (changes.length === 0) continue;
      row.submarineChanges = changes;
      row.status = "submarine";
    }
    for (const entity of submarineOnlyEntities(submarine, new Set(byEntity.keys()))) {
      const key = `${entity.entityType}:${entity.entityKey}`;
      byEntity.set(key, {
        key,
        name: entity.entityName,
        entityType: entity.entityType as TftEntityRow["entityType"],
        cells: {},
        status: "submarine",
        strength: 0,
        noteAnchor: null,
        submarineChanges: entity.changes,
      });
    }
  }

  return [...byEntity.values()].sort(
    (a, z) =>
      DISPLAY_SORT_PRIORITY[a.status] - DISPLAY_SORT_PRIORITY[z.status] ||
      z.strength - a.strength ||
      a.name.localeCompare(z.name)
  );
}

/**
 * 대조표·상세·경로 생성이 **같은 행 집합**을 보게 하는 단일 진입점.
 *
 * 왜 따로 만드는가(2026-09-21 실측 결함): 대조표는 `buildTftEntityRows(rows, qAlpha, submarine)`로
 * 잠수함 전용 행까지 만들어 이름에 링크를 걸었는데, `generateStaticParams`는 같은 함수를
 * **submarine 인자 없이** 불렀다. 링크는 있고 경로는 없다 — `output:'export'`에서 곧 404다
 * (실측: `unit~DA_18_ElderDragon`·`item~DA_18_BackrowStar`·`unit~DA_18_Sentry` 전부 404,
 * TFT 21건). 호출부가 셋(`generateStaticParams`·`generateMetadata`·`TftUnitPage`)이라
 * 인자를 하나씩 채우는 수정은 다음에 또 갈라진다 — **인자를 못 빠뜨리는 형태**로 바꾼다.
 *
 * 순수 함수다(파일 I/O 없음) — 로더는 호출부가 소유하고, 여기는 조립만 한다.
 */
export function tftEntityRows(
  deltas: { readonly rows: readonly DeltaRecord[]; readonly meta: { readonly qAlpha?: number } },
  changes: readonly GameDataChange[]
): TftEntityRow[] {
  return buildTftEntityRows(deltas.rows, deltas.meta.qAlpha, buildSubmarineIndexFromChanges(changes));
}
