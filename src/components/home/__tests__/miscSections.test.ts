// src/components/home/__tests__/miscSections.test.ts
// 홈 "기타 변경" 묶음(2026-09-18 라운드6, 사용자 L2) — TDD RED 먼저.
// 사용자: "버그수정, 증강, 버그수정 및 편의성 개선, ... 등 관측변화없음 전체항목은 하나의 섹션으로
// 묶여야함 … 관측없음 뱃지 불필요. 단, 버그수정이면 버그수정, 편의성개선은 편의성개선, 신규스킨 테마
// 등은 신규스킨 등 Value별로 묶어 섹션이 명확하게 구분되게".
// 입력은 섹션 묶음(tier 3)·치장(tier 4) 그룹이고, 출력은 카테고리별 줄 목록(문서 순서)이다.
import { describe, expect, it } from "vitest";
import type { PatchNoteItem } from "@/pipeline/types";
import type { MatchedStreamGroup } from "../releaseStream";
import { MISC_CATEGORY_LABELS, buildMiscSections, classifyMiscNote } from "../miscSections";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:26.18:system:x:0000",
    patch: "26.18",
    section: "system",
    entity: "버그 수정",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "요약",
    anchorUrl: "https://example.com/#patch-classic",
    anchorKind: "section",
    ...overrides,
  };
}

function group(entity: string, notes: PatchNoteItem[]): MatchedStreamGroup {
  return { kind: "matched", entity, notes };
}

describe("classifyMiscNote", () => {
  it("클래식 모드 섹션(#patch-classic)의 챔피언 줄 → mode(라운드6 재판정 보완 1: 26.18 '피오라' 65줄)", () => {
    expect(classifyMiscNote(note({ section: "champion", entity: "피오라", skill: "Q - 찌르기", summary: "피오라가 돌진하여 주변 적을 공격합니다." }))).toBe("mode");
    expect(MISC_CATEGORY_LABELS.mode).toBe("게임 모드(클래식)");
    // 같은 앵커 아래라도 이름이 카테고리를 말하는 줄은 이름 규칙이 먼저다.
    expect(classifyMiscNote(note({ entity: "버그 수정", summary: "버그를 수정했습니다." }))).toBe("bugfix");
  });

  it("버그 수정 묶음 → bugfix", () => {
    expect(classifyMiscNote(note({ entity: "버그 수정", summary: "티모의 버섯 함정이 정상적으로 지속되지 않던 버그를 수정했습니다." }))).toBe("bugfix");
  });

  it("'버그 수정 및 편의성 개선' 묶음은 줄마다 가른다 — 버그가 있으면 bugfix, 아니면 qol", () => {
    expect(classifyMiscNote(note({ entity: "버그 수정 및 편의성 개선", summary: "내셔 남작 중첩이 높게 적용되던 버그를 수정했습니다." }))).toBe("bugfix");
    expect(classifyMiscNote(note({ entity: "버그 수정 및 편의성 개선", summary: "관전자 카메라 컨트롤러 사전 설정이 추가되었습니다." }))).toBe("qol");
  });

  it("치장(스킨·크로마·홀 오브 레전드·클래식) → cosmetic", () => {
    expect(classifyMiscNote(note({ entity: "홀 오브 레전드", summary: "떠오른 전설 오리아나 스킨 및 테두리" }))).toBe("cosmetic");
    expect(classifyMiscNote(note({ entity: "앞으로 나올 스킨 및 크로마", section: "other", summary: "이번 패치 기간에 다음과 같은 스킨이 출시됩니다." }))).toBe("cosmetic");
    expect(classifyMiscNote(note({ entity: "클래식", summary: "클래식 스킨 크로마 지급 방식이 변경됩니다." }))).toBe("cosmetic");
  });

  it("증강(아수라장) → augment — 요약에 '버그'가 있어도 증강이 우선", () => {
    expect(classifyMiscNote(note({ entity: "증강", section: "other", skill: "광대 대학", summary: "신규 상태: 다시 활성화되었습니다." }))).toBe("augment");
    expect(classifyMiscNote(note({ entity: "증강", section: "other", summary: "버그로 비활성화됐던 증강을 되살렸습니다." }))).toBe("augment");
  });

  it("그 외 섹션 묶음(챔피언 변경·아트·시스템 사양 업데이트) → other", () => {
    expect(classifyMiscNote(note({ entity: "시스템 사양 업데이트", summary: "macOS 최소 및 권장 사양이 업데이트되었습니다." }))).toBe("other");
    expect(classifyMiscNote(note({ entity: "아트", summary: "아트 업데이트: 누락된 수풀과 데칼이 추가됩니다." }))).toBe("other");
  });
});

describe("buildMiscSections", () => {
  const groups = [
    group("홀 오브 레전드", [note({ id: "h1", entity: "홀 오브 레전드", summary: "떠오른 전설 오리아나 스킨" })]),
    group("버그 수정", [
      note({ id: "b1", summary: "버그를 수정했습니다 1" }),
      note({ id: "b2", summary: "버그를 수정했습니다 2" }),
    ]),
    group("증강", [note({ id: "a1", entity: "증강", section: "other", summary: "신규 증강" })]),
    group("버그 수정 및 편의성 개선", [
      note({ id: "q1", entity: "버그 수정 및 편의성 개선", summary: "컨트롤러 사전 설정이 추가되었습니다." }),
      note({ id: "b3", entity: "버그 수정 및 편의성 개선", summary: "중첩 버그를 수정했습니다." }),
    ]),
  ];

  it("카테고리 순서는 버그 수정 → 편의성 개선 → 신규 스킨·치장 → 증강 → 기타이고, 빈 카테고리는 없다", () => {
    const sections = buildMiscSections(groups);
    expect(sections.map((s) => s.category)).toEqual(["bugfix", "qol", "cosmetic", "augment"]);
    expect(sections.map((s) => s.label)).toEqual(["버그 수정", "편의성 개선", "신규 스킨·치장", "증강"]);
  });

  it("같은 카테고리의 줄은 그룹을 넘어 문서 순서로 합쳐진다(버그 수정 3줄 = b1·b2·b3)", () => {
    const bug = buildMiscSections(groups).find((s) => s.category === "bugfix");
    expect(bug?.notes.map((n) => n.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("총 줄 수는 입력 줄 수와 같다 — 줄을 잃지 않는다", () => {
    const total = buildMiscSections(groups).reduce((sum, s) => sum + s.notes.length, 0);
    expect(total).toBe(6);
  });

  it("빈 입력은 빈 배열 · 라벨 표는 6종 전부 있다", () => {
    expect(buildMiscSections([])).toEqual([]);
    expect(Object.keys(MISC_CATEGORY_LABELS).sort()).toEqual(["augment", "bugfix", "cosmetic", "mode", "other", "qol"]);
  });
});
