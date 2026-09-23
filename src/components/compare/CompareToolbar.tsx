// src/components/compare/CompareToolbar.tsx
// 대조표 도구모음 — **세 게임이 이 하나를 쓴다**(UX-BRIEF §8-1 · §8-3).
//
// 전에는 게임마다 자기 줄을 그렸고 그래서 쓸 수 있는 도구가 달랐다(§8-7 #7 실측: 칩 LoL 4·
// PUBG 3·TFT 0 · 개수 표기 PUBG만 · 검색 LoL만 · 정렬 PUBG만 · 칩이 카드 밖/안으로 갈림).
// 규칙은 `toolbarRules.ts`가, 모양은 여기가 소유한다. 상태는 게임별 Explorer가 소유한다 —
// 각자 다른 행 타입에 그 상태를 적용해야 하기 때문이다(§8-0: 데이터는 게임 몫).
//
// 배치는 필터바 줄(`glass-chrome-2`)이 아니라 **본문 위 한 줄**이다. LoL만 헤더 아래 고정
// 크롬에 칩을 달고 있었는데, 그러면 TFT·PUBG에서 같은 자리를 만들 수 없다(그 둘은 고정 크롬이
// 없다). 셋 다 만들 수 있는 자리로 내린다.
"use client";

import type { ReactNode } from "react";

import FilterPill from "@/components/FilterPill";
import {
  COMPARE_FILTERS,
  COMPARE_SORTS,
  type CompareFilterKey,
  type CompareSortKey,
} from "./toolbarRules";

export interface CompareToolbarProps {
  filter: CompareFilterKey;
  onFilterChange: (key: CompareFilterKey) => void;
  /** 칩마다의 건수 — `countByFilter`가 만든다. 모든 칩 키가 채워져 있어야 한다. */
  counts: Record<CompareFilterKey, number>;
  query: string;
  onQueryChange: (query: string) => void;
  /** 검색창 placeholder — 대상 이름이 게임마다 다르다(챔피언·유닛·무기). */
  searchPlaceholder: string;
  sort: CompareSortKey;
  onSortChange: (key: CompareSortKey) => void;
  /** 그 게임에만 있는 축(LoL 라인 필터 등). 없으면 비운다 — 없는 축을 지어내지 않는다. */
  extra?: ReactNode;
}

export default function CompareToolbar({
  filter,
  onFilterChange,
  counts,
  query,
  onQueryChange,
  searchPlaceholder,
  sort,
  onSortChange,
  extra,
}: CompareToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="판정 필터">
        {COMPARE_FILTERS.map((f) => (
          <FilterPill key={f.key} selected={f.key === filter} onClick={() => onFilterChange(f.key)}>
            {f.label} {counts[f.key] ?? 0}
          </FilterPill>
        ))}
      </div>
      {extra}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="대상 검색"
          className="min-h-8 w-44 rounded-sm border border-border bg-surface-warm px-3 text-xs font-bold text-fg placeholder:font-normal placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <label className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted">정렬</span>
          <select
            className="min-h-8 rounded-sm border border-border bg-surface px-2 text-xs font-bold text-fg"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as CompareSortKey)}
          >
            {COMPARE_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
