// src/components/methodology/StatusDefinitionTable.tsx
// 방법론 페이지 "상태 정의" 표(ST-12 ②) — 프로토타입 04 `.definition-table` 5행 + "임계 미달"
// (below-threshold) + "간접 영향"(indirect-effect) 2행 = 7행(둘 다 2026-09-13 신규).
// 임계값은 EFFECT_SIZE_FLOORS 전수를 주입받아 표시한다 — 화면이 코드보다 오래된 숫자를 말하는
// 드리프트를 구조적으로 차단한다(props 주석 참고).
// 뱃지는 공용 StatusBadge를 재사용해 색 문법이 한 곳(StatusBadge)에서만 정의되도록 한다.

import StatusBadge from "@/components/StatusBadge";
import type { EffectFloor } from "@/pipeline/aggregate/stats";
import type { DeltaMetric } from "@/pipeline/types";
import type { DisplayStatus } from "@/pipeline/shared/display-status";

interface DefinitionRow {
  status: DisplayStatus;
  definition: string;
  condition: string;
}

export interface StatusDefinitionTableProps {
  minN: number;
  alpha: number;
  /**
   * 효과크기 바닥 전수 — 호출부(methodology/page.tsx)가 `aggregate/stats.ts`의
   * `EFFECT_SIZE_FLOORS`를 **통째로** 주입한다. 지표별 숫자를 낱개 prop으로 받던 방식은
   * 바닥이 늘어날 때마다 prop을 추가해야 했고(연속 지표 4종 추가·기저 게이트 도입,
   * 2026-09-13 2차), 빠뜨려도 화면이 조용히 옛 값을 말하게 된다 — 전수 Record를 받으면
   * 그 드리프트 경로 자체가 없어진다.
   */
  floors: Record<DeltaMetric, EffectFloor>;
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

/** 절대 바닥을 사람이 읽는 단위로 — 비율 지표는 %p, 시간 지표는 초. */
function abs(value: number, unit: "pp" | "sec"): string {
  return unit === "pp" ? `${pct(value)}p` : `${value}초`;
}

function buildRows(minN: number, alpha: number, floors: Record<DeltaMetric, EffectFloor>): DefinitionRow[] {
  return [
    {
      status: "announced-consistent",
      definition: "패치노트 선언과 관측 델타의 방향이 일치",
      condition: `짝 존재 · 방향 일치 · q<${alpha}`,
    },
    {
      status: "announced-inconsistent",
      definition: "패치노트 선언과 반대 방향의 유의한 변화가 관측됨",
      condition: `짝 존재 · 방향 반대 · q<${alpha}`,
    },
    {
      // 표시 전용 키(2026-09-18 ST-4) — 판정 엔진에서는 위 행과 같은 상태값이다. 화면에서만
      // "노트가 틀렸다"와 "노트대로인지 아직 모른다"를 갈라 보여준다.
      status: "announced-unobserved",
      definition: "패치노트는 변경을 말했지만 통계에서 유의한 변화가 관측되지 않음",
      condition: `짝 존재 · q≥${alpha} 또는 CI가 0 포함`,
    },
    {
      status: "unannounced",
      definition: "패치노트에 대응하는 조항이 없고, 추정 원인도 찾지 못한 유의 변화",
      condition: `짝 없음 · q<${alpha} · 효과크기 바닥 이상 · 검증된 원인 후보 없음`,
    },
    {
      status: "indirect-effect",
      definition: "직접 조항은 없지만 다른 조항의 파급효과로 설명되는 변화(예: 챔피언 노트는 없는데 그 챔피언이 올리는 아이템이 변경됨)",
      condition: "짝 없음 · 검증된 원인 후보 confidence≥medium",
    },
    {
      status: "below-threshold",
      definition:
        "통계적으로는 유의하나 실무상 무시 가능한 규모(효과크기 바닥 미달). 라인 골드·오브젝트 시각·평균 경기 시간은 패치노트에 대응 항목이 존재할 수 없는 집계 지표라 바닥이 특히 높다",
      condition: `짝 없음 · q<${alpha} · |Δ|<바닥(픽 ${abs(floors.pickRate.value, "pp")}/밴 ${abs(
        floors.banRate.value,
        "pp"
      )}/승 ${abs(floors.winRate.value, "pp")} · 채택률 상대 ${pct(
        floors.adoptionRate.value
      )} 또는 채택률 ${pct(floors.adoptionRate.minBase ?? 0)} 미만 · 라인 골드 상대 ${pct(
        floors.goldAt14.value
      )} · 오브젝트 ${abs(floors.firstSec.value, "sec")} · 경기 시간 ${abs(
        floors.avgDurationSec.value,
        "sec"
      )})`,
    },
    {
      status: "insufficient-sample",
      definition: `최소 표본(n≥${minN}) 미달로 승률 등 델타를 제시하지 않음`,
      condition: `n<${minN}`,
    },
    {
      status: "no-change",
      definition: "짝도 없고 통계적으로도 유의한 변화가 없음",
      condition: `짝 없음 · q≥${alpha} 또는 CI가 0 포함`,
    },
  ];
}

export default function StatusDefinitionTable({ minN, alpha, floors }: StatusDefinitionTableProps) {
  const rows = buildRows(minN, alpha, floors);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted">
              상태
            </th>
            <th className="border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted">
              정의
            </th>
            <th className="border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted">
              판정 조건
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.status}>
              <td className="border-b border-border-soft px-5 py-4 align-top">
                <StatusBadge status={row.status} />
              </td>
              <td className="border-b border-border-soft px-5 py-4 align-top text-fg-2">
                {row.definition}
              </td>
              <td className="border-b border-border-soft px-5 py-4 align-top text-muted">
                {row.condition}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
