// src/components/pubg/PubgBriefingTabs.tsx
// PUBG 브리핑의 "패치 내용 / 미공지 Gap" 탭 — 사용자 지시(2026-09-17): "배틀그라운드의 gap
// 표시원칙을 리그오브레전드와 동일하게 변경 / 1. 패치내용을 메인으로 우선 표시 / 2. 미공지
// gap을 추가탭으로 전환하여 표시".
//
// **왜 새 탭 패턴을 만들지 않는가**: 이 사이트엔 이미 같은 탭이 두 곳 있다 —
// `/compare/`의 `NoteNavigator.tsx`와 홈의 `ReleaseNoteStream.tsx`. 시맨틱(role="tablist" /
// role="tab" / aria-selected, `aria-controls`·role="tabpanel"은 두 선례 모두 쓰지 않음)과
// 스타일(하단 2px 보더 + accent)을 그대로 승계한다. 게임 스위처의 전제가 "같은 사이트, 데이터와
// 테마만 다름"인데 탭 생김새가 다르면 그 전제가 화면에서 깨진다.
//
// 이 파일이 client인 이유는 선택 상태 하나뿐이다 — 패널 내용은 서버 컴포넌트가 만들어
// children으로 내려준다(홈의 서버-로드/클라이언트-필터 분리와 같은 경계).
"use client";

import { useState, type ReactNode } from "react";

type PubgTab = "content" | "gap";

export interface PubgBriefingTabsProps {
  /** 공지 대조(메인) — 먼저 보여야 하는 쪽. */
  content: ReactNode;
  /** 미공지 Gap. */
  gap: ReactNode;
  contentCount: number;
  gapCount: number;
}

export default function PubgBriefingTabs({
  content,
  gap,
  contentCount,
  gapCount,
}: PubgBriefingTabsProps) {
  // 기본값이 "content"인 것이 요구 1번("패치내용을 메인으로 우선 표시")의 실체다.
  const [tab, setTab] = useState<PubgTab>("content");

  const tabs: { key: PubgTab; label: string; count: number }[] = [
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
