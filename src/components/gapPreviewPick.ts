// src/components/gapPreviewPick.ts — 첫 화면 미공지 사례 선택. (파일명이 `GapPreview.tsx`와 대소문자만 다르면 /mnt/d에서 한 모듈로 해석된다)
// 첫 화면 미공지 사례 선택 — 순수 함수(트랙 B ST-22, 2026-10-11 site-review lol-S23·pubg-S8).
//
// 리뷰 실측: 사이트의 명제(「패치노트에 없는 변화」)인데 브리핑 1280×800 첫 화면에 미공지 사례가 0건 — 미공지는 두 번째 탭 뒤였다.
// 탭 순서 뒤집기는 두 번 기각됐다(재제안 금지). 대신 타일 바로 아래 한 줄에 상위 사례를 이름·변화로 보인다. 게임마다 행 모양이 달라
// 변환은 브리핑이 하고(이름·문구·주소·크기), 고르는 규칙은 여기 하나다: **대상당 1건(가장 큰 것) → 크기순 → 상위 N**.
export interface GapPreviewItem {
  /** 대상 동일성 키(`unit:DA_18_Rengar`). */
  key: string;
  name: string;
  /** 「밴률 +11.9%p」처럼 지표와 변화 한 덩이. */
  text: string;
  /** 상세 주소 — 없으면 이름만. */
  href: string | null;
  /** 정렬 크기(효과크기 절댓값 등) — 게임이 정한다. */
  score: number;
}

export function pickGapPreview(items: readonly GapPreviewItem[], n: number): GapPreviewItem[] {
  const best = new Map<string, GapPreviewItem>();
  for (const item of items) {
    const prev = best.get(item.key);
    if (!prev || item.score > prev.score) best.set(item.key, item);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, n);
}
