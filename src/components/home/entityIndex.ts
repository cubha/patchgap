// src/components/home/entityIndex.ts
// 브리핑 하단 **상세 바로가기**의 조립 규칙(UX-BRIEF §8-1). 순수 함수 — 렌더는 `EntityIndexSection.tsx`.
//
// 규칙(세 게임 공통): 상세 라우트가 **실재하는 대상만** 낸다. 2026-09-29 전까지는 전수를 내고 상세가 없으면 링크만
// 뺐는데, LoL 391칸 중 339칸·TFT 231칸 중 192칸이 누를 수 없는 「판정 없음」 이름표였다 — 이 슬롯의 목적(상세 입구)을
// 못 하는 칸이다. 사용자 결정으로 바로가기만 남긴다(`docs/plan/PLAN-entity-index-quicklinks-2026-09-29.md`).
export interface EntityIndexEntry {
  readonly key: string;
  readonly name: string;
  /** 상세 경로 — 상세가 없는 대상은 애초에 목록에 없다. */
  readonly href: string;
  readonly meta?: string;
}

export interface EntityIndexSource {
  readonly type: string;
  readonly key: string;
  readonly name: string;
  readonly meta?: string;
}

/**
 * 중복을 접고 **이름 순**으로 세운다. 순서를 이름으로 고정하는 이유: 이 슬롯은 「찾으러 오는 곳」이라
 * 중요도 정렬이 도움이 되지 않는다(중요도는 위의 브리핑·대조표가 이미 말한다).
 */
export function buildEntityIndex(
  sources: readonly EntityIndexSource[],
  hasDetail: (type: string, key: string) => boolean,
  hrefOf: (type: string, key: string) => string
): EntityIndexEntry[] {
  const byKey = new Map<string, EntityIndexEntry>();
  for (const source of sources) {
    const id = `${source.type}:${source.key}`;
    if (byKey.has(id) || !hasDetail(source.type, source.key)) continue;
    byKey.set(id, { key: id, name: source.name, href: hrefOf(source.type, source.key), meta: source.meta });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
