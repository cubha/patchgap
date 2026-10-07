// src/components/home/StreamColumnLayout.tsx
// 홈 2컬럼 레이아웃 — 우측 컬럼(매치 평균·라인별 괴리·디스코드)의 렌더 높이를 기준으로 좌측
// 컬럼(릴리즈노트 스트림 본문)도 같은 높이로 고정하고, 좌측 내부만 스크롤되게 한다.
// 이전에는 좌측 스트림이 선택 라인의 미공지 엔티티 전건을 렌더해(개수 제한은 의도된 설계 —
// releaseStream.ts) 페이지 전체가 과도하게 길어졌다(2026-09-11 사용자 지적).
//
// 우측 컬럼 높이는 데이터에 따라 달라지는 동적 값이라(고정 px 아님) ResizeObserver로 실측한다.
// lg 미만(좁은 화면)에서는 두 컬럼이 세로로 쌓이므로 높이 고정을 걸면 안 된다 — matchMedia로
// lg 이상일 때만 좌측에 height를 적용한다.
//
// 2026-09-12(4차, R2): `leftHeader`(라인 필터)를 별도 그리드 행(row1)으로 분리했다 — 이전에는
// ReleaseNoteStream 내부에 필터+리스트가 함께 있어, 리스트 패널의 실제 상단 y가 (필터 높이+gap)
// 만큼 아래에 있었는데 우측 첫 패널은 컬럼 최상단에서 바로 시작해 두 패널의 상단이 어긋나
// 보였다(사용자 실측 지적). CSS Grid는 행 트랙 높이를 열 전체에 동일 적용하므로, row1에
// leftHeader만 두면(col2는 비워둠) row2가 열 양쪽 모두에서 같은 y에서 시작한다 — JS로 오프셋을
// 계산하지 않고 그리드 배치만으로 상단을 맞춘다. `right`를 row2에 명시 배치하는 것이 핵심
// (row1부터 시작하면 다시 어긋난다).
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const LG_QUERY = "(min-width: 1024px)"; // Tailwind 기본 lg 브레이크포인트(DESIGN-TOKENS.md 미정의 — Tailwind 기본값 그대로 사용)

export interface StreamColumnLayoutProps {
  leftHeader: ReactNode;
  left: ReactNode;
  right: ReactNode;
}

export default function StreamColumnLayout({ leftHeader, left, right }: StreamColumnLayoutProps) {
  const rightRef = useRef<HTMLDivElement>(null);
  const [rightHeight, setRightHeight] = useState<number | null>(null);
  // 초기값은 lazy initializer로 즉시 계산 — effect 본문에서 동기 setState를 호출하면
  // 불필요한 캐스케이드 렌더를 유발한다(react-hooks/set-state-in-effect). effect는 이후
  // 변경(리사이즈로 브레이크포인트 전환)을 구독하는 용도로만 쓴다.
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(LG_QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(LG_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = rightRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setRightHeight(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const leftHeight = isDesktop && rightHeight ? rightHeight : undefined;

  return (
    // minmax(0,…) + min-w-0 — 트랙이 내용의 최소 폭으로 늘지 않는다. `fr`은 minmax(auto, Nfr)라 줄바꿈 못 하는 글자 하나가
    // 2:1 배분을 이기고 좌우 칸을 재배분했다(2026-10-07 레이아웃 게이트 D-STRESS-01, /lol/).
    <div className="grid grid-cols-1 items-start gap-x-6 gap-y-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-y-4">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">{leftHeader}</div>
      <div
        className="flex min-h-0 min-w-0 flex-col lg:col-start-1 lg:row-start-2"
        style={leftHeight ? { height: leftHeight } : undefined}
      >
        {left}
      </div>
      <div ref={rightRef} className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2">
        {right}
      </div>
    </div>
  );
}
