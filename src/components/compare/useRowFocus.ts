// src/components/compare/useRowFocus.ts
// 좌 내비에서 고른 대상의 표 행을 **패널 최상단으로** 옮기는 규약(UX-BRIEF §8-3 "좌측 항목 클릭 →
// 우측 행 최상단 + 강조"). 세 게임 표가 같은 훅을 쓴다.
//
// `scrollIntoView`를 쓰지 않는 이유: 문서 스크롤까지 같이 움직여 페이지가 튄다 — 스크롤 컨테이너의
// `scrollTop`만 계산한다. `CSS.escape`·`scrollTo`는 jsdom에 없어 속성 비교로 찾고 있을 때만 움직인다.
"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface RowFocusRefs<S extends HTMLElement, H extends HTMLElement> {
  /** 내부 스크롤 컨테이너. */
  scrollerRef: RefObject<S | null>;
  /** sticky 헤더 — 그 높이만큼 아래에 행을 앉힌다. 없으면 0으로 본다. */
  headRef: RefObject<H | null>;
}

/** 행에 `data-entity-key`를 달아 두면 이 훅이 찾는다. */
export function useRowFocus<S extends HTMLElement = HTMLDivElement, H extends HTMLElement = HTMLTableSectionElement>(
  focusKey: string | null
): RowFocusRefs<S, H> {
  const scrollerRef = useRef<S | null>(null);
  const headRef = useRef<H | null>(null);

  useEffect(() => {
    if (!focusKey) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const row = Array.from(scroller.querySelectorAll<HTMLElement>("[data-entity-key]")).find(
      (el) => el.dataset.entityKey === focusKey
    );
    if (!row) return;
    // 즉시 이동 — `behavior: "smooth"`는 실측(정적 빌드, Chromium)에서 시작되지 않는 경우가 있었다.
    scroller.scrollTop = Math.max(0, row.offsetTop - (headRef.current?.offsetHeight ?? 0));
  }, [focusKey]);

  return { scrollerRef, headRef };
}
