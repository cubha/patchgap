// src/components/compare/CompareSplit.tsx
// 대조표 **골격** — 좌 패치노트 내비 / 우 판정 표(UX-BRIEF §8-3). 세 게임이 이 하나를 쓴다.
//
// 높이를 여기서 고정한다: `items-start`로 두면 두 열이 각자 내용 높이가 되어 아래 끝이 어긋난다
// (2026-09-20 실측 좌 809px / 우 773px). 모바일은 단일 열 적층이라 걸지 않는다(`lg:`).
import type { ReactNode } from "react";

import { panelSurfaceClass } from "@/lib/panelSurface";
import { PANEL_SPLIT_COLUMN, PANEL_SPLIT_HEIGHT } from "@/lib/panelScroll";

export interface CompareSplitProps {
  nav: ReactNode;
  /** 우측 패널 제목 — 세 게임 공통 어휘 「선언 ↔ 관측」. */
  title: string;
  /** 제목 오른쪽 한 줄(행 수 등). */
  meta?: ReactNode;
  children: ReactNode;
  /** 표 아래 커버리지 — **뺀 것을 밝히는 자리**. 세 게임이 같은 자리에 둔다(§8-7 #16). */
  coverage?: ReactNode;
  /** 표 위 한 줄 고지(라인 필터 안내 등). */
  notice?: ReactNode;
}

export default function CompareSplit({ nav, title, meta, children, coverage, notice }: CompareSplitProps) {
  return (
    <div className={`grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] ${PANEL_SPLIT_HEIGHT}`}>
      {nav}
      <section className={`${panelSurfaceClass("glass")} ${PANEL_SPLIT_COLUMN} overflow-hidden rounded-lg`}>
        <div className="panel-head-wash flex items-center justify-between gap-4 border-b border-border-soft px-5 py-5">
          <h2 className="font-display text-lg font-bold text-fg">{title}</h2>
          {meta ? <span className="font-mono text-xs tabular-nums text-muted">{meta}</span> : null}
        </div>
        {notice ? (
          <p className="border-b border-border-soft px-5 py-2 text-xs text-muted">{notice}</p>
        ) : null}
        {children}
        {coverage}
      </section>
    </div>
  );
}
