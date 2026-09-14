import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import StatusDefinitionTable from "../StatusDefinitionTable";
import { EFFECT_SIZE_FLOORS } from "@/pipeline/aggregate/stats";

describe("StatusDefinitionTable", () => {
  it("7개 상태(no-change·below-threshold·indirect-effect 포함)를 모두 렌더하고 게이트 값을 조건 열에 반영한다", () => {
    const { container } = render(
      <StatusDefinitionTable
        minN={200}
        alpha={0.1}
        floors={EFFECT_SIZE_FLOORS}
      />
    );
    expect(container.textContent).toContain("공지-일치");
    expect(container.textContent).toContain("공지-불일치");
    expect(container.textContent).toContain("미공지");
    expect(container.textContent).toContain("표본 부족");
    expect(container.textContent).toContain("변화 없음");
    expect(container.textContent).toContain("임계 미달");
    expect(container.textContent).toContain("간접 영향");
    expect(container.textContent).toContain("confidence≥medium");
    expect(container.textContent).toContain("n<200");
    expect(container.textContent).toContain("q<0.1");
    expect(container.textContent).toContain("픽 2%p");
    expect(container.textContent).toContain("밴 3%p");
    expect(container.textContent).toContain("채택률 상대 25%");
    expect(container.textContent).toContain("채택률 1% 미만");
    expect(container.textContent).toContain("라인 골드 상대 3%");
    expect(container.textContent).toContain("오브젝트 30초");
    expect(container.textContent).toContain("경기 시간 60초");
  });
});
