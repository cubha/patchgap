// src/components/BriefingRowList.tsx
// 브리핑 본문 — **대상 1개 = 행 1개**(UX-BRIEF §8-2). 세 게임이 같은 모양을 쓴다.
//
// 형태: 접힘 `[뱃지] 이름 → · 유형 · N개 항목` / 펼침 = 항목 줄(각 줄에 자기 뱃지) + 원인 1줄.
//
// **왜 `<details>`인가**: LoL은 카드 스트림에서 이미 접었다 펴는데, TFT·PUBG 표는 서버
// 컴포넌트라 `useState`를 쓰려면 `"use client"`가 필요하다. 네이티브 `<details>`는 JS 없이
// 접히고, 키보드·스크린리더 지원이 기본으로 붙으며, 정적 export와도 맞는다 — 상태 하나를
// 위해 세 화면을 클라이언트 컴포넌트로 내리지 않는다.
//
// **왜 뱃지가 맨 앞인가**: 셋이 제각각이었다(LoL 카드 안쪽 · TFT 표 맨 뒤 열 · PUBG는 같은
// 화면에서 표는 뒤, 리스트는 앞). 가장 먼저 읽히는 자리에 판정을 두기로 정했다(§8-1).
import type { ReactNode } from "react";

import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import ExternalLink from "@/components/ExternalLink";
import { itemCountLabel, type BriefingGroup } from "@/components/briefingRows";

export interface BriefingRowListProps {
  groups: readonly BriefingGroup[];
  /** 대상 → 상세 경로. `null`이면 링크를 걸지 않는다(라우트가 없는 대상). */
  hrefOf: (group: BriefingGroup) => string | null;
  /** 델타 id → 원인 줄. 없으면 그 줄을 그리지 않는다 — 회색으로도 만들지 않는다. */
  causeOf?: (itemId: string) => { text: string; verified: boolean; href?: string | null } | null;
  /**
   * 대상 → 아이콘. `undefined`면 아이콘 칸 자체를 그리지 않는다(자산이 없는 게임).
   * LoL 카드는 이미 아이콘을 달고 있었고 TFT·PUBG 행에는 없었다 — 자산이 생긴 게임부터 붙인다.
   */
  iconOf?: (group: BriefingGroup) => ReactNode;
  emptyText: string;
}

export default function BriefingRowList({
  groups,
  hrefOf,
  causeOf,
  iconOf,
  emptyText,
}: BriefingRowListProps) {
  if (groups.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col">
      {groups.map((group) => {
        const href = hrefOf(group);
        return (
          <li
            key={`${group.entityType}:${group.entityKey}`}
            className="border-t border-border-soft first:border-t-0"
          >
            <details>
              {/* marker 제거 — 삼각형 기본 마커는 게임마다 브라우저 기본값이 달라 보인다. */}
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 [&::-webkit-details-marker]:hidden">
                <StatusBadge status={group.status} />
                {iconOf ? iconOf(group) : null}
                {href ? (
                  <Link href={href} className="text-sm font-bold text-fg hover:text-accent hover:underline">
                    {group.entityName} →
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-fg">{group.entityName}</span>
                )}
                {group.typeLabel ? (
                  <span className="font-mono text-xs tracking-wider text-muted uppercase">
                    {group.typeLabel}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-xs text-muted">{itemCountLabel(group)} ▾</span>
              </summary>

              <div className="flex flex-col gap-2 px-5 pb-4">
                {group.items.map((item) => {
                  const cause = causeOf?.(item.id) ?? null;
                  return (
                    <div key={item.id} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <StatusBadge status={item.status} />
                        <span className="font-mono text-xs text-muted">{item.field}</span>
                        <span className="font-mono text-sm tabular-nums text-fg-2">{item.change}</span>
                        {item.delta ? (
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              item.delta.improved ? "text-success" : "text-danger"
                            }`}
                          >
                            {item.delta.text}
                          </span>
                        ) : null}
                        {item.noteAnchor ? (
                          <ExternalLink
                            href={item.noteAnchor}
                            className="ml-auto font-mono text-xs text-accent hover:underline"
                          >
                            원문 ↗
                          </ExternalLink>
                        ) : (
                          // 무근거 회색 — 링크를 걸지 않는다(지어낸 근거를 만들지 않는다).
                          <span className="ml-auto font-mono text-xs text-muted">—</span>
                        )}
                      </div>
                      {cause ? (
                        <p
                          className={`border-l-2 border-border-soft pl-3 text-xs leading-relaxed ${
                            cause.verified ? "text-fg-2" : "text-muted"
                          }`}
                        >
                          <span className="font-mono text-muted">추정 원인 </span>
                          {cause.text}{" "}
                          {cause.verified && cause.href ? (
                            <ExternalLink href={cause.href} className="text-accent hover:underline">
                              근거 ↗
                            </ExternalLink>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
