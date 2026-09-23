// src/components/EntityIndexSection.tsx
// 브리핑 맨 아래 **전 대상 색인**(UX-BRIEF §8-1).
//
// **왜 필요한가**: 세 게임 모두 대조표는 «판정이 선 것»만 올린다. 그래서 판정이 서지 않은 대상의
// 상세로 가는 길이 없었다 — PUBG에서 실제로 그 지적이 나왔고(2026-09-18 P1 "상세페이지 진입점이
// 없음"), 무기 47종 그리드가 그 답이었다. 같은 구멍이 LoL·TFT에도 있었는데 그쪽은 그리드가
// 없었다. 전수 진입점은 이 슬롯 하나다.
//
// **표현은 게임 몫이다**(§8-0): PUBG는 공식 렌더 카드, LoL·TFT는 이름 격자. 같아야 하는 것은
// **자리와 제목과 세는 단위**이고, 그것을 이 컴포넌트가 소유한다.
import type { ReactNode } from "react";

import SectionCard from "@/components/SectionCard";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";

export interface EntityIndexGroup {
  /** 「무기」·「챔피언」처럼 그 묶음이 무엇인지. */
  label: string;
  /** 그 묶음의 **전 대상 수**. 판정된 수가 아니다 — 이 슬롯의 요지가 전수라서 그렇다. */
  total: number;
  body: ReactNode;
}

export const ENTITY_INDEX_TITLE = "이 패치의 모든 대상";

export default function EntityIndexSection({ groups }: { groups: readonly EntityIndexGroup[] }) {
  const total = groups.reduce((sum, g) => sum + g.total, 0);
  return (
    <SectionCard
      eyebrow="전 대상"
      title={ENTITY_INDEX_TITLE}
      variant="glass"
      action={<span className="font-mono text-xs tabular-nums text-muted">{total}개</span>}
    >
      <p className="px-5 pt-4 text-xs leading-relaxed text-muted">
        대조표에는 <strong className="text-fg-2">판정이 선 대상만</strong> 올라옵니다. 판정이 서지
        않은 대상의 관측은 여기서 엽니다.
      </p>
      <div className="flex flex-col">
        {groups.map((group) => (
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
 * 이름 격자 — 렌더 이미지가 없는 게임(LoL·TFT)의 표현. 상세가 없는 대상은 **링크를 걸지 않는다**:
 * 정적 export에서 없는 경로는 곧 404이고, 이 저장소는 없는 링크를 만들지 않는다.
 */
export function EntityIndexGrid({
  items,
  iconOf,
}: {
  items: readonly { key: string; name: string; href: string | null; meta?: string }[];
  /** 대상 → 아이콘. 없으면 아이콘 칸을 그리지 않는다(자산이 없는 게임). */
  iconOf?: (item: { key: string; name: string }) => ReactNode;
}) {
  return (
    <ul className={`grid grid-cols-2 gap-px bg-border-soft sm:grid-cols-3 lg:grid-cols-5 ${PANEL_SCROLL_BODY}`}>
      {items.map((item) => (
        <li key={item.key} className="bg-surface">
          {item.href ? (
            <a
              href={item.href}
              className="flex h-full flex-col gap-1 p-3 transition-colors hover:bg-accent/10"
            >
              {iconOf ? iconOf(item) : null}
              <span className="truncate font-display text-sm font-bold text-fg">{item.name}</span>
              {item.meta ? (
                <span className="font-mono text-xs tabular-nums text-muted">{item.meta}</span>
              ) : null}
            </a>
          ) : (
            <div className="flex h-full flex-col gap-1 p-3">
              {iconOf ? iconOf(item) : null}
              <span className="truncate font-display text-sm font-bold text-fg-2">{item.name}</span>
              <span className="font-mono text-xs text-muted">{item.meta ?? "판정 없음"}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
