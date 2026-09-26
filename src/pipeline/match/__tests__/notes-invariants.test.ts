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

/** SR 전용 h2 앵커 — 모드 섹션이 아니라 소환사의 협곡 챔피언·아이템 섹션 자체. */
const SR_SECTION_ANCHORS = new Set(["patch-champions", "patch-items"]);

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

  it("SR(core) 챔피언·아이템 항목은 엔티티 앵커 또는 SR 전용 h2 앵커를 갖는다 — 그 밖의 섹션 앵커 폴백은 모드 섹션의 표식이다", () => {
    // 실측(26.16~26.18): 엔티티 h3 앵커는 챔피언·아이템·룬 섹션에만 존재하고 클래식·아레나·
    // 아수라장에는 0건이다. 따라서 "core인데 섹션 앵커로 폴백한 champion/item"은 곧 오귀속이다.
    // 라이엇이 h2 제목을 바꿔 모드 섹션이 조용히 core로 떨어지면 여기서 크게 실패한다.
    //
    // 예외 하나(26.19 실측): SR 「아이템」 섹션 안에서 라이엇이 엔티티를 h3가 아니라 **id 없는 h4**로
    // 적었다(「세계 지도집과 룬 나침반」). 그 줄은 모드 섹션이 아니라 SR 섹션 그 자체라 앵커가
    // `#patch-items`로 폴백하는 것이 정확하다. 모드 섹션이 core로 샌 경우는 앵커가 그 모드의 h2
    // (`#patch-classic` 등)라 여전히 여기서 걸린다.
    for (const { patch, items } of files) {
      const suspects = items.filter(
        (i) =>
          (i.section === "champion" || i.section === "item") &&
          isCoreNote(i) &&
          i.anchorKind !== "entity" &&
          !SR_SECTION_ANCHORS.has(i.anchorUrl.split("#")[1] ?? "")
      );
      expect(`${patch}: 오귀속 의심 ${suspects.length}건 ${suspects.slice(0, 3).map((s) => s.id).join(",")}`).toBe(
        `${patch}: 오귀속 의심 0건 `
      );
    }
  });
  it("SR(core) 챔피언·아이템 항목의 엔티티는 섹션 제목이 아니다 — 폴백은 엔티티를 못 찾았다는 뜻이다", () => {
    // 위 앵커 예외(SR 전용 h2 앵커 허용)가 가리는 것을 여기서 잡는다. 26.19 「세계 지도집과 룬
    // 나침반」 두 줄이 엔티티 "아이템"으로 저장됐었다 — 범주 판별이 `includes("룬")`이라 그 이름을
    // 범주 라벨로 오인했다. 엔티티가 h2 제목이면 짝짓기가 어떤 아이템에도 닿지 못한다.
    for (const { patch, items } of files) {
      const unnamed = items.filter(
        (i) => (i.section === "champion" || i.section === "item") && isCoreNote(i) && (i.entity === "챔피언" || i.entity === "아이템")
      );
      expect(`${patch}: 엔티티 미식별 ${unnamed.length}건 ${unnamed.slice(0, 3).map((u) => u.id).join(",")}`).toBe(
        `${patch}: 엔티티 미식별 0건 `
      );
    }
  });
});
