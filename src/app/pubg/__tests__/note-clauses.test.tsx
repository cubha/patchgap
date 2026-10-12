// src/app/pubg/__tests__/note-clauses.test.tsx
// PUBG 「패치 내용」 탭이 조항 전부를 말한다(트랙 B ST-4, pubg-S6) — test-after(UI).
// 탭 배지·타일 부제의 「조항 N」과 탭 안 조항 목록의 수가 같고, 기대값이 없는 조항은 「측정 불가」로 회색이다.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));
import PubgPage from "../page";
import { loadPubg } from "@/lib/pubgData";

describe("/pubg/ 패치 내용 탭 조항 목록", () => {
  const bundle = loadPubg();
  it("커밋된 PUBG 쌍이 있다", () => expect(bundle).not.toBeNull());
  it("조항 수 = 노트 수, 측정 불가 조항 수 = 기대값 없는 노트 수", () => {
    if (!bundle) return;
    const { container } = render(<PubgPage />);
    const clauses = container.querySelectorAll("[data-note-clause]");
    expect(clauses.length).toBe(bundle.notes.length);
    const unmeasurable = container.querySelectorAll('[data-note-clause="unmeasurable"]');
    expect(unmeasurable.length).toBe(bundle.notes.filter((n) => n.expectedRelChange === null).length);
    for (const el of unmeasurable) expect(el.textContent).toContain("이 데이터로 측정 불가");
    expect(container.textContent).toContain(`패치노트 조항 ${bundle.notes.length}건`);
  });
});
