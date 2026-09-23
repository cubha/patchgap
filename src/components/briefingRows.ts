// src/components/briefingRows.ts
// 브리핑 본문 행의 **조립 규칙** — 세는 단위는 값이 아니라 **대상**이다(UX-BRIEF §8-2).
//
// **왜 순수 함수인가**: 이 규칙이 깨지는 방식은 "게임마다 자기 표를 자기 방식으로 그리는 것"이다.
// 게임별 행 타입(`DeltaRecord` · `PubgDeltaRow`)은 서로 다르지만 **묶는 규칙은 같아야 한다** —
// 그 공통분모만 `BriefingItem`으로 받고, 변환은 각 게임이 한다(§8-0: 데이터 필드는 달라도 된다).
// 렌더 없이 판정할 수 있어야 회귀를 테스트가 막는다.
import type { DisplayStatus } from "@/pipeline/shared/display-status";

/** 게임이 자기 행을 이 모양으로 바꿔 넘긴다. 필드 이름·단위는 게임 몫, 묶는 규칙은 여기 몫. */
export interface BriefingItem {
  /** 델타 id — React key이자 원인 색인의 열쇠. */
  readonly id: string;
  readonly entityKey: string;
  readonly entityName: string;
  /**
   * 기계용 유형(`unit`·`item`·`weapon`) — **대상 동일성과 상세 경로의 재료**다.
   * 화면에 보이는 라벨은 `typeLabel`이 따로 든다: 둘을 한 필드로 합치면 경로가 한국어가 되거나
   * 화면에 `unit`이 나온다(실측으로 둘 다 밟았다).
   */
  readonly entityType: string;
  /** 「유닛」·「무기」처럼 사람이 읽는 유형. 비우면 그 칸을 그리지 않는다. */
  readonly typeLabel?: string;
  readonly status: DisplayStatus;
  /** 지표 이름(「평균 등수」·「획득 점유율」). */
  readonly field: string;
  /** 변화 표기(「4.16등 → 4.52등」) — 포맷은 게임이 이미 끝낸 문자열로 받는다. */
  readonly change: string;
  /** Δ 표기와 방향. 없으면 그 칸을 그리지 않는다. */
  readonly delta?: { readonly text: string; readonly improved: boolean } | null;
  /** 패치노트 원문 앵커. 없으면 근거 링크를 걸지 않는다(무근거 회색 원칙). */
  readonly noteAnchor?: string | null;
}

export interface BriefingGroup {
  readonly entityKey: string;
  readonly entityName: string;
  readonly entityType: string;
  readonly typeLabel: string;
  /**
   * 그룹 대표 상태 — **첫 항목의 상태**다. 게임이 이미 표시 우선순위로 정렬해 넘기므로
   * 여기서 다시 고르면 두 화면이 서로 다른 중요도를 주장하게 된다(대조표와 같은 규율).
   */
  readonly status: DisplayStatus;
  readonly items: readonly BriefingItem[];
}

/**
 * 같은 대상의 항목을 한 그룹으로 묶는다. **입력 순서를 보존한다** — 정렬은 호출부(게임)의
 * 책임이고, 여기서 다시 정렬하면 "표가 왜 이 순서인가"의 답이 두 곳으로 갈린다.
 *
 * 대상 동일성은 `entityType:entityKey`다. 이름이 아니다 — TFT에는 같은 이름의 유닛·아이템이
 * 있고(예: 특성과 아이템이 같은 한국어 이름을 쓰는 경우), 이름으로 묶으면 서로 다른 대상이
 * 한 행에 섞인다.
 */
export function groupBriefingItems(items: readonly BriefingItem[]): BriefingGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, BriefingItem[]>();
  for (const item of items) {
    const key = `${item.entityType}:${item.entityKey}`;
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      byKey.set(key, [item]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const bucket = byKey.get(key)!;
    const head = bucket[0];
    return {
      entityKey: head.entityKey,
      entityName: head.entityName,
      entityType: head.entityType,
      typeLabel: head.typeLabel ?? "",
      status: head.status,
      items: bucket,
    };
  });
}

/** 「N개 항목」 — 그룹이 몇 개의 값을 들고 있는지. 1건이어도 숨기지 않는다(세 게임이 같은 말을 한다). */
export function itemCountLabel(group: BriefingGroup): string {
  return `${group.items.length}개 항목`;
}
