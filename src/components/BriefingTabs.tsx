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
  /**
   * 우측 사이드 컬럼. 주면 이 컴포넌트가 **2컬럼 골격을 직접 소유한다**(§8-1 A안).
   *
   * **왜 호출부에서 가져왔나**(2026-09-24 사용자 지적): 전에는 페이지가 그리드를 만들고
   * 좌측에 `BriefingTabs`, 우측에 사이드를 넣었다. 그러면 그리드 행의 시작점은 **탭 바**라서
   * 우측 패널 상단이 좌측 **탭 바** 상단에 맞고, 정작 사람이 비교하는 **카드끼리는 어긋난다**.
   * 탭 바가 1행, 카드와 사이드가 같은 2행에 서야 카드 상단끼리 맞는다 — 그 배치는 탭 바의
   * 위치를 아는 이 컴포넌트만 정할 수 있다. 호출부에 남기면 세 게임이 각자 틀린다.
   *
   * (LoL은 탭 바가 카드 **안**에 있어 이 문제가 없다 — `ReleaseNoteStream`. 세 게임의 탭
   * 위치를 통일하는 건 더 큰 변경이라 이번에 하지 않았고, 여기서는 **카드 상단 정렬**이라는
   * 관측 가능한 결과만 세 게임이 같게 만든다.)
   */
  aside?: ReactNode;
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
export default function BriefingTabs({
  content,
  gap,
  contentCount,
  gapCount,
  aside,
}: BriefingTabsProps) {
  const [tab, setTab] = useState<BriefingTabKey>("content");
  const panel = tab === "content" ? content : gap;
  const bar = (
    <BriefingTabBar tab={tab} onSelect={setTab} contentCount={contentCount} gapCount={gapCount} />
  );

  // 사이드가 없으면 단일 컬럼 — 없는 열을 만들지 않는다.
  if (!aside) {
    return (
      <div className="flex flex-col">
        {bar}
        <div className="pt-4">{panel}</div>
      </div>
    );
  }

  // 행을 **명시**한다: 1행 = 탭 바(좌측만) · 2행 = 카드 | 사이드. 둘 다 `pt-4`라 상단이 맞는다.
  // 행 간격을 0으로 두는 이유: 간격을 주면 그 값이 `pt-4`에 더해져 또 어긋난다.
  // 모바일(lg 미만)은 배치 지시가 걸리지 않아 DOM 순서대로 쌓인다(탭 → 카드 → 사이드).
  return (
    <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-[2fr_1fr] lg:items-start">
      <div className="lg:col-start-1 lg:row-start-1">{bar}</div>
      <div className="pt-4 lg:col-start-1 lg:row-start-2">{panel}</div>
      <div className="flex flex-col gap-6 pt-6 lg:col-start-2 lg:row-start-2 lg:pt-4">{aside}</div>
    </div>
  );
}
