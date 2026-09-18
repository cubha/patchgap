// src/app/pubg/__tests__/page-order.test.tsx
// /pubg/ 브리핑 정보 위계(ST5, 2026-09-18 채점 라운드5 A3) — test-after(UI).
// 타일 → 탭(결과 표) → 표본·기저·게이트 카드 순이어야 한다. 이전엔 카드 3장이 결과 위에 있었고,
// 그 배치를 "승인 시안"이라 불렀지만 실물 시안(「PUBG 테마 시안」)은 히어로·stat-tile까지만
// 정의한다(BRAINTRUST-residual3 §0). 이 테스트는 순서를 **기계로 고정**한다 — `src/app/pubg`에
// 페이지 테스트가 0개라 순서 회귀를 어떤 게이트도 못 잡았다.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AmbientProvider } from "@/components/AmbientContext";
import PubgPage from "../page";

/** 헤더의 인트로 재생 버튼이 useAmbient()를 읽는다 — layout.tsx의 Provider를 테스트에서 대신 감싼다. */
function page() {
  return render(
    <AmbientProvider>
      <PubgPage />
    </AmbientProvider>
  );
}

describe("/pubg/ 정보 위계", () => {
  it("판정 타일 → 패치 내용 탭 → 대조 표(점유율 캡션) → 표본·기저·게이트 카드 순", () => {
    const { container } = page();
    const text = container.textContent ?? "";
    const at = (needle: string) => {
      const i = text.indexOf(needle);
      expect(i, `"${needle}" 미렌더`).toBeGreaterThanOrEqual(0);
      return i;
    };
    const tiles = at("공지된 변화 (43.1 패치노트)");
    const tabs = at("패치 내용");
    const table = at("공지된 변경은 실제로 그렇게 됐나");
    const caption = at("총 획득 대비");
    const sample = at("비교 구간");
    const baseline = at("함께 움직인 값");
    const gate = at("이 데이터에서 유도"); // 게이트 카드 본문 — "효과크기 바닥"은 타일 2에도 있어 모호하다
    const maps = at("어디서 얼마나 싸웠나");
    expect(tiles).toBeLessThan(tabs);
    expect(tabs).toBeLessThan(table);
    expect(table).toBeLessThan(caption);
    expect(caption).toBeLessThan(sample);
    expect(sample).toBeLessThan(baseline);
    expect(baseline).toBeLessThan(gate);
    expect(gate).toBeLessThan(maps);
  });

  it("표 머리 캡션이 정규화 사실과 표본 매치 수를 말한다 — 기저 카드가 아래로 내려간 대가", () => {
    const { container } = page();
    const caption = Array.from(container.querySelectorAll("p")).find((p) => p.textContent?.includes("총 획득 대비"));
    expect(caption).toBeDefined();
    expect(caption?.textContent).toContain("점유율");
    expect(caption?.textContent).toMatch(/[\d,]+ → [\d,]+매치/);
  });
});
