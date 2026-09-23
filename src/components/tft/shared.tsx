// src/components/tft/shared.tsx
// TFT 화면 공용 조각. PUBG `shared.tsx`와 같은 자리이되, **표시 규칙은 LoL 쪽을 쓴다** —
// TFT는 `DeltaRecord`를 그대로 내므로 `isReportableRecord`·`displayStatus`·
// `STATUS_SORT_PRIORITY`가 전부 그냥 걸린다. TFT 전용 술어를 만들지 않는다.
import type { ReactNode } from "react";

import SiteFooter from "@/components/SiteFooter";
import { metricLabel, isLowerBetter } from "@/lib/format";
import type { DeltaMetric } from "@/pipeline/types";

/** 0.5231 → "52.3%". */
export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** +0.0231 → "+2.3%p". */
export function signedPct(value: number, digits = 1): string {
  const p = value * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(digits)}%p`;
}

/** 4.352 → "4.35등". */
export function placement(value: number): string {
  return `${value.toFixed(2)}등`;
}

/** 지표에 맞는 값 표기 — 평균 등수만 단위가 다르다. */
export function formatMetricValue(metric: DeltaMetric, value: number): string {
  return metric === "avgPlacement" ? placement(value) : pct(value);
}

/**
 * 지표에 맞는 변화량 표기 + **개선 방향**.
 * 평균 등수는 작아져야 개선이므로 `improved`가 뒤집힌다 — 이걸 안 뒤집으면 하향 패치가
 * 초록으로 칠해진다(`isLowerBetter`가 그 사실의 단일 소스다).
 */
export function deltaDisplay(metric: DeltaMetric, delta: number): { text: string; improved: boolean } {
  const improved = isLowerBetter(metric) ? delta < 0 : delta > 0;
  const text = metric === "avgPlacement" ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}등` : signedPct(delta);
  return { text, improved };
}

export function TftPageHeader({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">{title}</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-fg-2">{lead}</p>
    </header>
  );
}

/** 표본 범위 한 줄 — 헤더 칩·방법론과 **같은 어휘**를 쓴다(화면끼리 다른 말을 하지 않게). */
export function TftSampleNotice({ boards, matches }: { boards: number; matches: number }) {
  return (
    <p className="text-xs leading-relaxed text-muted">
      표본은 KR 챌린저~마스터 랭크(큐 1100) <strong className="text-fg-2">{matches.toLocaleString()}</strong>매치 ={" "}
      <strong className="text-fg-2">{boards.toLocaleString()}</strong>보드입니다. 등장률의 분모는 매치가 아니라{" "}
      <strong className="text-fg-2">보드(참가자)</strong>입니다 — 한 판에 8명이 각자 보드를 들고, 한 보드에 여러 유닛이
      동시에 서므로 제로섬이 아닙니다.
    </p>
  );
}

export function TftMetricCaption({ metric }: { metric: DeltaMetric }) {
  return (
    <span className="font-mono text-xs text-muted">
      {metricLabel(metric)}
      {isLowerBetter(metric) ? " (작을수록 개선)" : ""}
    </span>
  );
}

export function TftUnavailable() {
  return (
    <div className="flex flex-col gap-3 pt-40 pb-8">
      <h1 className="font-display text-3xl font-bold text-fg">전략적 팀 전투 — 아직 연결되지 않았습니다</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-fg-2">
        TFT 집계 산출물(<span className="font-mono">data/aggregated/tft/</span>)이 없습니다. 수집·집계·판정 파이프라인을
        돌리면 이 화면이 채워집니다. 지어낸 값으로 채우지 않습니다.
      </p>
    </div>
  );
}

/**
 * 푸터는 **`SiteFooter`가 소유한다**(UX-BRIEF §8-1). 이 이름은 호출부 10곳을 지키기 위한
 * 얇은 위임일 뿐이고, 문구·시각 포맷·고지를 여기서 다시 쓰지 않는다 — 전에는 여기서 직접
 * 썼고 그래서 **반말 + ISO 원문 시각**이 TFT 화면에만 나갔다(2026-09-22 실측).
 */
export function TftFooter({ generatedAt, nVerdicts }: { generatedAt: string; nVerdicts: number }) {
  return <SiteFooter game="tft" generatedAt={generatedAt} nVerdicts={nVerdicts} />;
}
