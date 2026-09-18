import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import StatusDefinitionTable from "../StatusDefinitionTable";
import { EFFECT_SIZE_FLOORS } from "@/pipeline/aggregate/stats";

// 2026-09-18 라운드6(사용자 C5·C1) 명세 변경: 표는 화면 어휘 기준이다 — 표시 키 3종(공지 / 공지 · 이상 관측 /
// 미공지) + 표시하지 않는 관측 3종(바닥 미달 / 표본 부족 / 변화 없음). 옛 세분 어휘(공지-일치·공지-불일치·
// 관측 미확인·공지 · 바닥 미달·간접 영향)는 표에서 사라졌다.
describe("StatusDefinitionTable", () => {
  function table() {
    return render(<StatusDefinitionTable minN={200} alpha={0.1} floors={EFFECT_SIZE_FLOORS} />);
  }

  it("표시 키 3종 + 표시하지 않는 관측 3종 = 6행이고 게이트 값을 조건 열에 반영한다", () => {
    const { container } = table();
    const text = container.textContent ?? "";
    const badges = Array.from(container.querySelectorAll("tbody td:first-child span")).map((s) => s.textContent?.trim());
    expect(badges.filter(Boolean)).toEqual(["공지", "공지 · 이상 관측", "미공지", "바닥 미달", "표본 부족", "변화 없음"]);
    expect(text).toContain("표시하지 않는 관측");
    expect(text).toContain("n<200");
    expect(text).toContain("q<0.1");
    expect(text).toContain("픽 2%p");
    expect(text).toContain("밴 3%p");
    expect(text).toContain("채택률 상대 25%");
    expect(text).toContain("채택률 1% 미만");
    expect(text).toContain("라인 골드 상대 3%");
    expect(text).toContain("오브젝트 30초");
    expect(text).toContain("경기 시간 60초");
  });

  it("옛 세분 어휘가 없다", () => {
    const { container } = table();
    const text = container.textContent ?? "";
    for (const old of ["공지-일치", "공지-불일치", "관측 미확인", "공지 · 바닥 미달", "간접 영향"]) {
      expect(text, old).not.toContain(old);
    }
  });

  it("홈이 추가로 거는 유의성·효과크기 바닥 게이트를 캡션이 고지한다", () => {
    const { container } = table();
    expect(container.textContent).toContain("효과크기 바닥");
    expect(container.textContent).toContain("한 번 더 통과한 행");
  });
});
