"use client";
// src/components/compare/SplitExpand.tsx
// 대조표 분할의 「표 전체 펼치기」(트랙 B ST-20, lol-S13 — 사용자 결정 「패널 유지 + 더 보기」). 래퍼에 `data-expanded`를 세우면
// 행 높이(`PANEL_SPLIT_HEIGHT_EXPANDED`)와 두 패널 본문 상한(`PANEL_SPLIT_BODY`의 group 변형)이 함께 풀린다.
import { useState, type ReactNode } from "react";

export default function SplitExpand({ className, total, children }: { className: string; total: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div data-expanded={open} className={className}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="self-end text-xs font-bold text-accent hover:underline"
      >
        {open ? "표 접기 ↑" : `표는 패널 안에서 스크롤됩니다 · ${total}개 대상 전체 펼치기 ↓`}
      </button>
    </div>
  );
}
