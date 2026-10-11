// src/pipeline/gamedata/revert.ts
// 수치 축 **원복** 감지(트랙 B ST-19, 2026-10-11 site-review tft-S19) — 순수 함수, 산출물 재생성 없이 빌드 타임에 쓴다.
//
// 리뷰 실측: TFT 18.4 다이애나 「최대 마나 30 → 40」은 18.1→18.2의 「40 → 30」을 되돌린 것인데, 화면은 이전 쌍 맥락 없이 잠수함으로만
// 말했다. 판정(잠수함 여부)은 바꾸지 않는다 — 원복도 이번 노트가 말하지 않은 변경이다. 행에 「{패치} 변경 원복」 맥락만 붙인다.
//
// 규칙: 직전 쌍들을 **최신부터** 거슬러 같은 대상(종류·키)·같은 필드(`fieldPath`)의 변경을 찾는다. 처음 만난 그 필드 변경이 정확히
// 반대(before/after 교차)면 원복이고 그 쌍의 `to` 패치를 단다. 처음 만난 변경이 반대가 아니면(사이에 다른 값으로 또 바뀜) 원복이 아니다.
import type { GameDataChange } from "./types";

const fieldKey = (c: Pick<GameDataChange, "entityType" | "entityKey" | "fieldPath">) => `${c.entityType}:${c.entityKey}:${c.fieldPath}`;
const same = (a: number | string | null, b: number | string | null) => a !== null && b !== null && String(a) === String(b);

export function findReverts(
  current: readonly GameDataChange[],
  previous: readonly { to: string; changes: readonly GameDataChange[] }[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const change of current) {
    const key = fieldKey(change);
    for (const pair of previous) {
      const prior = pair.changes.find((c) => fieldKey(c) === key);
      if (!prior) continue;
      if (same(prior.before, change.after) && same(prior.after, change.before)) out[change.id] = pair.to;
      break;
    }
  }
  return out;
}
