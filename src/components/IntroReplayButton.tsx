// src/components/IntroReplayButton.tsx
// 인트로 재생 버튼 — 승인 시안 아티팩트 「PUBG 테마 시안」(2026-09-15)의 `.replay-btn`
// ("↻ 강하 인트로 재생")을 이식한 것이다. 9차 구현이 빠뜨린 항목.
//
// **왜 필요한가**(2026-09-17 사용자 지적 "아직도 애니메이션은 안되는데? LOL, 배틀그라운드 둘다"):
// 인트로는 라우트 진입 시 자동으로 한 번만 돈다 — LoL 영상은 1.7초, PUBG 강하는 3.4초다.
// 페이지가 뜨는 순간을 놓치면 다시 볼 방법이 없었고, `prefers-reduced-motion`을 켠 환경에서는
// 아예 재생되지 않아 **존재 자체를 확인할 수 없었다**(실측 재현). 이 버튼이 그 두 경우 모두의
// 탈출구다 — 누르는 것은 사용자의 명시적 의사이므로 reduced-motion이어도 재생한다.
//
// 양쪽 게임에 같이 붙인다. 사용자가 "둘 다"라고 지적했고, 같은 자리에 같은 어포던스가 있는
// 것이 게임 스위처의 전제(같은 사이트, 데이터와 테마만 다름)와도 맞는다.
"use client";

import { useAmbient } from "@/components/AmbientContext";

export interface IntroReplayButtonProps {
  /** 버튼 라벨 — 게임마다 인트로의 성격이 달라 부르는 이름도 다르다. */
  label: string;
}

export default function IntroReplayButton({ label }: IntroReplayButtonProps) {
  const { replayIntro } = useAmbient();
  return (
    <button
      type="button"
      onClick={replayIntro}
      className="meta-chip w-fit rounded-pill border border-border-soft px-3 py-1.5 font-mono text-xs font-bold text-fg-2 transition-colors hover:border-border hover:text-fg"
    >
      ↻ {label}
    </button>
  );
}
