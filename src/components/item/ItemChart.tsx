// src/components/item/ItemChart.tsx
// 항목 상세 델타 차트(ST-12 ②) — recharts BarChart + ErrorBar. `'use client'`(recharts는
// 클라이언트 전용). 색은 전부 CSS 변수 문자열(`var(--…)`)로 recharts `fill`/`stroke`에 전달 —
// hex 하드코딩 금지 원칙 준수. `ResponsiveContainer` 높이는 고정(SSR 레이아웃 시프트 방지).
//
// 편차: 프로토타입 03의 주 차트는 일별 시계열(패치 경계 세로선 포함)이지만 집계가 패치 단위라
// 일별 값이 없다 — 그래서 이 컴포넌트는 "전/후 2점 + CI 오차 막대"만 그린다(부제로 안내,
// 페이지에서 렌더).

"use client";

import { Bar, BarChart, Cell, ErrorBar, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ItemChartData } from "./chartData";
import { formatMetricValue, type MetricKind } from "./metricFormat";

export interface ItemChartProps {
  data: ItemChartData;
}

function formatChartTick(value: number, kind: MetricKind): string {
  if (kind === "pp") return `${value}%`;
  return String(value);
}

export default function ItemChart({ data }: ItemChartProps) {
  if (!data.hasData) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted">
        표시할 값이 없습니다
      </div>
    );
  }

  const rows = data.bars.map((bar) => ({ ...bar }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 28, right: 24, left: 8, bottom: 8 }}>
          <XAxis
            dataKey="label"
            stroke="var(--border)"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            // 표기를 호출부가 정한 차트(`valueText`)는 축 눈금의 단위를 모른다 — 틀린 눈금 대신 눈금을 접는다.
            hide={data.valueText !== undefined}
            stroke="var(--border)"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => formatChartTick(value, data.kind)}
          />
          <Bar dataKey="chartValue" isAnimationActive={false} maxBarSize={96}>
            {rows.map((row) => (
              <Cell key={row.key} fill={row.key === "before" ? "var(--fg-2)" : "var(--accent)"} />
            ))}
            <ErrorBar dataKey="error" stroke="var(--muted)" strokeWidth={1.5} width={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 px-2 text-center font-mono text-lg font-bold text-fg">
        {rows.map((row, index) => (
          <span key={row.key}>{data.valueText?.[index] ?? formatMetricValue(row.rawValue, data.kind)}</span>
        ))}
      </div>
      {data.errorSuppressed ? (
        <p className="px-2 pt-2 text-center text-xs text-muted">
          표본 부족으로 신뢰구간을 생략합니다
        </p>
      ) : null}
    </div>
  );
}
