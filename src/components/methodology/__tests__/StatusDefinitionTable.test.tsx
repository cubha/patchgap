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
    // 2026-09-18 S6 명세 변경(동의어 교체, 뜻 불변).
    expect(container.textContent).toContain("바닥 미달");
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

  // 2026-09-18(채점 라운드4, acceptance-critic V7) — 표시 전용 키가 회귀해도 위 테스트는
  // 못 잡는다: `toContain("바닥 미달")`이 "공지 · 바닥 미달"의 부분 문자열이기도 해서 둘 중
  // 하나만 남아도 통과한다. 행 수와 각 키를 따로 고정한다.
  it("표시 전용 키 2종(공지 · 관측 미확인 · 공지 · 바닥 미달)이 각각 한 행을 갖는다", () => {
    const { container } = render(
      <StatusDefinitionTable minN={200} alpha={0.1} floors={EFFECT_SIZE_FLOORS} />
    );
    const rows = container.querySelectorAll("tbody tr");
    // 판정 상태 7종 + 표시 전용 2종(announced-unobserved: M2 · announced-below-floor: CF-1/CF-2)
    expect(rows).toHaveLength(9);
    expect(container.textContent).toContain("공지 · 관측 미확인");
    expect(container.textContent).toContain("공지 · 바닥 미달");
  });

  it("홈이 추가로 거는 효과크기 바닥 게이트를 캡션이 고지한다", () => {
    const { container } = render(
      <StatusDefinitionTable minN={200} alpha={0.1} floors={EFFECT_SIZE_FLOORS} />
    );
    // 실측 26.17→26.18: announced-consistent 32건 중 20건(63%)이 바닥 미달이라, 이 고지가
    // 없으면 상세("공지-일치")와 홈("관측 변화 없음")이 서로를 반박하는 것처럼 읽힌다.
    expect(container.textContent).toContain("효과크기 바닥");
    expect(container.textContent).toContain("한 번 더 통과한 행");
  });
});
