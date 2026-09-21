// src/components/StatusBadge.tsx
// 상태 뱃지 — DESIGN-TOKENS.md "상태 색 문법(구현 불변식)"(accent=미공지 · danger=이상 관측 ·
// warn=표본 부족). 프로토타입 `.badge`/`.badge-*` 1:1(색만 토큰 유틸로 재구현). status는 표시 키로
// 좁히지 않고 string을 받는다 — 아직 정의되지 않은 값이 와도(statusLabel과 동일한 방어적 원칙)
// 무너지지 않고 뉴트럴 처리한다. 어휘는 `src/lib/format.ts` statusLabel 한 곳이 정한다.

import { statusLabel } from "@/lib/format";

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** 신규 토큰 0개 — 기존 네임스페이스만 쓴다(CLAUDE.md "임의 값 추가 금지"). 2026-09-18 라운드6:
 * 표시 키 3종으로 정리 — 공지(중립) · 공지 · 이상 관측(danger, 노트와 반대 방향의 유의 변화) ·
 * 미공지(accent). raw MatchStatus가 들어와도 같은 색 문법으로 읽힌다(PUBG 화면). 노이즈 3종은
 * 방법론 정의표에서만 렌더된다(화면은 표시하지 않는다). */
const STATUS_CLASSES: Record<string, string> = {
  announced: "border-border text-fg-2",
  "announced-anomaly": "border-danger text-danger",
  unannounced: "border-accent text-accent",
  // 수치 축(F9) — 세 게임 공통. 지표 축 미공지(테두리 accent)와 구분되게 **채운다**: 통계가 아니라
  // 게임 데이터가 증명한 변경이라는 뜻(SubmarineSection의 pill과 같은 색).
  submarine: "border-accent bg-accent text-accent-on",
  // 같은 수치 축이라 **같이 채우고**, 색만 warn으로 가른다 — 노트가 말하긴 했으므로 잠수함과
  // 같은 골드로 찍으면 두 발견이 한 덩어리로 읽힌다(신규 토큰 0개).
  "note-mismatch": "border-warn bg-warn text-accent-on",
  unpaired: "border-border-soft text-muted",
  // raw MatchStatus → 같은 색
  "announced-consistent": "border-border text-fg-2",
  "announced-inconsistent": "border-danger text-danger",
  "indirect-effect": "border-accent text-accent",
  "insufficient-sample": "border-warn text-warn",
  "below-threshold": "border-border-soft text-fg-2",
  "no-change": "border-border-soft text-muted",
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
