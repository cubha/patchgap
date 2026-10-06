// src/lib/breadcrumbs.ts
// 이동 경로의 **내용**(모양은 `components/Breadcrumb.tsx`). UX-BRIEF §8-5: `브리핑 › 대조표 › {대상}`.
//
// 세 게임이 각자 자기 경로를 적고 있었고 그래서 형식이 셋으로 갈렸다(§8-7 #8). 문자열을 화면에서
// 조립하는 한 또 갈린다 — 여기서 만든다.
import { sectionHref, type GameId } from "@/lib/game";
import { pairSectionHref } from "@/lib/pairRoutes";

/** 이동 경로 한 마디(2026-10-06 `components/Breadcrumb.tsx`에서 이관 — 내용을 만드는 lib가 모양 모듈을 import하던
 * 역방향 의존을 없앤다). */
export interface Crumb {
  label: string;
  /** 마지막 마디는 링크를 걸지 않는다(현재 위치). */
  href?: string;
}

const BRIEFING = "브리핑";
const COMPARE = "대조표";

// `pairBase`(2026-09-28, 이월 R8): 과거 쌍 화면(`/{game}/history/{쌍}`)이면 마디가 **그 쌍의** 브리핑·대조표로
// 간다 — 과거 쌍 상세에서 「대조표」를 누르면 최신 쌍 대조표로 튀던 맥락 이탈을 막는다. 없으면 평소 주소.

/** 대조표 화면 — 마지막 마디가 현재 위치다. */
export function compareCrumbs(game: GameId, pairBase: string | null = null): Crumb[] {
  return [{ label: BRIEFING, href: pairSectionHref(game, "", pairBase) }, { label: COMPARE }];
}

/**
 * 상세 화면 — 마지막 마디는 **대상 이름**이다. 엔티티 유형(챔피언·유닛·무기)은 마디가 아니다:
 * 제목 옆 라벨이 이미 말하고, 그 마디를 눌러도 갈 곳이 없다(유형별 목록 화면이 없다).
 */
export function detailCrumbs(game: GameId, entityName: string, pairBase: string | null = null): Crumb[] {
  return [
    { label: BRIEFING, href: pairSectionHref(game, "", pairBase) },
    { label: COMPARE, href: pairSectionHref(game, "compare", pairBase) },
    { label: entityName },
  ];
}

/** 방법론 화면. */
export function methodologyCrumbs(game: GameId): Crumb[] {
  return [{ label: BRIEFING, href: sectionHref(game, "") }, { label: "방법론" }];
}
