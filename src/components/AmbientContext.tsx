// src/components/AmbientContext.tsx
// 전역 앰비언트 배경(AmbientBackground.tsx)이 소비하는 공유 상태 — layout.tsx에 단 한 번
// 렌더되는 배경과, 페이지별로 그 배경을 갱신하는 소비자(홈 라인 필터·항목상세 스플래시)를
// 잇는 client context. advisor 검토(2026-09-12): 배경을 두 번 렌더해 각자 다른 selectedLane을
// 들고 동기화하는 대신, 상태를 한 곳에 올리고 배경은 그 상태의 유일한 구독자로 둔다.
"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LaneAxis } from "@/lib/lane";

export interface AmbientState {
  /** 홈 라인 카메라가 따라갈 현재 선택 라인. 홈을 벗어나면 배경은 이 값을 무시하고 "all"로 렌더한다
   * (AmbientBackground.tsx가 usePathname()으로 판단) — 다른 페이지가 굳이 리셋할 필요 없음. */
  selectedLane: LaneAxis;
  setSelectedLane: (lane: LaneAxis) => void;
  /** 항목상세(챔피언) 히어로 스플래시 URL. null이면 상세 스플래시 레이어를 렌더하지 않는다. */
  detailSplashUrl: string | null;
  setDetailSplashUrl: (url: string | null) => void;
  /**
   * 인트로 재생 요청 카운터. 0 = 라우트 진입에 따른 **자동** 재생, 1 이상 = 사용자가 재생
   * 버튼을 누른 **수동** 재생이다. 이 둘을 구분하는 이유는 `prefers-reduced-motion` 때문 —
   * 자동 재생은 그 설정을 존중해 막지만, 사용자가 직접 누른 것은 명시적 의사라 재생한다
   * (막으면 그 설정을 켠 사람은 인트로를 볼 방법이 아예 없다).
   */
  introNonce: number;
  replayIntro: () => void;
}

const AmbientContext = createContext<AmbientState | null>(null);

export function AmbientProvider({ children }: { children: ReactNode }) {
  const [selectedLane, setSelectedLane] = useState<LaneAxis>("all");
  const [detailSplashUrl, setDetailSplashUrl] = useState<string | null>(null);
  const [introNonce, setIntroNonce] = useState(0);

  const replayIntro = useCallback(() => setIntroNonce((n) => n + 1), []);

  const value = useMemo<AmbientState>(
    () => ({ selectedLane, setSelectedLane, detailSplashUrl, setDetailSplashUrl, introNonce, replayIntro }),
    [selectedLane, detailSplashUrl, introNonce, replayIntro]
  );

  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

export function useAmbient(): AmbientState {
  const ctx = useContext(AmbientContext);
  if (!ctx) {
    throw new Error("useAmbient는 AmbientProvider 하위에서만 호출할 수 있다 (layout.tsx 확인)");
  }
  return ctx;
}
