// src/components/SectionCard.tsx
// 패널 카드 헤더 패턴 — 프로토타입 `.panel`/`.panel-head`/`.panel-body` 1:1
// (docs/design/prototype/01-briefing-home.html `.panel-head` 참고). 우선순위 라벨(eyebrow)
// · 제목 · 우측 액션(뱃지·링크·버튼 등)을 헤더 한 줄에 배치한다.
//
// 표면은 2026-09-12(3차)부터 `.panel-surface`(src/styles/panel.css) — 골드 4변 프레임
// (border-border 전체 + elev-ring)을 걷어내고 상단 2px 골드 레일 + 깊이 그라디언트 채움으로
// 교체했다(방향 제안 아티팩트 Q2 "A+B 결합"). 시안 v5의 패널은 애초에 `border-soft` + 평면
// `--surface`였다 — 골드 4변 프레임은 시안에 없던 것이었다. 본문 대비는 무영향(채움은 완전
// 불투명 그라디언트, 알파 변경 없음 — DESIGN-TOKENS.md 불변식 참고).
//
// variant="glass"(2026-09-12·5차, R6 — bg-visibility-proposal.html "옵션 B"): 카메라 노출
// 밴드(y<873px) 안에 들어오는 패널만 이 값을 받는다(현재는 SideMatchAverages 1곳). Container의
// `width` prop과 같은 선례를 따라 새 컴포넌트를 만들지 않고 prop으로 분기한다.
//
// 표면 클래스 조합(2026-09-12·6차): "panel-surface panel-surface-glass" 리터럴을 여기서
// 직접 조립하지 않고 panelSurfaceClass()(src/lib/panelSurface.ts)로 옮겼다 — SectionCard를
// 쓰지 않는 다른 패널(NoteNavigator·CompareExplorer·HeroSummary·ReleaseNoteStream)도 같은
// 함수를 호출해 리터럴 오타·누락 여지를 없앤다.

import type { ReactNode } from "react";
import { panelSurfaceClass } from "@/lib/panelSurface";

export interface SectionCardProps {
  eyebrow?: string;
  title: string;
  /** 제목 아래 한 줄 설명(2026-09-29) — 본문 첫 줄에 따로 두면 제목과 떨어져 빈 띠가 하나 더 생긴다. */
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * `embedded`(2026-09-28, B2) — 표면·테두리·둥근 모서리 없이 머리와 본문만. 이미 카드인 곳(탭 카드) 안에
   * 들어가는 패널용이다 — 카드 속 카드를 만들지 않는다(LoL 스트림과 같은 구조).
   */
  variant?: "opaque" | "glass" | "embedded";
}

export default function SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
  variant = "opaque",
}: SectionCardProps) {
  const shell = variant === "embedded" ? "" : `${panelSurfaceClass(variant)} overflow-hidden rounded-lg`;
  return (
    <section className={`${shell} ${className}`.trim()}>
      <div className="panel-head-wash flex items-center justify-between gap-4 border-b border-border-soft px-5 py-5">
        <div>
          {eyebrow ? (
            <span className="block text-xs font-bold text-muted">{eyebrow}</span>
          ) : null}
          <h2 className="font-display text-lg font-bold text-fg">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
