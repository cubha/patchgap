// src/components/home/entityIndex.ts
// 전 대상 색인의 **조립 규칙**(UX-BRIEF §8-1). 순수 함수 — 렌더는 `EntityIndexSection.tsx`.
//
// 규칙은 둘뿐이고 세 게임이 같다:
//  ① **전수**를 낸다 — 판정이 섰는지와 무관하다. 그게 이 슬롯의 존재 이유다.
//  ② 상세 라우트가 **실재할 때만** 링크를 건다. 정적 export에서 없는 경로는 곧 404다.
export interface EntityIndexEntry {
  readonly key: string;
  readonly name: string;
  /** 상세 경로. `null`이면 그 대상은 상세가 없다(링크를 걸지 않는다). */
  readonly href: string | null;
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
    if (byKey.has(id)) continue;
    byKey.set(id, {
      key: id,
      name: source.name,
      href: hasDetail(source.type, source.key) ? hrefOf(source.type, source.key) : null,
      meta: source.meta,
    });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
