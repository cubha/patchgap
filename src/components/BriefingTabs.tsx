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
import { panelSurfaceClass } from "@/lib/panelSurface";

export type BriefingTabKey = "content" | "gap";

/** 탭 라벨은 **여기가 소유한다**(§8-5: 미공지 어휘는 화면 전부 「미공지 Gap」). */
const TAB_LABELS: Record<BriefingTabKey, string> = {
  content: "패치 내용",
  gap: "미공지 Gap",
};

/**
 * 탭 순서와 기본 선택 — **발견 먼저**(2026-09-28, PR-C B1 · 사용자 결정 D4, 10/6 머지). 이 제품이 새로 말하는
 * 것은 「패치노트에 없는데 움직인 것」이다. 심사 기간(9/21~10/5)엔 출품 스크린샷을 지키려고 「공지 먼저」를
 * 유지했다. 세 게임이 이 상수 하나를 본다 — LoL 스트림도 자기 상태의 기본값을 여기서 가져간다.
 */
export const BRIEFING_TAB_ORDER: readonly BriefingTabKey[] = ["gap", "content"];
export const DEFAULT_BRIEFING_TAB: BriefingTabKey = "gap";

export interface BriefingTabsProps {
  /** 공지 대조 — 두 번째 탭(발견 먼저, `BRIEFING_TAB_ORDER`). */
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
   * (2026-09-28 PR-C B2: 이제 이 컴포넌트가 유리 카드를 소유하고 탭 바를 그 **안** 첫 줄에 둔다 —
   * LoL `ReleaseNoteStream`과 같은 구조라, 카드와 사이드가 한 행에 서면 카드 상단끼리 맞는다.)
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
      {BRIEFING_TAB_ORDER.map((key) => {
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
  const [tab, setTab] = useState<BriefingTabKey>(DEFAULT_BRIEFING_TAB);
  const panel = tab === "content" ? content : gap;
  // 탭 바는 **카드 안 맨 위**(2026-09-28, B2 · D4) — LoL 스트림과 같은 구조. 전에는 탭 바가 카드 위에 떠
  // 있어 탭 위치가 게임마다 달랐다. 패널은 `SectionCard variant="embedded"`로 들어와 카드 속 카드를 만들지 않는다.
  const card = (
    <section className={`${panelSurfaceClass("glass")} flex flex-col overflow-hidden rounded-lg`}>
      <BriefingTabBar
        tab={tab}
        onSelect={setTab}
        contentCount={contentCount}
        gapCount={gapCount}
        className="flex gap-2 border-b border-border-soft px-5 pt-4"
      />
      {panel}
    </section>
  );

  // 사이드가 없으면 단일 컬럼 — 없는 열을 만들지 않는다.
  if (!aside) return card;

  // 카드와 사이드가 같은 행에 서서 **카드 상단끼리** 맞는다(탭 바가 카드 안이라 행을 나눌 필요가 없다).
  // 모바일(lg 미만)은 DOM 순서대로 쌓인다(카드 → 사이드).
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
      {card}
      <div className="flex flex-col gap-6">{aside}</div>
    </div>
  );
}
