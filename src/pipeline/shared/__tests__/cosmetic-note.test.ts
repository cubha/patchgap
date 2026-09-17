// src/pipeline/shared/__tests__/cosmetic-note.test.ts
// 치장 판별의 **위험 방향은 한쪽뿐**이다 — 진짜 밸런스 변경을 치장으로 접으면 그 변경이
// 화면에서 조용히 사라진다. 그래서 이 테스트는 "잡아야 할 것을 잡는가"보다
// **"잡으면 안 되는 것을 안 잡는가"**에 더 많은 줄을 쓴다.
import { describe, expect, it } from "vitest";
import { isCosmeticGroup, isCosmeticNote } from "../cosmetic-note";
import type { PatchNoteItem } from "../../types";

function note(over: Partial<PatchNoteItem> = {}): PatchNoteItem {
  return {
    id: "note:26.18:system:x:1",
    patch: "26.18",
    section: "system",
    entity: "홀 오브 레전드",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "떠오른 전설 오리아나 스킨 및 테두리",
    anchorUrl: "https://example.test/notes",
    anchorKind: "section",
    ...over,
  };
}

describe("isCosmeticNote — 잡아야 할 것", () => {
  it("홀 오브 레전드 묶음은 엔티티만으로 치장이다(수치 없는 보상 줄 포함)", () => {
    expect(isCosmeticNote(note({ summary: "그 외 다수!" }))).toBe(true);
    expect(isCosmeticNote(note({ summary: "신화 정수 125개" }))).toBe(true);
    expect(isCosmeticNote(note({ summary: "'마르틴 1' 칭호" }))).toBe(true);
  });

  it("앞으로 나올 스킨 및 크로마", () => {
    expect(
      isCosmeticNote(
        note({ section: "other", entity: "앞으로 나올 스킨 및 크로마", summary: "이번 패치 기간에 다음과 같은 스킨이 출시됩니다." })
      )
    ).toBe(true);
  });

  it("엔티티가 평범해도 요약이 치장이면 잡는다", () => {
    expect(isCosmeticNote(note({ entity: "기타", summary: "신규 아이콘 및 감정표현 15개" }))).toBe(true);
  });

  it("앵커만으로도 잡는다 — 문구가 바뀌어도 섹션 앵커는 안정적이다", () => {
    expect(
      isCosmeticNote(
        note({ entity: "기타", summary: "설명 없음", anchorUrl: "https://x/patch-notes#patch-hall-of-legends" })
      )
    ).toBe(true);
  });
});

describe("isCosmeticNote — 절대 잡으면 안 되는 것", () => {
  it("수치가 파싱된 줄은 어떤 어휘가 있어도 치장이 아니다", () => {
    expect(
      isCosmeticNote(
        note({ entity: "클래식", stat: "피해량", direction: "nerf", summary: "스킨 효과 피해량: 10 ⇒ 12" })
      )
    ).toBe(false);
  });

  it("direction이 잡힌 줄은 치장이 아니다 — 방향이 있으면 밸런스 변경이다", () => {
    expect(isCosmeticNote(note({ entity: "홀 오브 레전드", direction: "buff" }))).toBe(false);
  });

  it("증강·버그 수정·의회는 지표가 '없는' 게 아니라 '파싱 안 된' 것이다 — 관측 보류가 맞다", () => {
    for (const entity of ["증강", "버그 수정", "의회 - 투표 1 결과", "버그 수정 및 편의성 개선"]) {
      expect(isCosmeticNote(note({ entity, summary: "설명 문장" }))).toBe(false);
    }
  });

  it("챔피언 밸런스 줄", () => {
    expect(
      isCosmeticNote(
        note({
          section: "champion",
          entity: "카시오페아",
          skill: "E - 쌍독니",
          stat: "마나 소모량",
          direction: "nerf",
          summary: "마나 소모량: 40 ⇒ 45",
        })
      )
    ).toBe(false);
  });
});

describe("isCosmeticGroup", () => {
  it("전부 치장일 때만 참", () => {
    expect(isCosmeticGroup([note(), note({ summary: "구 11개" })])).toBe(true);
    expect(isCosmeticGroup([note(), note({ entity: "증강", summary: "설명" })])).toBe(false);
  });

  it("빈 배열은 거짓 — 없는 것을 전부 치장이라고 말하지 않는다", () => {
    expect(isCosmeticGroup([])).toBe(false);
  });
});
