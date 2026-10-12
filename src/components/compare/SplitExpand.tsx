"use client";
// src/components/compare/SplitExpand.tsx
// 대조표 분할의 「표 전체 펼치기」(트랙 B ST-20, lol-S13 — 사용자 결정 「패널 유지 + 더 보기」). 래퍼에 `data-expanded`를 세우면
// 행 높이(`PANEL_SPLIT_HEIGHT_EXPANDED`)와 두 패널 본문 상한(`PANEL_SPLIT_BODY`의 group 변형)이 함께 풀린다.
// 버튼은 **패널이 실제로 넘칠 때만**(`PanelExpand`와 같은 규약, scope-critic ST-20) — 안 넘치는 표에 「스크롤됩니다」라고 말하지 않는다.
// 본문 후보는 `PANEL_SPLIT_BODY`를 쓰는 스크롤 영역이다(그 상수가 `overflow-auto`를 든다).
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function SplitExpand({ className, total, children }: { className: string; total: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const bodies = Array.from(root.querySelectorAll<HTMLElement>(".overflow-auto, .overflow-y-auto"));
      setOverflows(bodies.some((el) => el.scrollHeight > el.clientHeight + 1));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div ref={ref} data-expanded={open} className={className}>
        {children}
      </div>
      {overflows || open ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="self-end text-xs font-bold text-accent hover:underline"
        >
          {open ? "표 접기 ↑" : `표는 패널 안에서 스크롤됩니다 · ${total}개 대상 전체 펼치기 ↓`}
        </button>
      ) : null}
    </div>
  );
}
