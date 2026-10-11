// src/components/GapPreview.tsx
// 첫 화면 미공지 상위 한 줄(트랙 B ST-22, 2026-10-11 site-review lol-S23·pubg-S8) — 세 브리핑이 타일 바로 아래 같은 자리에 둔다.
//
// 텍스트 링크만 쓴다(채움 버튼 금지): 브리핑의 주 행동은 UX-BRIEF §7-1 바인딩 「디스코드 방 들어가기 →」이고(10/8 하향 기각), 채움이
// 하나 더 생기면 주 행동이 둘로 읽힌다(D-UX-01). 탭 순서(「패치 내용」 먼저)는 그대로다 — 「발견 먼저」 뒤집기는 두 번 기각됐다.
import Link from "next/link";
import type { GapPreviewItem } from "./gapPreviewPick";

export default function GapPreview({ items }: { items: readonly GapPreviewItem[] }) {
  if (items.length === 0) return null;
  return (
    <p data-gap-preview className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-fg-2">
      <span className="text-xs font-bold text-muted">미공지 상위</span>
      {items.map((item) => (
        <span key={item.key} className="flex items-baseline gap-1.5">
          {item.href ? (
            <Link href={item.href} className="font-bold text-fg hover:text-accent hover:underline">
              {item.name} →
            </Link>
          ) : (
            <strong className="font-bold text-fg">{item.name}</strong>
          )}
          <span className="font-mono text-xs tabular-nums text-fg-2">{item.text}</span>
        </span>
      ))}
    </p>
  );
}
