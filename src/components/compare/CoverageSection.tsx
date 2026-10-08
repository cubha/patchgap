// src/components/compare/CoverageSection.tsx
// 대조표 하단 커버리지 — **세 게임이 같은 블록**(ST-18, 2026-10-08 site-review lol-S9·parity-S14·pubg-S2).
//
// 브리핑은 세 게임 모두 "대조표 아래 커버리지"를 가리키는데, 실제로는 TFT만 제목 있는 카드, LoL은 표 바닥 한 줄(`CoverageBar`),
// PUBG는 없었다. 말하는 것은 **노트 대상 대비 표가 다룬 범위**뿐이다 — 숨김 상태(변화 없음·바닥 미달·표본 부족)의 건수·사유는
// 말하지 않는다(2026-10-07 사용자 결정, #78 — 그 규칙은 방법론이 말한다). 게임이 더 밝힐 것(TFT 해소율, PUBG 측정 불가 축)은
// `extra`로 **아래에** 붙인다.
import type { ReactNode } from "react";

import { fmtInt } from "@/lib/format";

export interface CoverageSectionProps {
  /** 노트가 말한 **대상** 수. */
  noteEntities: number;
  /** 노트 **항목(줄)** 수. */
  noteItems: number;
  /** 노트 대상 중 보고 자격 관측과 짝지어진 대상 수. */
  matched: number;
  /** 미공지 대상 수(수치 축 포함 여부는 게임이 정한다 — 타일과 같은 수를 넘긴다). */
  gap: number;
  /** 게임 고유 보충(해소율·측정 불가 축). 없으면 그리지 않는다. */
  extra?: ReactNode;
}

export default function CoverageSection({ noteEntities, noteItems, matched, gap, extra }: CoverageSectionProps) {
  return (
    <section className="rounded-lg border border-border-soft bg-surface p-5" data-coverage="">
      <h2 className="font-body text-xs font-bold text-muted">표가 다룬 범위</h2>
      <p className="mt-3 text-sm text-muted">
        노트 <strong className="font-bold text-fg">{fmtInt(noteEntities)}</strong>대상(
        <strong className="font-bold text-fg">{fmtInt(noteItems)}</strong>항목) 중 관측 짝{" "}
        <strong className="font-bold text-fg">{fmtInt(matched)}</strong> · 미공지{" "}
        <strong className="font-bold text-fg">{fmtInt(gap)}</strong>
      </p>
      {extra ? <div className="mt-3 text-xs leading-relaxed text-muted">{extra}</div> : null}
    </section>
  );
}
