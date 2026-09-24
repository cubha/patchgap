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

/**
 * 브리핑 행 **맨 앞 뱃지 칸의 고정 폭**. 뱃지 자신이 아니라 뱃지를 담는 슬롯에 건다.
 *
 * **왜 필요한가**(2026-09-24 사용자 지적, 실측): 뱃지는 `inline-flex`라 글자 수만큼 폭이
 * 변한다 — 「공지」 54px vs 「공지 · 이상 관측」 125px. 그 71px 차이가 맨 앞에 있으니 뒤의
 * 아이콘·이름·지표가 행마다 다른 x에서 시작했다. 뱃지가 맨 앞이라는 §8-1 계약은 유지하되
 * (판정을 가장 먼저 읽는다), **칸을 고정해** 그 뒤를 정렬시킨다.
 *
 * **144px(`w-36`)인 근거**: 화면 뱃지로 쓰이는 라벨 전수를 실제 폰트로 렌더해 잰 최댓값이
 * 125px이다(「공지 · 이상 관측」. 다음이 「짝지은 관측 없음」 123px · 「공지값 불일치」 105px).
 * `w-36`은 그 위의 가장 타이트한 Tailwind 스케일 값이라 여백이 19px로 최소다. arbitrary 값이
 * 아니므로 토큰 우회 경고도 나지 않는다.
 *
 * **지금 데이터로 정하지 않았다**: 현재 브리핑에 실제로 뜨는 뱃지는 2종뿐인데, 그 2종에
 * 맞추면 라벨이 하나 늘 때 조용히 깨진다. 그래서 `STATUS_LABELS` **전수**로 상한을 잡고,
 * 더 긴 라벨이 추가되면 `screen-parity.test.ts`가 실패한다(그 게이트는 픽셀이 아니라 글자
 * 수를 본다 — jsdom은 폭을 못 잰다. 한계는 그쪽 주석에 적었다).
 */
export const BADGE_SLOT = "w-36 shrink-0";

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
