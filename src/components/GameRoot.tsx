// src/components/GameRoot.tsx
// 게임 테마 스코프 — 현재 경로가 어느 게임인지를 DOM 속성 하나로 표시한다. 이 속성을
// `src/styles/tokens.css`의 `:root:has([data-game="pubg"])`가 읽어 중립 8종 + 워시 2종을
// 스왑하고(HANDOFF §3 계약), `src/styles/ambient.css`가 읽어 협곡 아트 레이어를 끈다.
//
// **클라이언트 컴포넌트인 이유**: 루트 레이아웃(서버)은 현재 경로를 모른다. 라우트별로
// <html> 속성을 주려면 route group 다중 root layout이 필요한데(Next 16 문서 확인), 그러면
// <html>/<body>와 공용 Header가 그룹마다 복제된다 — 비용이 이득보다 크다.
//
// **FOUC는 없다**: `output:'export'`라 모든 라우트가 빌드 타임에 프리렌더되고 `usePathname()`도
// 그때 확정되므로, 속성은 **정적 HTML에 이미 박혀서 나간다**(Header의 활성 탭 강조가 이미 같은
// 방식으로 동작하는 것이 실증이다). 클라이언트에서 뒤늦게 붙이는 값이 아니다.
//
// `display:contents`(className="contents")인 이유 — 이 래퍼는 오직 속성만 나르고 레이아웃에는
// 참여하지 않아야 한다. body의 flex 컨텍스트에서 .ambient-root와 본문 컬럼이 지금과 똑같이
// 배치되어야 하기 때문이다.
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { gameFromPathname } from "@/lib/game";

export default function GameRoot({ children }: { children: ReactNode }) {
  const game = gameFromPathname(usePathname());
  return (
    <div data-game={game} className="contents">
      {children}
    </div>
  );
}
