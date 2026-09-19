// src/pipeline/match/__tests__/notes-invariants.test.ts
// **커밋된 데이터**에 대한 불변식 게이트(2026-09-19). 소스가 아니라 산출물을 검사한다.
//
// 왜 필요한가: 이 결함군(다른 게임 모드의 노트가 SR 챔피언으로 귀속돼 "공지"로 판정)은 타입도
// 린트도 빌드도 통과했다. verify.sh의 Spec 규칙은 변경된 **소스 파일** grep이라 데이터 정합성을
// 아예 보지 않는다. 그래서 vitest에 둔다 — verify.sh 단위 테스트 단계와 CI가 매번 돌린다.
// 이 프로젝트에는 "산문 규칙은 게이트 없이 드리프트한다"는 실측 교훈이 있다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isCoreNote, modeScopeFromAnchorUrl } from "../../shared/mode-scope";
import type { PatchNoteItem } from "../../types";

const NOTES_DIR = path.join(process.cwd(), "data", "aggregated", "notes");

function loadAll(): { patch: string; items: PatchNoteItem[] }[] {
  if (!fs.existsSync(NOTES_DIR)) return [];
  return fs
    .readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      patch: f.replace(/\.json$/, ""),
      items: (JSON.parse(fs.readFileSync(path.join(NOTES_DIR, f), "utf8")) as { items: PatchNoteItem[] }).items,
    }));
}

const files = loadAll();

describe("커밋된 패치노트 데이터 불변식", () => {
  it("검사 대상 파일이 있다(빈 클론이면 이 테스트 전체가 무의미하므로 먼저 확인한다)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("모든 항목이 modeScope를 갖는다", () => {
    for (const { patch, items } of files) {
      const missing = items.filter((i) => i.modeScope === undefined);
      expect(`${patch}: modeScope 없음 ${missing.length}건`).toBe(`${patch}: modeScope 없음 0건`);
    }
  });

  it("modeScope는 앵커에서 재계산한 값과 일치한다(마이그레이션·파서 산출이 같은 규칙을 쓴다)", () => {
    for (const { patch, items } of files) {
      const mismatched = items.filter((i) => i.modeScope !== modeScopeFromAnchorUrl(i.anchorUrl));
      expect(`${patch}: 불일치 ${mismatched.length}건`).toBe(`${patch}: 불일치 0건`);
    }
  });

  it("SR(core) 챔피언·아이템 항목은 반드시 엔티티 앵커를 갖는다 — 섹션 앵커 폴백은 모드 섹션의 표식이다", () => {
    // 실측(26.16~26.18): 엔티티 h3 앵커는 챔피언·아이템·룬 섹션에만 존재하고 클래식·아레나·
    // 아수라장에는 0건이다. 따라서 "core인데 섹션 앵커로 폴백한 champion/item"은 곧 오귀속이다.
    // 라이엇이 h2 제목을 바꿔 모드 섹션이 조용히 core로 떨어지면 여기서 크게 실패한다.
    for (const { patch, items } of files) {
      const suspects = items.filter(
        (i) => (i.section === "champion" || i.section === "item") && isCoreNote(i) && i.anchorKind !== "entity"
      );
      expect(`${patch}: 오귀속 의심 ${suspects.length}건 ${suspects.slice(0, 3).map((s) => s.id).join(",")}`).toBe(
        `${patch}: 오귀속 의심 0건 `
      );
    }
  });
});
