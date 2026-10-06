// src/components/observation/ObservationTabs.tsx
// 상세 공통 관측 섹션의 **전환 부분만** — 지표 탭 × 구간 선택 상자 → 패널 하나(2026-10-06 사용자 확정,
// PLAN-detail-observation-section-2026-10-06.md D2).
//
// 패널 내용은 전부 서버가 그려서 넘긴다(`panel: ReactNode`). 여기서는 무엇을 보일지만 고른다 — 판정·표기 규칙이
// 클라이언트 번들로 새지 않고, 게임 어댑터가 무엇을 그리든 전환 규칙은 한 벌이다.
//
// **선택된 패널 하나만 렌더한다**(숨긴 형제를 `hidden`으로 두지 않는다). recharts `ResponsiveContainer`는
// 숨긴 부모 안에서 폭 0을 재고 그 크기로 굳는다 — 탭을 바꿨을 때 빈 차트가 나오는 원인이 된다.
//
// 초기 선택은 서버가 정한다(`initial`) — 구 지표 별칭 URL(`champion~X~TOP~winRate`)은 그 자체가 정적 파일이라
// 해시·쿼리를 읽을 필요가 없다. 자격 없는 조합을 가리키면 서버가 이미 기본 조합으로 떨어뜨려 넘긴다.
"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ObservationTabSegment {
  key: string;
  label: string;
  panel: ReactNode;
}

export interface ObservationTabMetric {
  key: string;
  label: string;
  segments: ObservationTabSegment[];
}

export interface ObservationTabsProps {
  metrics: ObservationTabMetric[];
  /** 구간 축의 이름(「라인」). null이면 이 대상에는 구간 축이 없다 — 선택 상자 대신 `noSegmentNote`를 쓴다. */
  segmentLabel: string | null;
  /** 구간 축이 없을 때 그 이유 한 줄(「구간 축 없음 — 보드는 위치를 갖지 않습니다」). */
  noSegmentNote?: string;
  initial: { metric: string; segment: string };
}

export default function ObservationTabs({ metrics, segmentLabel, noSegmentNote, initial }: ObservationTabsProps) {
  const baseId = useId();
  const [selection, setSelection] = useState(initial);

  const metric = metrics.find((m) => m.key === selection.metric) ?? metrics[0];
  const segment = metric.segments.find((s) => s.key === selection.segment) ?? metric.segments[0];

  /** 지표를 바꿔도 같은 구간이 그 지표에 있으면 유지한다(탑 승률 → 탑 픽률). 없으면 그 지표의 첫 구간. */
  const pickMetric = (key: string) => {
    const next = metrics.find((m) => m.key === key);
    if (!next) return;
    const keep = next.segments.some((s) => s.key === segment.key);
    setSelection({ metric: key, segment: keep ? segment.key : next.segments[0].key });
  };

  // WAI-ARIA 탭 패턴 — 좌우 화살표·Home·End로 탭 사이를 옮긴다(선택 = 이동, 자동 활성화).
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = metrics.length - 1;
    const target =
      event.key === "ArrowRight"
        ? index === last ? 0 : index + 1
        : event.key === "ArrowLeft"
          ? index === 0 ? last : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    pickMetric(metrics[target].key);
    document.getElementById(`${baseId}-tab-${metrics[target].key}`)?.focus();
  };

  const panelId = `${baseId}-panel`;
  const multiSegment = segmentLabel !== null && metric.segments.length > 1;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-5 py-3">
        <div role="tablist" aria-label="지표" className="flex flex-wrap gap-1">
          {metrics.map((m, index) => {
            const on = m.key === metric.key;
            return (
              <button
                key={m.key}
                id={`${baseId}-tab-${m.key}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={panelId}
                tabIndex={on ? 0 : -1}
                onClick={() => pickMetric(m.key)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-bold ${
                  on ? "border-border bg-bg text-fg" : "border-transparent text-muted hover:text-fg-2"
                }`}
              >
                {m.label}
                <span className="rounded-pill bg-border-soft px-1.5 font-mono text-xs font-normal text-fg-2">
                  {m.segments.length}
                </span>
              </button>
            );
          })}
        </div>
        {segmentLabel === null ? (
          noSegmentNote ? <span className="text-xs text-muted">{noSegmentNote}</span> : null
        ) : multiSegment ? (
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <span>{segmentLabel}</span>
            <select
              value={segment.key}
              onChange={(event) => setSelection({ metric: metric.key, segment: event.target.value })}
              aria-controls={panelId}
              className="min-h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg"
            >
              {metric.segments.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          // 구간 축은 있지만 이 지표는 자격 조합이 하나뿐이다 — 고를 것이 없는 선택 상자를 두지 않는다.
          <span className="text-sm text-fg-2">
            {segmentLabel} <strong className="text-fg">{segment.label}</strong>
          </span>
        )}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${metric.key}`}
        data-metric={metric.key}
        data-segment={segment.key}
      >
        {segment.panel}
      </div>
    </div>
  );
}
