// src/components/BriefingTabs.tsx
// 브리핑 「패치 내용 / 미공지 Gap」 탭 — **세 게임이 같은 하나를 쓴다**(UX-BRIEF §8-1).
//
// **왜 공용인가**: 같은 탭 바가 세 벌로 구현돼 있었다 — `TftBriefingTabs` · `PubgBriefingTabs` ·
// `ReleaseNoteStream` 내부. 그중 `TftBriefingTabs`의 첫 주석은 "시맨틱과 스타일을 두 선례에서
// 그대로 승계한다"고 **스스로 복제임을 적고 있었다**. 데이터가 달라서 생긴 차이가 아니라 복제다.
// 복제된 규칙은 반드시 하나가 어긋난다(`ExternalLink`·`panelScroll`·`SOURCE_LABELS`와 같은 결함군).
//
// 패널 내용은 서버 컴포넌트가 만들어 children으로 내려준다 — client인 이유는 선택 상태 하나뿐이다.
"use client";

import { useState, type ReactNode } from "react";

export type BriefingTabKey = "content" | "gap";

/** 탭 라벨은 **여기가 소유한다**(§8-5: 미공지 어휘는 화면 전부 「미공지 Gap」). */
const TAB_LABELS: Record<BriefingTabKey, string> = {
  content: "패치 내용",
  gap: "미공지 Gap",
};

export interface BriefingTabsProps {
  /** 공지 대조(메인) — 세 게임 모두 기본 선택이다(읽는 순서: 무엇이 공지됐나 → 말 안 한 건 뭔가). */
  content: ReactNode;
  /** 미공지 Gap — 수치 축(잠수함)이 위, 지표 축이 아래. */
  gap: ReactNode;
  contentCount: number;
  gapCount: number;
}

/**
 * 탭 **바만** — 상태를 밖에서 쥐는 화면(LoL 스트림)이 쓴다. 그쪽은 탭 행이 카드 **안**에 있고
 * 그 아래가 스크롤 목록이라 구조를 통째로 바꿀 수 없다. 그래서 바꿀 수 있는 것(라벨·시맨틱·
 * 스타일)만 여기로 올리고, 못 바꾸는 것(배치)은 호출부에 남긴다.
 */
export function BriefingTabBar({
  tab,
  onSelect,
  contentCount,
  gapCount,
  className = "flex gap-2 border-b border-border-soft px-1",
}: {
  tab: BriefingTabKey;
  onSelect: (key: BriefingTabKey) => void;
  contentCount: number;
  gapCount: number;
  className?: string;
}) {
  const counts: Record<BriefingTabKey, number> = { content: contentCount, gap: gapCount };
  return (
    <div className={className} role="tablist" aria-label="브리핑 보기">
      {(Object.keys(TAB_LABELS) as BriefingTabKey[]).map((key) => {
        const isActive = key === tab;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(key)}
            className={`border-b-2 px-1 py-2 text-xs font-bold ${
              isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg-2"
            }`}
          >
            {TAB_LABELS[key]} {counts[key]}
          </button>
        );
      })}
    </div>
  );
}

/** 상태까지 갖는 기본형 — 패널 두 장을 갈아 끼우는 화면(TFT·PUBG)이 쓴다. */
export default function BriefingTabs({ content, gap, contentCount, gapCount }: BriefingTabsProps) {
  const [tab, setTab] = useState<BriefingTabKey>("content");
  return (
    <div className="flex flex-col">
      <BriefingTabBar tab={tab} onSelect={setTab} contentCount={contentCount} gapCount={gapCount} />
      <div className="pt-4">{tab === "content" ? content : gap}</div>
    </div>
  );
}
