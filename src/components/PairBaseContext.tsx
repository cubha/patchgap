// src/components/PairBaseContext.tsx
// 과거 패치쌍 화면의 **기준 경로**(`/lol/history/26_16-26_17`)를 깊은 클라이언트 컴포넌트에 건넨다(2026-09-28, 이월 R8).
//
// 왜 컨텍스트인가: 대상 링크를 만드는 곳이 스트림 카드(`ReleaseNoteRow`)·대조표 셀(`DeltaTable`)·TFT 대조표처럼
// 클라이언트 트리 2~3단 아래다. prop으로 내려보내면 중간 컴포넌트마다 링크와 무관한 인자가 하나씩 는다. 서버
// 컴포넌트(브리핑 본문·이동 경로)는 훅을 못 쓰므로 같은 값을 **인자로 직접** 넘긴다(`lolEntityHref(row, base)`).
// 값이 없으면(`null`) 평소 주소 — 최신 쌍 화면은 이 Provider를 두르지 않는다.
"use client";

import { createContext, useContext, type ReactNode } from "react";

const PairBaseContext = createContext<string | null>(null);

export function PairBaseProvider({ value, children }: { value: string | null; children: ReactNode }) {
  return <PairBaseContext.Provider value={value}>{children}</PairBaseContext.Provider>;
}

/** 지금 그리는 화면이 과거 쌍이면 그 기준 경로, 아니면 null. */
export function usePairBase(): string | null {
  return useContext(PairBaseContext);
}
