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

/**
 * 격자 칸의 선 — **칸이 자기 선을 긋는다**(2026-09-29 사용자 지적 「빈 여백공간이 시각적으로 너무 거슬린다」).
 * 이전엔 `gap-px bg-border-soft`(바탕색이 틈으로 비쳐 선이 되는 방식)였는데, 마지막 줄이 덜 차면 남는 자리 전체가
 * 그 바탕색으로 칠해져 밝은 덩어리가 됐다. 칸마다 오른쪽·아래 선을 긋고 격자는 바탕을 두지 않으면 빈자리는
 * 패널 표면 그대로다. 격자의 `-mr-px -mb-px`는 패널 가장자리에 붙는 마지막 열·줄의 선을 패널 밖으로 밀어 낸다.
 * PUBG 렌더 카드 격자도 같은 두 값을 쓴다 — 세 게임의 칸 모양이 여기 한 곳에서 정해진다.
 */
export const ENTITY_INDEX_GRID = "grid -mb-px -mr-px";
export const ENTITY_INDEX_CELL = "border-b border-r border-border-soft";

export default function EntityIndexSection({ groups }: { groups: readonly EntityIndexGroup[] }) {
  const shown = groups.filter((g) => g.total > 0);
  const total = shown.reduce((sum, g) => sum + g.total, 0);
  if (total === 0) return null;
  return (
    <SectionCard
      eyebrow="대상"
      title={ENTITY_INDEX_TITLE}
      description="상세 화면이 있는 대상을 모았습니다. 눌러서 그 대상의 관측·패치노트 대조로 갑니다."
      variant="glass"
      action={<span className="font-mono text-xs tabular-nums text-muted">{total}개</span>}
    >
      <div className="flex flex-col">
        {shown.map((group) => (
          // 묶음은 접었다 편다(2026-09-29 사용자 요청) — 서버 컴포넌트라 네이티브 `<details>`(BriefingRowList·
          // MiscChangesSection과 같은 규약). 처음엔 펼쳐 둔다: 접힌 채로 시작하면 바로가기가 한 번 더 멀어진다.
          <details key={group.label} open className="group/index border-t border-border-soft first:border-t-0">
            {/* 머리는 격자 칸과 구분되게 한 단계 밝은 띠로 — 이전엔 칸과 같은 바탕의 옅은 글씨라 어디서 묶음이
                바뀌는지 모호했다. 개수는 라벨 바로 옆, 오른쪽 끝은 접기 표시. */}
            <summary className="flex cursor-pointer list-none items-center gap-2 border-border-soft bg-surface-warm group-open/index:border-b px-5 py-3 transition-colors hover:bg-accent/10 [&::-webkit-details-marker]:hidden">
              <h3 className="font-display text-sm font-bold text-fg">{group.label}</h3>
              <span className="rounded-pill border border-border-soft px-2 font-mono text-xs tabular-nums text-muted">
                {group.total}개
              </span>
              <span className="flex-1" />
              <span aria-hidden="true" className="text-muted transition-transform group-open/index:rotate-180">
                ▾
              </span>
            </summary>
            {group.body}
          </details>
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
    <ul className={`${ENTITY_INDEX_GRID} grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${PANEL_SCROLL_BODY}`}>
      {items.map((item) => (
        <li key={item.key} className={ENTITY_INDEX_CELL}>
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
