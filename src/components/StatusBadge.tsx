// src/components/StatusBadge.tsx
// 상태 뱃지 — DESIGN-TOKENS.md "상태 색 문법(구현 불변식)" 4종 + "no-change"(변화 없음, ST-08
// types.ts 확장) + "below-threshold"(바닥 미달, 2026-09-13 신규) = 6종. 프로토타입
// `.badge`/`.badge-*` 1:1(색만 토큰 유틸로 재구현). status는 MatchStatus로 좁히지 않고 string을
// 받는다 — 아직 정의되지 않은 미래 상태값이 와도(statusLabel과 동일한 방어적 원칙) 무너지지 않고
// 뉴트럴 처리한다.

import { statusLabel } from "@/lib/format";

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** 신규 토큰 0개 — `border-border-soft`/`--fg-2`는 기존 네임스페이스에 이미 존재한다(CLAUDE.md
 * "임의 값 추가 금지" 원칙, verify.sh Spec 규칙 하드코딩 색 검사 통과). "below-threshold"는
 * `unannounced`(accent, 최상)보다 약하고 `no-change`(border-soft+muted, 최약)보다 강한 중간
 * 단계 — 실재하는 유의 변화이지만 실무상 무시 가능한 규모라는 의미를 색 강도로 표현한다. */
const STATUS_CLASSES: Record<string, string> = {
  "announced-consistent": "border-border text-fg-2",
  "announced-inconsistent": "border-danger text-danger",
  // 표시 전용(2026-09-18 ST-4): 노트 짝은 있으나 관측 비유의 — 경고색이 아니라 중립 회색.
  "announced-unobserved": "border-border-soft text-muted",
  // 표시 전용(2026-09-18 S9/S10): 유의하나 규모가 바닥 미달 — "below-threshold"와 같은 개념이므로
  // 같은 강도를 쓴다(실재하는 변화이지만 실무상 무시 가능한 규모).
  "announced-below-floor": "border-border-soft text-fg-2",
  unannounced: "border-accent text-accent",
  "indirect-effect": "border-accent text-fg-2",
  "insufficient-sample": "border-warn text-warn",
  "below-threshold": "border-border-soft text-fg-2",
  "no-change": "border-border-soft text-muted",
  // 표시 전용(2026-09-18 S5) — 짝지은 관측이 없다. 판정이 아니라 부재이므로 최약 중립.
  unpaired: "border-border-soft text-muted",
};

const FALLBACK_CLASSES = "border-border-soft text-muted";

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colorClasses = STATUS_CLASSES[status] ?? FALLBACK_CLASSES;
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-sm border px-2 py-1 font-mono text-xs font-bold ${colorClasses} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
