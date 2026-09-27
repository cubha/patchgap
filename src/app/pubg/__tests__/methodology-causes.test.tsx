// src/app/pubg/__tests__/methodology-causes.test.tsx
// PUBG 방법론 「원인」 서술은 **데이터가 말하게** 한다(2026-09-27 인수검증 V7). 전에는 ① 검증 원인이 있는
// 패치에서도 「LLM 원인 추정 없음 — 후보 조항이 없습니다」를 고정으로 그렸고 ② 「대부분은 제로섬 반사」를
// 단정했다 — 43.1 실측으로 재분배 기대치(+1.9%)는 관측(+15~26%)을 설명하지 못한다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));
import { loadPubg } from "@/lib/pubgData";
import PubgMethodologyPage from "../methodology/page";

describe("PUBG 방법론 — 원인 서술", () => {
  const bundle = loadPubg();
  const verified = (bundle?.deltas.rows ?? []).reduce(
    (sum, row) => sum + (row.causes?.filter((c) => c.verified).length ?? 0),
    0
  );

  it.runIf(verified > 0)("검증 원인이 있으면 「원인 추정 없음」을 말하지 않고, 재분배 기대치를 수치로 말한다", () => {
    const text = render(<PubgMethodologyPage />).container.textContent ?? "";
    expect(text).not.toContain("LLM 원인 추정 없음");
    expect(text).not.toContain("대부분은 제로섬 반사");
    expect(text).toContain("균등 재분배 기대치는");
  });
});
