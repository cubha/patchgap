// src/components/tft/TftBriefingTabs.tsx
// TFT 브리핑의 "패치 내용 / 미공지 Gap" 탭.
//
// **왜 신설하는가**(2026-09-21 사용자 지적): 같은 탭이 LoL(`ReleaseNoteStream`)과
// PUBG(`PubgBriefingTabs`)에는 있는데 TFT에만 없었다. 사용자: "「패치 내용 / 미공지 Gap」가
// tft에 없으면 tft에 추가해야하는거아니야?" — 없는 쪽에 맞추지 않고 **있는 쪽으로 통일**한다.
//
// 시맨틱(role="tablist" / role="tab" / aria-selected, `aria-controls`·role="tabpanel"은 두 선례
// 모두 쓰지 않음)과 스타일(하단 2px 보더 + accent)을 그대로 승계한다 — 게임 스위처의 전제가
// "같은 사이트, 데이터와 테마만 다름"인데 탭 생김새가 다르면 그 전제가 화면에서 깨진다.
//
// client인 이유는 선택 상태 하나뿐이다 — 패널 내용은 서버 컴포넌트가 만들어 children으로 내려준다.
"use client";

import { useState, type ReactNode } from "react";

type TftTab = "content" | "gap";

export interface TftBriefingTabsProps {
  /** 공지 대조(메인) — PUBG와 같은 이유로 기본 선택이다. */
  content: ReactNode;
  /** 미공지 Gap — 수치 축(잠수함)이 위, 지표 축(미공지)이 아래로 들어온다. */
  gap: ReactNode;
  contentCount: number;
  gapCount: number;
}

export default function TftBriefingTabs({ content, gap, contentCount, gapCount }: TftBriefingTabsProps) {
  const [tab, setTab] = useState<TftTab>("content");

  const tabs: { key: TftTab; label: string; count: number }[] = [
    { key: "content", label: "패치 내용", count: contentCount },
    { key: "gap", label: "미공지 Gap", count: gapCount },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex gap-2 border-b border-border-soft px-1" role="tablist" aria-label="브리핑 보기">
        {tabs.map(({ key, label, count }) => {
          const isActive = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(key)}
              className={`border-b-2 px-1 py-2 text-xs font-bold ${
                isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg-2"
              }`}
            >
              {label} {count}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{tab === "content" ? content : gap}</div>
    </div>
  );
}
