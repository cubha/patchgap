// src/components/compare/FocusToast.tsx
// 대조표 toast(2026-09-19, 사용자 지적: "카사딘 — 유의한 관측이 없어 이 표에 행이 없습니다 >>
// 시각적으로 전혀 보이질않음. toast로 변경").
//
// 왜 안 보였나: 그 안내는 표 머리에 붙은 12px 회색 한 줄이었다. 사용자는 **왼쪽 내비**를 클릭한
// 직후라 시선이 왼쪽에 있고, 오른쪽 표는 이미 화면에 있던 것이라 한 줄이 늘어난 변화를 인지할
// 단서가 없다. 그래서 위치를 시선이 아니라 **화면에 고정**하고, 나타남 자체가 신호가 되게 한다.
//
// 접근성: role="status" + aria-live="polite"(포커스를 훔치지 않는다) · 수동 닫기 버튼 ·
// prefers-reduced-motion이면 애니메이션 없이 즉시 표시. 자동 소멸 4초.
"use client";

import { useEffect, useState } from "react";

export interface FocusToastProps {
  /** 표시할 문장. null이면 아무것도 렌더하지 않는다. */
  message: string | null;
  /** 자동 소멸까지의 ms. 테스트가 0으로 끄고 검사할 수 있게 prop으로 연다. */
  durationMs?: number;
}

/**
 * **다시 띄우기는 `key`로 한다.** 부모가 선택할 때마다 다른 `key`를 주면 이 컴포넌트가 새로
 * 마운트되고 `visible`이 다시 true로 시작한다. 효과 안에서 `setVisible(true)`를 부르는 구조는
 * `react-hooks/set-state-in-effect`가 막는데(그 규칙은 렌더 → 효과 → 재렌더의 불필요한 왕복을
 * 잡는다), 여기서는 규칙을 끄는 대신 "다시 보여주기 = 새 인스턴스"로 바꿔 왕복 자체를 없앴다.
 */
export default function FocusToast({ message, durationMs = 4000 }: FocusToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (message === null || durationMs <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs]);

  if (message === null || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="focus-toast"
      className="motion-safe:animate-[toast-in_160ms_ease-out] fixed inset-x-0 bottom-6 z-30 flex justify-center px-4"
    >
      <div className="flex max-w-lg items-center gap-3 rounded-md border border-accent/40 bg-surface px-4 py-3 shadow-lg">
        <span className="h-2 w-2 shrink-0 rounded-pill bg-accent" aria-hidden="true" />
        <p className="text-sm text-fg-2">{message}</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="알림 닫기"
          className="ml-2 min-h-8 shrink-0 rounded-sm px-2 text-xs font-bold text-muted hover:text-fg"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
