// src/components/methodology/StatusDefinitionTable.tsx
// 방법론 "상태 정의" 표(ST-12 ②) — 2026-09-18 라운드6(사용자 C5·C1)에 **화면이 쓰는 어휘 기준**으로
// 다시 썼다. 화면 배지·칩은 표시 키 3종(공지 / 공지 · 이상 관측 / 미공지)뿐이고, 판정 엔진의 세부 상태
// (`MatchStatus` 7종)는 이 표의 "판정 조건" 열이 설명한다. 표시하지 않는 관측 3종(바닥 미달·표본 부족·
// 변화 없음)은 별도 구획 — 판정 파일에는 있으나 홈·대조표·상세에 올리지 않는다.
// 임계값은 EFFECT_SIZE_FLOORS 전수를 주입받아 표시한다 — 화면이 코드보다 오래된 숫자를 말하는 드리프트를
// 구조적으로 차단한다. 뱃지는 공용 StatusBadge를 재사용해 색 문법이 한 곳에서만 정의되도록 한다.

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
  /** 효과크기 바닥 전수 — 호출부가 `EFFECT_SIZE_FLOORS`를 통째로 주입한다(낱개 prop은 누락 시 옛 값을 말한다). */
  floors: Record<DeltaMetric, EffectFloor>;
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

/** 절대 바닥을 사람이 읽는 단위로 — 비율 지표는 %p, 시간 지표는 초. */
function abs(value: number, unit: "pp" | "sec"): string {
  return unit === "pp" ? `${pct(value)}p` : `${value}초`;
}

function floorCaption(floors: Record<DeltaMetric, EffectFloor>): string {
  return `픽 ${abs(floors.pickRate.value, "pp")} / 밴 ${abs(floors.banRate.value, "pp")} / 승 ${abs(
    floors.winRate.value,
    "pp"
  )} · 채택률 상대 ${pct(floors.adoptionRate.value)} 또는 채택률 ${pct(floors.adoptionRate.minBase ?? 0)} 미만 · 라인 골드 상대 ${pct(
    floors.goldAt14.value
  )} · 오브젝트 ${abs(floors.firstSec.value, "sec")} · 경기 시간 ${abs(floors.avgDurationSec.value, "sec")}`;
}

function buildShownRows(alpha: number): DefinitionRow[] {
  return [
    {
      status: "announced",
      definition: "패치노트가 말한 항목의 관측. 방향 일치·비유의·바닥 미달을 따로 가르지 않는다",
      condition: `짝 존재 · 아래 이상 관측이 아닌 전부`,
    },
    {
      status: "announced-anomaly",
      definition: "패치노트가 말한 방향과 반대로 유의하게 움직였고 규모도 바닥을 넘음(공지는 상향인데 실측은 하락)",
      condition: `짝 존재 · 방향 반대 · q<${alpha} · CI가 0 미포함 · 효과크기 바닥 이상`,
    },
    {
      status: "unannounced",
      definition: "패치노트에 대응 조항이 없는 유의 변화. 다른 조항의 파급으로 설명되는 것도 여기 포함(원인이 규명됐는가만 다르다)",
      condition: `짝 없음 · q<${alpha} · CI가 0 미포함 · 효과크기 바닥 이상 (원인 후보가 신뢰도 보통 이상으로 검증되면 파급으로 재분류 — 표시는 같다)`,
    },
  ];
}

function buildHiddenRows(minN: number, alpha: number, floors: Record<DeltaMetric, EffectFloor>): DefinitionRow[] {
  return [
    {
      status: "below-threshold",
      definition: "통계적으로는 유의하나 규모가 효과크기 바닥 미만. 라인 골드·오브젝트 시각·경기 시간은 패치노트에 대응 항목이 없는 집계 지표라 바닥이 특히 높다",
      condition: `q<${alpha} · |Δ|<바닥(${floorCaption(floors)})`,
    },
    {
      status: "insufficient-sample",
      definition: `최소 표본(n≥${minN}) 미달 — 승률 델타를 제시하지 않는다`,
      condition: `n<${minN}`,
    },
    {
      status: "no-change",
      definition: "짝도 없고 통계적으로도 유의한 변화가 없음",
      condition: `짝 없음 · q≥${alpha} 또는 CI가 0 포함`,
    },
  ];
}

function Rows({ rows }: { rows: DefinitionRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.status}>
          <td className="border-b border-border-soft px-5 py-4 align-top">
            <StatusBadge status={row.status} />
          </td>
          <td className="border-b border-border-soft px-5 py-4 align-top text-fg-2">{row.definition}</td>
          <td className="border-b border-border-soft px-5 py-4 align-top text-muted">{row.condition}</td>
        </tr>
      ))}
    </>
  );
}

export default function StatusDefinitionTable({ minN, alpha, floors }: StatusDefinitionTableProps) {
  const shown = buildShownRows(alpha);
  const hidden = buildHiddenRows(minN, alpha, floors);
  const head = "border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={head}>상태</th>
            <th className={head}>정의</th>
            <th className={head}>판정 조건</th>
          </tr>
        </thead>
        <tbody>
          <Rows rows={shown} />
          <tr>
            <th colSpan={3} className="border-b border-border-soft bg-surface-warm/40 px-5 py-2 text-left text-xs font-bold text-muted">
              표시하지 않는 관측 — 판정 파일에는 남고 홈·대조표·상세에는 올리지 않는다
            </th>
          </tr>
          <Rows rows={hidden} />
        </tbody>
      </table>
      {/* 표시 게이트 고지(S7) — 홈 카드·대조표 셀·내비 배지는 위 판정에 더해 유의성·효과크기 바닥을 한 번 더
          통과한 행만 쓴다. 그 규칙이 화면 어디에도 없으면 상세("공지")와 홈("유의한 관측 없음")이 서로를 반박하는
          것처럼 읽힌다. */}
      <p className="border-t border-border-soft px-5 py-4 text-xs leading-relaxed text-muted">
        홈 카드·대조표 셀·내비 배지는 위 판정에 더해 <strong className="text-fg-2">유의성(q&lt;α)과 효과크기 바닥</strong>을 한 번
        더 통과한 행만 씁니다 — 그래서 &ldquo;공지&rdquo;로 판정된 항목도 홈에서는 &ldquo;유의한 관측 없음&rdquo;으로 보일 수
        있습니다. 유의성과 규모는 서로 다른 질문이고, 이 사이트는 둘을 따로 묻습니다.
      </p>
    </div>
  );
}
