// src/app/pubg/__tests__/zero-verdict.test.tsx
// 결정 8(선언 축은 항상 최신)의 PUBG 화면판 — 새 패치의 표본이 얇아 **보고 자격 판정이 0건**이어도
// 화면이 깨지지 않고 패치노트를 보여준다(2026-09-27). 전에는 `loadPubg`가 판정 0건이면 null을 돌려
// PUBG 전체가 사라졌고, 그 게이트를 걷으면서 "빈 판정에 가정을 건 코드"가 없는지 렌더로 확인한다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pubgData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pubgData")>();
  return {
    ...actual,
    loadPubg: () => {
      const bundle = actual.loadPubg();
      if (!bundle) return null;
      const rows = bundle.deltas.rows.map((row) => ({
        ...row,
        status: "insufficient-sample" as const,
        matchedNoteId: null,
        matchedNoteIds: [],
        causes: [],
        llm: undefined,
      }));
      return { ...bundle, deltas: { ...bundle.deltas, rows } };
    },
  };
});

import { loadPubg } from "@/lib/pubgData";
import { isReportable } from "@/pipeline/shared/pubg-status";
import PubgPage from "../page";
import PubgComparePage from "../compare/page";
import PubgMethodologyPage from "../methodology/page";

describe("PUBG — 보고 자격 판정 0건", () => {
  it("전제: 모의 번들의 보고 자격 판정이 0건이다", () => {
    const bundle = loadPubg();
    expect(bundle).not.toBeNull();
    expect(bundle?.deltas.rows.filter((row) => isReportable(row.status))).toHaveLength(0);
  });

  it("브리핑이 깨지지 않고 패치노트 탭을 그린다", () => {
    const { container } = render(<PubgPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("패치 내용");
    const firstNote = loadPubg()?.notes[0];
    expect(firstNote).toBeDefined();
  });

  it("대조표·방법론도 깨지지 않는다", () => {
    expect(() => render(<PubgComparePage />)).not.toThrow();
    expect(() => render(<PubgMethodologyPage />)).not.toThrow();
  });
});
