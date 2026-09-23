// src/components/StatTiles.tsx
// 홈 3타일 — **라벨·순서·클릭 대상을 세 게임이 공유한다**(UX-BRIEF §8-1).
//
// **왜 공용인가**(2026-09-22 13화면 실측): 같은 타일이 게임마다 달랐다 —
//   - 세 번째 라벨: LoL 「미공지 Gap」 / TFT·PUBG 「미공지」 / 랜딩 「패치노트에 없던 변화」
//     → 한 개념에 세 어휘. 읽는 쪽은 그것이 같은 수인지 알 수 없다.
//   - 첫 타일 부제: LoL 「(181개 항목)」 vs TFT·PUBG 「(18.2 패치노트)」 — 서로 다른 축을 괄호에 넣었다.
//   - 클릭: **LoL만** 미공지 타일이 대조표로 갔다. 나머지 둘은 같은 모양인데 눌리지 않는다.
// 값은 게임이 주고, **문구와 동작은 여기가 정한다**.
import Link from "next/link";

import { panelSurfaceClass } from "@/lib/panelSurface";
import { fmtInt } from "@/lib/format";
import { sectionHref, type GameId } from "@/lib/game";

/** 세 게임 공통 라벨. 화면에서 이 어휘를 다시 쓰지 않는다(§8-5). */
export const TILE_LABELS = {
  announced: "공지된 변화",
  significant: "유의한 관측",
  gap: "미공지 Gap",
} as const;

export interface StatTilesProps {
  /** 공지된 변화 — 패치노트가 말한 **대상** 수. */
  announcedCount: number;
  /**
   * 첫 타일 부제의 재료. `patch`는 항상, `itemCount`는 있는 게임만 — 없는 축을 "—"로 채우지 않는다.
   * 결과: `26.18 패치노트 · 181개 항목` / `18.2 패치노트`
   */
  patch: string;
  itemCount?: number | null;
  /** 유의한 관측 수. */
  significantCount: number;
  /** 미공지 Gap 수. */
  gapCount: number;
  /**
   * 어느 게임의 타일인가 — **미공지 타일이 갈 곳을 여기서 계산한다**.
   *
   * 전에는 `gapHref` 문자열을 호출부가 넘겼고, 그래서 한 게임(TFT)이 앵커 없는
   * `/tft/compare/`를 넘긴 채로 남아 있었다(그 대조표에 칩이 없었기 때문이다 — §8-3 Phase 2가
   * 그것을 채웠다). 문자열을 받는 한 네 번째 게임도 같은 방식으로 틀린다.
   */
  game: GameId;
}

/** 미공지 타일의 착지점 — 세 게임 모두 **그 게임 대조표의 「미공지」 칩**이다(칩 키 = 해시). */
export function gapHrefOf(game: GameId): string {
  return `${sectionHref(game, "compare")}#unannounced`;
}

export default function StatTiles({
  announcedCount,
  patch,
  itemCount = null,
  significantCount,
  gapCount,
  game,
}: StatTilesProps) {
  const subtitle = itemCount === null
    ? `${patch} 패치노트`
    : `${patch} 패치노트 · ${fmtInt(itemCount)}개 항목`;

  return (
    <section className={`${panelSurfaceClass("glass")} grid grid-cols-3 overflow-hidden rounded-lg`}>
      <div className="border-r border-border-soft p-5">
        <strong className="block font-display text-3xl font-bold tabular-nums text-fg">
          {fmtInt(announcedCount)}
        </strong>
        <span className="mt-1 block text-xs text-muted">
          {TILE_LABELS.announced} ({subtitle})
        </span>
      </div>
      <div className="border-r border-border-soft p-5">
        <strong className="block font-display text-3xl font-bold tabular-nums text-fg">
          {fmtInt(significantCount)}
        </strong>
        <span className="mt-1 block text-xs text-muted">{TILE_LABELS.significant}</span>
      </div>
      {/* hover 채움은 반투명으로 — `bg-surface-warm`(불투명)은 hover 순간 이 타일만 유리가 꺼져 보인다. */}
      <Link href={gapHrefOf(game)} className="p-5 transition-colors hover:bg-accent/10">
        <strong className="block font-display text-3xl font-bold tabular-nums text-accent">
          {fmtInt(gapCount)}
        </strong>
        <span className="mt-1 block text-xs text-muted">{TILE_LABELS.gap} ↗</span>
      </Link>
    </section>
  );
}
