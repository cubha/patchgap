// src/components/gamedata/__tests__/SubmarineCell.test.tsx
// 「바뀐 것」 칸의 **렌더 계약**. 행 객체가 아니라 화면을 본다.
//
// 왜 렌더 레벨이어야 하나(2026-09-21, 이 세션에서 세 번째 같은 형태): `row.submarineChanges`가
// 채워진 채 아무도 안 읽어서 대조표가 배지만 찍고 값을 말하지 않던 결함이 있었다. 행 객체를
// 검사하는 테스트는 그것을 **통과시킨다** — 데이터는 맞았기 때문이다
// ([[feedback_verification_asks_wrong_question]]).
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import SubmarineCell from "../SubmarineCell";
import type { GameDataChange } from "@/pipeline/gamedata/types";

function change(field: string, before: number, after: number): GameDataChange {
  return {
    id: `gdc:tft:18.2:E:${field}`,
    entityKey: "E",
    entityName: "덩굴정령",
    entityType: "unit",
    field,
    fieldPath: field,
    before,
    after,
    relChange: (after - before) / before,
    matchedNoteIds: [],
  };
}

const mismatch: GameDataChange = {
  ...change("공격력", 110, 115),
  matchedNoteIds: ["note-1"],
  noteMismatch: { noteId: "note-1", noteBefore: "115", noteAfter: "120" },
};

describe("SubmarineCell", () => {
  it("둘 다 없으면 관측 없음과 같은 어휘를 쓴다", () => {
    const { container } = render(<SubmarineCell changes={[]} />);
    expect(container.textContent).toContain("—");
  });

  it("잠수함만 있으면 첫 건 + 외 N건", () => {
    const { container } = render(
      <SubmarineCell changes={[change("체력", 850, 950), change("방어력", 70, 75)]} />
    );
    expect(container.textContent).toContain("체력");
    expect(container.textContent).toContain("외 1건");
  });

  it("불일치만 있으면 배지와 노트 값을 함께 그린다", () => {
    const { container } = render(<SubmarineCell changes={[]} mismatchChanges={[mismatch]} />);
    expect(container.textContent).toContain("공지값 불일치");
    expect(container.textContent).toContain("110");
    expect(container.textContent).toContain("노트 115 ⇒ 120");
  });

  it("★ 둘 다 있으면 둘 다 그린다 — 접는 칸에서도", () => {
    const { container } = render(
      <SubmarineCell changes={[change("체력", 850, 950)]} mismatchChanges={[mismatch]} />
    );
    expect(container.textContent).toContain("체력");
    expect(container.textContent).toContain("노트 115 ⇒ 120");
  });

  it("★ 둘 다 있으면 둘 다 그린다 — 접지 않는 칸에서도", () => {
    const { container } = render(
      <SubmarineCell
        changes={[change("체력", 850, 950)]}
        mismatchChanges={[mismatch]}
        collapsible={false}
      />
    );
    expect(container.textContent).toContain("체력");
    expect(container.textContent).toContain("노트 115 ⇒ 120");
  });

  it("float32 잡음은 화면에 나가지 않는다", () => {
    const { container } = render(
      <SubmarineCell changes={[change("공격 속도", 0.800000011920929, 0.8500000238418579)]} />
    );
    expect(container.textContent).not.toContain("0.800000011920929");
    expect(container.textContent).toContain("0.8");
  });
});
