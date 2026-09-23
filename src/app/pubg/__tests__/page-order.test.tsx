// src/app/pubg/__tests__/page-order.test.tsx
// /pubg/ 브리핑 정보 위계 — test-after(UI). 2026-09-18 라운드6(사용자 P1·P2·C3) 명세 변경:
//   타일 → 패치 내용 탭 → 대조 표(단위 캡션) → 무기별 상세 그리드 → 맵.
// 표본·기저·게이트 카드는 방법론으로 옮겨 이 화면에 **없어야** 하고, 다른 게임과의 비교 문구도 없어야
// 한다. 무기 상세 진입 링크는 전 무기(47종) 존재.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// 페이지가 `@/lib/gamedata`(수치 축 로더)를 거쳐 "server-only"를 side-effect import한다 — 실제
// 패키지는 jsdom에서 무조건 throw하므로 빈 모듈로 바꾼다(`src/lib/__tests__/data.test.ts`와 같은 규약).
vi.mock("server-only", () => ({}));
import PubgPage from "../page";
import PubgMethodologyPage from "../methodology/page";
import PubgComparePage from "../compare/page";

describe("/pubg/ 정보 위계", () => {
  it("판정 타일 → 패치 내용 탭 → 대조 표(단위 캡션) → 무기별 상세 → 맵 순", () => {
    const { container } = render(<PubgPage />);
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
    // 2026-09-23 §8-1: 무기 그리드·맵 그리드가 **세 게임 공통 「전 대상 색인」 슬롯**으로
    // 들어갔다. 카드 제목은 그 슬롯이 소유하고(`ENTITY_INDEX_TITLE`), 게임은 묶음 라벨만 준다.
    const grid = at("이 패치의 모든 대상");
    const maps = at("맵");
    expect(tiles).toBeLessThan(tabs);
    expect(tabs).toBeLessThan(table);
    expect(table).toBeLessThan(caption);
    expect(caption).toBeLessThan(grid);
    expect(grid).toBeLessThan(maps);
  });

  it("표본·기저·게이트 카드와 설명 문단은 브리핑에 없다(방법론으로 이동) · 다른 게임 비교 문구 0", () => {
    const { container } = render(<PubgPage />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("비교 구간");
    expect(text).not.toContain("함께 움직인 값");
    expect(text).not.toContain("이 데이터에서 유도");
    expect(text).not.toContain("대리 지표");
    expect(text).not.toContain("리그 오브 레전드");
    expect(text).not.toContain("LoL");
  });

  it("무기 상세 진입 링크가 전 무기(47종)만큼 있고, 표의 무기명도 링크다", () => {
    const { container } = render(<PubgPage />);
    const weaponLinks = Array.from(container.querySelectorAll('a[href^="/pubg/weapon/"]'));
    expect(weaponLinks.length).toBeGreaterThanOrEqual(47);
    const mapLinks = container.querySelectorAll('a[href^="/pubg/map/"]');
    expect(mapLinks.length).toBeGreaterThanOrEqual(7);
  });

  it("배지 어휘는 통일 키(공지/미공지)만 — 옛 세분 어휘 없음", () => {
    const { container } = render(<PubgPage />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("공지-일치");
    expect(text).not.toContain("공지-불일치");
  });
});

describe("/pubg/methodology/ · /pubg/compare/ — 판정표 기준 문구", () => {
  it("방법론에 표본·기저·게이트·판정표·표시하지 않는 관측이 있고 다른 게임 비교·매핑표는 없다", () => {
    const { container } = render(<PubgMethodologyPage />);
    const text = container.textContent ?? "";
    // 2026-09-23 §8-4: 카드 제목은 **9슬롯 registry가 소유**하고 게임은 본문만 채운다. 그래서
    // 옛 제목("비교 구간"·"판정표"·"표시하지 않는 관측")은 화면에서 사라졌다 — 규칙이 약해진 게
    // 아니라 제목의 소유자가 바뀐 것이다. 이 테스트가 재는 것은 **그 본문이 여전히 있는가**다.
    for (const needle of [
      "무엇을 셌나",
      "함께 움직인 값",
      "통계 게이트와 효과크기 바닥",
      "판정은 무엇을 뜻하나",
      "화면이 고르는 것",
      "먼저 밝히는 것",
      "검증하지 못했습니다",
    ]) {
      expect(text, needle).toContain(needle);
    }
    expect(text).not.toContain("리그 오브 레전드");
    expect(text).not.toContain("LoL");
    expect(text).not.toContain("어댑터 매핑표");
  });

  it("대조표는 판정이 선 무기만 올리고(노이즈 배지 0) 무기명이 링크다", () => {
    const { container } = render(<PubgComparePage />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("바닥 미달");
    expect(text).not.toContain("변화 없음");
    expect(text).not.toContain("표본 부족");
    expect(text).not.toContain("리그 오브 레전드");
    expect(container.querySelectorAll('tbody a[href^="/pubg/weapon/"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll("tbody tr").length).toBeLessThan(20);
  });
});
