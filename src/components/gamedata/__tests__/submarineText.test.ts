// src/components/gamedata/__tests__/submarineText.test.ts
// RED 먼저 — 대조표 「바뀐 것」 열의 텍스트 규칙(PLAN ST-9가 요구했으나 만들어지지 않은 항목).
//
// 이 함수가 **직접 `gameDataValue`를 부르는 것**이 설계의 핵심이다. 호출부가 원본 float를
// 그대로 넘길 방법을 없앤다 — 같은 잡음(`0.800000011920929`)이 비교 축에서는 `sameNumber()`에
// 막히고 표시 축에서는 아무도 안 막아 프로덕션에 나갔던 적이 있다(2026-09-21, 커밋 2f1fe9e).
import { describe, it, expect } from "vitest";

import { submarineCellText } from "../submarineText";
import type { GameDataChange } from "@/pipeline/gamedata/types";

function change(over: Partial<GameDataChange>): GameDataChange {
  return {
    id: "gdc:tft:18.2:DA_18_ElderDragon:공격력",
    entityKey: "DA_18_ElderDragon",
    entityName: "장로 드래곤",
    entityType: "unit",
    field: "공격력",
    fieldPath: "공격력",
    before: 110,
    after: 125,
    relChange: 15 / 110,
    matchedNoteIds: [],
    ...over,
  };
}

describe("submarineCellText — 표에서 「바뀐 것」을 한 줄로 말한다", () => {
  it("없으면 null — 빈 칸을 부르는 쪽이 정한다", () => {
    expect(submarineCellText([])).toBeNull();
  });

  it("한 건이면 필드와 전/후를 그대로 말한다", () => {
    expect(submarineCellText([change({})])).toEqual({
      field: "공격력",
      before: "110",
      after: "125",
      rest: 0,
    });
  });

  it("★ float32 잡음은 이 함수가 접는다 — 호출부가 원본을 넘겨도", () => {
    const noisy = submarineCellText([
      change({ field: "공격 속도", before: 0.800000011920929, after: 0.8500000238418579 }),
    ]);
    expect(noisy).toEqual({ field: "공격 속도", before: "0.8", after: "0.85", rest: 0 });
  });

  it("여러 건이면 첫 건 + 나머지 개수 — 전부는 상세에서 본다", () => {
    const rows = submarineCellText([
      change({ field: "방어력", before: 70, after: 75 }),
      change({ field: "공격력", before: 110, after: 125 }),
      change({ field: "마법 저항력", before: 70, after: 75 }),
    ]);
    expect(rows).toEqual({ field: "방어력", before: "70", after: "75", rest: 2 });
  });

  it("배열 문자열 값(`75/115/155`)도 그대로 통과한다 — 숫자만 다루지 않는다", () => {
    expect(submarineCellText([change({ field: "피해량", before: "75/115/155", after: "80/120/160" })])).toEqual({
      field: "피해량",
      before: "75/115/155",
      after: "80/120/160",
      rest: 0,
    });
  });

  it("null은 「없음」 — 필드가 사라진 것과 0인 것은 다르다", () => {
    expect(submarineCellText([change({ field: "가격", before: null, after: 3200 })])).toEqual({
      field: "가격",
      before: "없음",
      after: "3200",
      rest: 0,
    });
  });
});
