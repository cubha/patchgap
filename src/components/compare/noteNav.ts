// src/components/compare/noteNav.ts
// 좌 「패치노트 항목」 내비의 **묶는 규칙**(UX-BRIEF §8-3). 순수 함수 — 렌더는 `NoteNavPanel.tsx`.
//
// **왜 게임 중립인가**: 노트 타입이 게임마다 다르다(LoL·TFT는 `PatchNoteItem`, PUBG는
// `PubgNoteItem`으로 엔티티 이름 필드조차 없다). 공통분모만 `NoteNavItem`으로 받고 변환은 게임이
// 한다 — `briefingRows.ts`가 본문 행에서 쓴 것과 같은 형태다.
//
// 대상 동일성은 **`section:entity`**다. 이름만으로 묶으면 서로 다른 대상이 한 줄에 섞인다
// (LoL "오공"은 챔피언이면서 스킨 섹션에도 나오고, TFT는 유닛과 아이템이 같은 한국어 이름을 쓴다).
import type { StreamEntityIcon } from "@/components/home/releaseStreamEntity";

/** 게임이 자기 패치노트 줄을 이 모양으로 바꿔 넘긴다. */
export interface NoteNavItem {
  readonly id: string;
  readonly entity: string;
  /** 기계용 섹션 키 — 탭 상태와 대상 동일성의 재료. */
  readonly section: string;
  /** 화면에 보이는 섹션 이름. */
  readonly sectionLabel: string;
  readonly summary: string;
  /** 「Q」·「반동」처럼 한 줄을 요약하는 보조 문구. 없으면 그리지 않는다. */
  readonly detail?: string | null;
  readonly icon?: StreamEntityIcon | null;
}

export interface NoteNavGroup {
  readonly id: string;
  readonly entity: string;
  readonly section: string;
  readonly sectionLabel: string;
  readonly items: readonly NoteNavItem[];
  readonly details: readonly string[];
  readonly icon: StreamEntityIcon | null;
}

export function groupNoteNavItems(items: readonly NoteNavItem[]): NoteNavGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, { head: NoteNavItem; items: NoteNavItem[]; details: string[] }>();
  for (const item of items) {
    const key = `${item.section}:${item.entity}`;
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.items.push(item);
      if (item.detail && !bucket.details.includes(item.detail)) bucket.details.push(item.detail);
      continue;
    }
    byKey.set(key, {
      head: item,
      items: [item],
      details: item.detail ? [item.detail] : [],
    });
    order.push(key);
  }
  return order.map((key) => {
    const b = byKey.get(key)!;
    return {
      id: b.head.id,
      entity: b.head.entity,
      section: b.head.section,
      sectionLabel: b.head.sectionLabel,
      items: b.items,
      details: b.details,
      icon: b.items.find((i) => i.icon)?.icon ?? null,
    };
  });
}

export interface NoteNavSection {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

/**
 * 탭 목록 — **등장한 섹션만** 만들고, 순서는 고정이다(`SECTION_ORDER`). 게임마다 섹션 체계가 달라서(LoL 챔피언·아이템·시스템,
 * PUBG는 무기 하나) 고정 목록을 두면 어떤 게임에서는 항상 0건인 탭이 생긴다.
 * 세는 단위는 **묶음**이다 — 줄 수를 세면 탭 숫자와 목록 길이가 어긋난다.
 */
export function noteNavSections(groups: readonly NoteNavGroup[]): NoteNavSection[] {
  const order: string[] = [];
  const counts = new Map<string, { label: string; count: number }>();
  for (const g of groups) {
    const hit = counts.get(g.section);
    if (hit) hit.count += 1;
    else {
      counts.set(g.section, { label: g.sectionLabel, count: 1 });
      order.push(g.section);
    }
  }
  // 정렬은 안정적이라 「그 밖」 섹션끼리는 등장 순을 지킨다.
  return [...order]
    .sort((a, b) => sectionRank(a) - sectionRank(b))
    .map((key) => ({ key, label: counts.get(key)!.label, count: counts.get(key)!.count }));
}

/**
 * 노트 섹션 라벨 **단일 출처**(트랙 B ST-5, 2026-10-11 site-review parity-S17·parity-S16). 전에는 LoL `NAV_SECTION_LABEL`과 TFT
 * `SECTION_LABEL` 두 사본이 「시스템」·「체계」로 갈렸고, 둘 다 미등록 섹션을 내부값 그대로(`other`) 화면에 냈다. 대상 섹션
 * (`champion`)만 게임 어휘를 따르고(LoL 챔피언·TFT 유닛 — 결정 6 「표시는 게임마다 달라도 된다」) 나머지는 같은 말이다.
 * 「시스템」은 사용자 결정(2026-10-11).
 */
const SECTION_LABEL_COMMON: Record<string, string> = { item: "아이템", system: "시스템" };
const CHAMPION_LABEL: Record<"lol" | "tft", string> = { lol: "챔피언", tft: "유닛" };

export function noteSectionLabel(game: "lol" | "tft", section: string): string {
  if (section === "champion") return CHAMPION_LABEL[game];
  return SECTION_LABEL_COMMON[section] ?? "기타";
}

/** 탭 고정 순서 — 대상 → 아이템 → 시스템 → 그 밖(등장 순). 노트 등장 순이면 쌍마다 탭 순서가 바뀐다(tft-S20). */
const SECTION_ORDER = ["champion", "item", "system"];
function sectionRank(section: string): number {
  const i = SECTION_ORDER.indexOf(section);
  return i === -1 ? SECTION_ORDER.length : i;
}

/** 섹션 탭 + 검색. 질의는 대조표 도구모음이 소유하는 **그 질의**다(창이 둘이면 안 된다). */
export function filterNoteNavGroups(
  groups: readonly NoteNavGroup[],
  section: string | null,
  query: string
): NoteNavGroup[] {
  const q = query.trim().toLowerCase();
  return groups.filter((g) => {
    if (section !== null && g.section !== section) return false;
    if (!q) return true;
    return (
      g.entity.toLowerCase().includes(q) ||
      g.details.some((d) => d.toLowerCase().includes(q))
    );
  });
}
