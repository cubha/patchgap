// src/components/item/__tests__/NoteContrastPanel.test.tsx
// 상세 "패치노트 대조" 렌더(2026-09-18 라운드6, 사용자 L5) — test-after(UI).
// "각 항목마다 패치노트 원문보기 link가 보임. 패치노트 내용 전부 표시하고 하단에 링크는 한번만
// (링크도 이동이 아닌 신규창열기)".
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { PatchNoteItem } from "@/pipeline/types";
import NoteContrastPanel from "../NoteContrastPanel";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:1",
    patch: "26.18",
    section: "champion",
    entity: "에코",
    skill: "Q - 시간 왜곡 수류탄",
    stat: "마나 소모량",
    before: "60",
    after: "50",
    direction: "buff",
    summary: "마나 소모량: 60 ⇒ 50",
    anchorUrl: "https://example.com/notes#patch-ekko",
    anchorKind: "entity",
    ...overrides,
  };
}

describe("NoteContrastPanel — 짝 있음", () => {
  const matched = [
    { item: note({ id: "a" }), anchorCaption: null },
    { item: note({ id: "b", skill: "E - 위상 도약", stat: "재사용 대기시간", summary: "재사용 대기시간: 9 ⇒ 8" }), anchorCaption: null },
    { item: note({ id: "c", skill: "E - 위상 도약", stat: "피해량", summary: "피해량: 70 ⇒ 80" }), anchorCaption: null },
  ];

  it("줄을 전부 보여주고 원문 링크는 하단 1개 · 새 창", () => {
    const { container } = render(<NoteContrastPanel result={{ status: "matched", matched }} />);
    expect(container.textContent).toContain("마나 소모량: 60 ⇒ 50");
    expect(container.textContent).toContain("재사용 대기시간: 9 ⇒ 8");
    expect(container.textContent).toContain("피해량: 70 ⇒ 80");
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toContain("noreferrer");
    expect(links[0].getAttribute("href")).toBe("https://example.com/notes#patch-ekko");
    // 링크가 마지막 요소다(줄 아래).
    expect(container.querySelector("a")?.compareDocumentPosition(container.querySelector("blockquote, li")!)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    );
  });

  it("같은 스킬의 줄은 스킬 소제목 아래 묶인다", () => {
    const { container } = render(<NoteContrastPanel result={{ status: "matched", matched }} />);
    const headings = Array.from(container.querySelectorAll("h3, strong")).map((h) => h.textContent);
    expect(headings.filter((t) => t === "E - 위상 도약")).toHaveLength(1);
  });
});

describe("NoteContrastPanel — 짝 없음", () => {
  it("없음 문구 + 인접 항목 + 하단 링크 1개(인접 항목의 앵커)", () => {
    const adjacent = [note({ id: "x", section: "other", skill: null, stat: null, summary: "에코 관련 기타 항목" })];
    const { container } = render(
      <NoteContrastPanel result={{ status: "unmatched", message: "26.18 패치노트에 에코 항목 없음", adjacent }} />
    );
    expect(container.textContent).toContain("26.18 패치노트에 에코 항목 없음");
    expect(container.textContent).toContain("에코 관련 기타 항목");
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("target")).toBe("_blank");
  });

  it("인접 항목도 없으면 링크가 없다", () => {
    const { container } = render(
      <NoteContrastPanel result={{ status: "unmatched", message: "26.18 패치노트에 오공 항목 없음", adjacent: [] }} />
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
