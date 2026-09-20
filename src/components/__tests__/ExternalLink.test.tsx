// src/components/__tests__/ExternalLink.test.tsx
// 외부 링크 단일 소유자 — 새 창 + rel 보호가 **한 곳**에서만 붙는다는 계약을 고정한다.
// 프로젝트 관례대로 jest-dom 매처 없이 container를 직접 querying한다.
//
// 실측 배경(2026-09-20): 라운드6(`a669fb2`)에서 "패치노트 원문은 새 창으로"를 네 군데에 손으로
// 붙였는데 같은 항목 상세 화면의 형제 패널(CausesPanel)이 빠져, 추정 원인(LLM)의 인용 링크만
// 같은 탭으로 나갔다. 사용자가 같은 요구를 두 번 말해야 했던 결함이라 아래 두 축으로 막는다:
// ① 이 테스트가 컴포넌트 계약을 고정 ② `verify.sh` Spec 4c가 이 파일 밖의 `target="_blank"`를 차단.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import ExternalLink from "../ExternalLink";
import CausesPanel from "../item/CausesPanel";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";

describe("ExternalLink", () => {
  it("새 창으로 열고 opener·referrer를 끊는다", () => {
    const { container } = render(
      <ExternalLink href="https://example.com/patch#x">원문</ExternalLink>
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com/patch#x");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("className을 그대로 넘긴다 — 소비처의 표기 자유를 뺏지 않는다", () => {
    const { container } = render(
      <ExternalLink href="https://example.com" className="text-accent">x</ExternalLink>
    );
    expect(container.querySelector("a")?.className).toBe("text-accent");
  });
});

function note(overrides: Partial<PatchNoteItem> & { id: string }): PatchNoteItem {
  return {
    patch: "26.18",
    section: "champion",
    entity: "비에고",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "요약",
    anchorUrl: "https://www.leagueoflegends.com/ko-kr/news/x/#patch-viego",
    anchorKind: "entity",
    modeScope: "core",
    ...overrides,
  };
}

function cause(overrides: Partial<DeltaRecord["causes"][number]>): DeltaRecord["causes"][number] {
  return {
    text: "비에고 지속효과 회복량이 확대돼 정글 우위가 옮겨갔습니다.",
    candidateNoteId: "note:viego",
    verified: true,
    confidence: "medium",
    ...overrides,
  };
}

describe("CausesPanel — 인용 링크(사용자 재지적 2026-09-20)", () => {
  const notesById = new Map<string, PatchNoteItem>([["note:viego", note({ id: "note:viego" })]]);

  it("검증된 원인의 원문 링크는 새 창으로 나간다", () => {
    const { container } = render(
      <CausesPanel causes={[cause({})]} llm={undefined} notesById={notesById} generatedAt={null} />
    );
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a?.getAttribute("href")).toContain("#patch-viego");
  });

  // 신뢰도 low는 회색으로만 두되(2026-09-18 ST-2) 링크 성질은 같아야 한다 —
  // 색이 다르다고 같은 탭으로 나가면 사용자에게는 같은 결함이다.
  it("신뢰도 낮음도 같은 규칙으로 새 창이다", () => {
    const { container } = render(
      <CausesPanel
        causes={[cause({ confidence: "low" })]}
        llm={undefined}
        notesById={notesById}
        generatedAt={null}
      />
    );
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_blank");
  });

  it("인용 노트가 없으면 링크 자체를 만들지 않는다 — 무근거 문장은 회색", () => {
    const { container } = render(
      <CausesPanel
        causes={[cause({ verified: false, candidateNoteId: null })]}
        llm={undefined}
        notesById={notesById}
        generatedAt={null}
      />
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("인용 노트 없음");
  });
});
