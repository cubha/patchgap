// src/components/EntityIndexSection.tsx
// 브리핑 맨 아래 **상세 바로가기**(UX-BRIEF §8-1) — 세 게임 같은 자리·같은 제목.
//
// **목적**: 대상 상세로 들어가는 이미지 입구. 처음(2026-09-18 PUBG P1 「상세페이지 진입점이 없음」)엔 「전 대상 색인」으로
// 전수를 늘어놓았지만, LoL·TFT는 상세가 판정이 선 대상에만 있어 칸의 87%·83%가 누를 수 없는 「판정 없음」이었다
// (2026-09-29 사용자 지적). 이제 **상세가 있는 대상만** 올린다 — PUBG는 무기·맵 전부에 상세가 있어 그대로다.
//
// **표현은 게임 몫이다**(§8-0): PUBG는 공식 렌더 카드, LoL·TFT는 아이콘 격자. 같아야 하는 것은 자리·제목·세는
// 단위이고, 그것을 이 컴포넌트가 소유한다.
import type { ReactNode } from "react";

import SectionCard from "@/components/SectionCard";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";

export interface EntityIndexGroup {
  /** 「무기」·「챔피언」처럼 그 묶음이 무엇인지. */
  label: string;
  /** 그 묶음의 칸 수(= 상세가 있는 대상 수). 0이면 묶음을 그리지 않는다. */
  total: number;
  body: ReactNode;
}

export const ENTITY_INDEX_TITLE = "상세 바로가기";

export default function EntityIndexSection({ groups }: { groups: readonly EntityIndexGroup[] }) {
  const shown = groups.filter((g) => g.total > 0);
  const total = shown.reduce((sum, g) => sum + g.total, 0);
  if (total === 0) return null;
  return (
    <SectionCard
      eyebrow="대상"
      title={ENTITY_INDEX_TITLE}
      variant="glass"
      action={<span className="font-mono text-xs tabular-nums text-muted">{total}개</span>}
    >
      <p className="px-5 pt-4 text-xs leading-relaxed text-muted">
        상세 화면이 있는 대상을 모았습니다. 눌러서 그 대상의 관측·패치노트 대조로 갑니다.
      </p>
      <div className="flex flex-col">
        {shown.map((group) => (
          <section key={group.label} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <h3 className="font-body text-xs font-bold text-muted">{group.label}</h3>
              <span className="font-mono text-xs tabular-nums text-muted">{group.total}개</span>
            </div>
            {group.body}
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

/**
 * 아이콘 격자 — 렌더 이미지 카드가 없는 게임(LoL·TFT)의 표현. 칸은 전부 상세 링크다(상세 없는 대상은 목록에 없다).
 */
export function EntityIndexGrid({
  items,
  iconOf,
}: {
  items: readonly { key: string; name: string; href: string; meta?: string }[];
  /** 대상 → 아이콘. 이름 격자를 쓰는 브리핑은 전부 넘긴다(`screen-parity.test.ts` 가드). */
  iconOf?: (item: { key: string; name: string }) => ReactNode;
}) {
  return (
    <ul className={`grid grid-cols-2 gap-px bg-border-soft sm:grid-cols-3 lg:grid-cols-5 ${PANEL_SCROLL_BODY}`}>
      {items.map((item) => (
        <li key={item.key} className="bg-surface">
          <a href={item.href} className="flex h-full flex-col gap-1 p-3 transition-colors hover:bg-accent/10">
            {iconOf ? iconOf(item) : null}
            <span className="truncate font-display text-sm font-bold text-fg">{item.name}</span>
            {item.meta ? <span className="font-mono text-xs tabular-nums text-muted">{item.meta}</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
