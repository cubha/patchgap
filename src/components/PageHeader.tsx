// src/components/PageHeader.tsx
// 화면 머리 — **이동 경로 + 제목(h1) + 한 줄**. 브리핑을 제외한 모든 라우트가 이 하나를 쓴다.
//
// 실측 이탈(§8-7 #1·#8): h1이 대조표 LoL·상세 PUBG·방법론 LoL에 **없었고**, 이동 경로는 형식이
// 셋으로 갈려 있었다. 화면마다 머리를 직접 조립하는 한 또 갈린다.
//
// `eyebrow`는 게임 표식(「PUBG: BATTLEGROUNDS」)처럼 제목 위 한 줄이다. 없으면 그리지 않는다.
import type { ReactNode } from "react";

import Breadcrumb, { type Crumb } from "@/components/Breadcrumb";

export interface PageHeaderProps {
  crumbs: readonly Crumb[];
  title: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  /** 제목 오른쪽 보조(대상 유형 라벨 등). */
  titleAside?: ReactNode;
  /** 제목 아래 액션 줄(상세의 「판정 규칙 보기 →」 등). */
  actions?: ReactNode;
}

export default function PageHeader({
  crumbs,
  title,
  lead,
  eyebrow,
  titleAside,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <Breadcrumb items={crumbs} />
      {eyebrow ? (
        <p className="ambient-hero-sub font-mono text-xs font-bold tracking-wide text-accent uppercase">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="ambient-hero-headline font-display text-3xl leading-tight font-bold text-balance break-keep text-fg sm:text-4xl">
          {title}
        </h1>
        {titleAside ? (
          <span className="font-mono text-xs tracking-wider text-muted uppercase">{titleAside}</span>
        ) : null}
      </div>
      {lead ? (
        <p className="ambient-hero-sub max-w-3xl text-sm leading-relaxed text-fg-2">{lead}</p>
      ) : null}
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
