// src/components/home/MobileActionBar.tsx
// 모바일 고정 하단 CTA(PLAN-mobile-cta-2026-10-08, 사용자 결정). UX-BRIEF §7-1이 브리핑 3곳의 주 행동을 「디스코드 방
// 들어가기 →」로 선언했는데, 375px에서는 사이드 패널이 본문 아래(y 1348~4792)로 내려가 첫 화면에 주 행동이 없었다(UI 게이트
// D-UX-04 ×3). `lg` 미만에서만 화면 바닥에 고정하고, `lg` 이상은 사이드 패널이 담당한다(둘이 같은 `DiscordCta`를 그린다 —
// 같은 라벨 반복은 게이트가 1로 센다). 고정 요소는 흐름에서 빠지므로 **같은 높이의 여백**을 두어 푸터를 가리지 않는다.
// 서버 컴포넌트 — 상태 없음.
import { DiscordCta } from "@/components/home/DiscordPanel";
import type { GameId } from "@/lib/game";

export default function MobileActionBar({ game }: { game: GameId }) {
  return (
    <>
      {/* 스페이서 64px ≥ 바 실높이 61px(py-2 8×2 + min-h-11 44 + border-t 1) — 작으면 푸터 마지막 줄이 바 밑에 깔린다(scope-critic ST-1). */}
      <div aria-hidden="true" data-mobile-action-spacer="" className="h-16 lg:hidden" />
      <nav aria-label="주 행동" className="fixed inset-x-0 bottom-0 z-30 border-t border-border-soft bg-surface px-4 py-2 lg:hidden">
        {/* min-h-11 = 44px — 탭 타깃 하한(D-A11Y-02). */}
        <DiscordCta game={game} className="min-h-11 w-full" />
      </nav>
    </>
  );
}
