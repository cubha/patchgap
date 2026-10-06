// src/components/observation/ObservationPanel.tsx
// 관측 섹션의 **패널 하나** = 지표 하나 × 구간 하나(2026-10-06 사용자 확정, PLAN D2·D4·D5).
//
// 배치는 시안 그대로: 상태 줄(뱃지 · 전 → 후 · Δ · 구간) → [막대 | 통계 게이트 · 원천] → 추정 원인(이 지표·구간).
// **배치는 이 파일이 소유하고 값은 게임이 정한다** — 게이트 행의 이름(BH-FDR q · 로그비 CI · 바닥 대비…)·
// 방법론 링크·원천 표기는 게임마다 다르므로 각 상세가 `gate`·`source`로 넘긴다. 전에는 LoL `StatsGatePanel`이
// 「BH-FDR q」와 `/lol/methodology/`를 박아 두고 있어, 그대로 공유하면 PUBG가 쓰지 않는 검정을 주장하게 된다
// (#74에서 지운 바로 그 과장).
//
// 추정 원인이 **패널 안**에 있는 이유(D4): 원인은 지표·구간마다 따로 물었다(LLM 2단은 델타 단위). 대상 단위 카드에
// 모아 두면 탑 승률의 이유가 전체 픽률의 이유처럼 읽힌다.
import type { ReactNode } from "react";

export interface ObservationGateRow {
  label: string;
  value: string;
}

export interface ObservationPanelProps {
  /** 판정 뱃지. 기술통계 모드는 `NoVerdictBadge`. */
  badge: ReactNode;
  before: string;
  after: string;
  /** 변화량 표기(색·화살표 포함). 기술통계 모드는 중립색. */
  delta: ReactNode;
  /** 구간 이름(「탑」). 구간 축이 없는 대상은 생략. */
  segmentName?: string;
  /** 전/후 막대 — 네 상세가 같은 `ItemChart`를 쓴다. */
  chart: ReactNode;
  /** 막대 아래 한 줄(「95% CI …」 · 「산출하지 않음」). */
  chartCaption: string;
  gate: ObservationGateRow[];
  /** 「판정 규칙 보기 →」 — 그 게임 방법론의 게이트 슬롯. */
  gateLink: { href: string; label: string };
  /** 원천(매치·집계 경로). 판정이 없는 축은 null — 칸을 그리지 않는다. */
  source: ReactNode | null;
  /** 판정을 사람 말로 푼 문장들(PUBG — 2026-09-19 사용자 지시 「자연어로 근거」). 게이트 위에 선다. */
  prose?: readonly string[];
  /** 이 지표·구간의 추정 원인 본문. */
  causes: ReactNode;
}

/** 판정을 만들지 않는 축의 뱃지 — 상태 어휘(공지·미공지…)를 빌리지 않는다. */
export function NoVerdictBadge() {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-sm border border-border-soft px-2 py-1 font-mono text-xs font-bold text-muted">
      <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden="true" />
      판정 없음
    </span>
  );
}

export default function ObservationPanel({
  badge,
  before,
  after,
  delta,
  segmentName,
  chart,
  chartCaption,
  gate,
  gateLink,
  source,
  prose,
  causes,
}: ObservationPanelProps) {
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {badge}
        <span className="font-mono text-sm tabular-nums text-fg">
          {before} → {after}
        </span>
        {delta}
        {segmentName ? <span className="text-xs text-muted">· {segmentName}</span> : null}
      </div>

      {prose && prose.length > 0 ? (
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
          {prose.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="min-w-0 rounded-md border border-border-soft bg-bg/40 p-3">
          {chart}
          {/* 한 줄로 자른다 — 캡션이 길어지면 막대 상자 전체가 늘어 옆 칸과 높이가 갈린다(2026-10-07 레이아웃 게이트
              D-STRESS-02, 네 상세 공통). 전문은 title로 남긴다. */}
          <p className="truncate px-2 pt-2 font-mono text-xs text-muted" title={chartCaption}>
            {chartCaption}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-bold text-muted">통계 게이트</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {gate.map((row) => (
                <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="font-mono text-sm tabular-nums text-fg">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {source ? (
            <div className="flex h-44 min-w-0 flex-col rounded-md border border-border-soft">
              <p className="px-4 pt-3 text-xs font-bold text-muted">원천 매치</p>
              {source}
            </div>
          ) : null}
          <a href={gateLink.href} className="w-fit text-sm font-bold text-accent hover:underline">
            {gateLink.label}
          </a>
        </div>
      </div>

      <div className="flex flex-col border-t border-border-soft pt-4">
        <p className="text-sm font-bold text-fg">추정 원인(LLM) — 이 지표·구간</p>
        {causes}
      </div>
    </div>
  );
}
