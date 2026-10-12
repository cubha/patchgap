"use client";
// src/components/PanelExpand.tsx
// 높이 제한 패널의 **명시적 펼치기**(트랙 B ST-20, 2026-10-11 site-review lol-S13·pubg-S12·tft-S15).
//
// 사용자 결정(2026-10-11): 「패널 유지 + 더 보기」 — 내부 스크롤 패널은 9/11·9/20 「전체 스크롤 폭발」 지적으로 일부러 넣은 것이라
// 기본 상태는 그대로 두고, (1) 패널이 실제로 넘칠 때만 「전체 N개 펼치기」를 보여 잘려 있다는 사실을 밝히고 (2) 사람이 고르면 상한을 푼다.
// 넘침은 렌더 후 실측한다(`scrollHeight > clientHeight`) — 데이터 개수로 추측하면 칸 크기에 따라 틀린다.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";

export interface PanelExpandProps {
  children: ReactNode;
  /** 스크롤 영역 요소 — 격자는 `ul`. */
  as?: "div" | "ul";
  /** 상한 외 클래스(격자 열 등). 상한은 이 컴포넌트가 붙이고 뗀다. */
  className?: string;
  /** 전체 개수 — 버튼 문구 「전체 N개 펼치기」. */
  total: number;
  /** 세는 단위(「개」·「행」·「건」). */
  unit?: string;
}

export default function PanelExpand({ children, as = "div", className = "", total, unit = "개" }: PanelExpandProps) {
  const ref = useRef<HTMLDivElement & HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return; // jsdom·구형 브라우저 — 첫 측정만
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const Tag = as;
  return (
    <>
      <Tag ref={ref} data-panel-expand={open ? "open" : "closed"} className={`${className} ${open ? "" : PANEL_SCROLL_BODY}`}>
        {children}
      </Tag>
      {overflows || open ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full border-t border-border-soft px-5 py-2 text-left text-xs font-bold text-accent hover:underline"
        >
          {open ? "접기 ↑" : `패널 안에서 스크롤됩니다 · 전체 ${total}${unit} 펼치기 ↓`}
        </button>
      ) : null}
    </>
  );
}
