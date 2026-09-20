// scripts/run-tft-match.ts의 순수 함수 검증. `isMainModule` 가드가 있어 import만으로는
// main()이 돌지 않는다(run-notify.test.ts와 같은 패턴).
import { describe, it, expect } from "vitest";

import { agreesWithNote, directionMajority, parseArgs } from "../../../../scripts/run-tft-match";
import { assignStatus } from "../verdict";
import type { DeltaRecord, PatchNoteItem } from "../../types";

function note(direction: PatchNoteItem["direction"]): PatchNoteItem {
  return {
    id: `n-${direction}`,
    patch: "18.2",
    section: "champion",
    entity: "테스트",
    skill: null,
    stat: "s",
    before: "1",
    after: "2",
    direction,
    summary: "s: 1 ⇒ 2",
    anchorUrl: "https://x/#a",
    anchorKind: "section",
    modeScope: "core",
  };
}

describe("directionMajority", () => {
  it("buff·nerf만 세고 나머지는 중립", () => {
    expect(directionMajority([note("buff"), note("buff"), note("nerf")])).toBe("buff");
    expect(directionMajority([note("nerf"), note("adjust")])).toBe("nerf");
    expect(directionMajority([note("adjust"), note("unknown")])).toBe("neutral");
  });

  it("동률이면 중립 — 판정할 수 없다는 뜻이다", () => {
    expect(directionMajority([note("buff"), note("nerf")])).toBe("neutral");
  });
});

describe("agreesWithNote — 평균 등수 부호 반전", () => {
  it("비율 지표는 상향 노트 ↔ 증가가 일치다", () => {
    expect(agreesWithNote("top4Rate", 0.05, "buff")).toBe("consistent");
    expect(agreesWithNote("top4Rate", -0.05, "buff")).toBe("inconsistent");
    expect(agreesWithNote("playRate", -0.05, "nerf")).toBe("consistent");
  });

  it("**평균 등수는 상향 노트 ↔ 감소가 일치다** — 안 뒤집으면 상향 패치가 전부 불일치로 찍힌다", () => {
    expect(agreesWithNote("avgPlacement", -0.3, "buff")).toBe("consistent");
    expect(agreesWithNote("avgPlacement", 0.3, "buff")).toBe("inconsistent");
    expect(agreesWithNote("avgPlacement", 0.3, "nerf")).toBe("consistent");
    expect(agreesWithNote("avgPlacement", -0.3, "nerf")).toBe("inconsistent");
  });

  it("방향이 없거나 변화가 0이면 중립", () => {
    expect(agreesWithNote("top4Rate", 0.05, "neutral")).toBe("neutral");
    expect(agreesWithNote("avgPlacement", 0, "buff")).toBe("neutral");
  });
});

describe("부호는 엔진의 directionAgreement 한 곳에서만 의미를 갖는다", () => {
  // 판정 엔진에서 부호에 민감한 지점은 `assignStatus`의 directionAgreement 비교뿐이다.
  // `isSignificant`는 CI가 0을 제외하는지만 보고, `meetsEffectFloor`는 Math.abs를 쓴다.
  // 즉 avgPlacement 반전을 여기서 하면 엔진 무수정으로 충분하다 — 그것을 실증한다.
  function rec(delta: number): DeltaRecord {
    return {
      id: "unit:A:avgPlacement",
      entityType: "unit",
      entityKey: "A",
      entityName: "A",
      metric: "avgPlacement",
      before: 4.5,
      after: 4.5 + delta,
      delta,
      ci: delta > 0 ? [delta / 2, delta * 1.5] : [delta * 1.5, delta / 2],
      n: { before: 4000, after: 4000 },
      q: 0.001,
      status: "no-change",
      matchedNoteId: null,
      matchedNoteIds: [],
      causes: [],
      evidence: { matchIds: [], aggregatePath: "p", noteAnchor: null },
    };
  }

  it("상향 노트 + 등수 감소 → 공지·일치", () => {
    const agreement = agreesWithNote("avgPlacement", -0.4, "buff");
    expect(assignStatus(rec(-0.4), { noteIds: ["n"], directionAgreement: agreement })).toBe("announced-consistent");
  });

  it("상향 노트 + 등수 증가 → 공지·불일치", () => {
    const agreement = agreesWithNote("avgPlacement", 0.4, "buff");
    expect(assignStatus(rec(0.4), { noteIds: ["n"], directionAgreement: agreement })).toBe("announced-inconsistent");
  });

  it("바닥 통과는 부호와 무관하다 — 양쪽 다 미공지로 올라간다", () => {
    expect(assignStatus(rec(0.4), null)).toBe("unannounced");
    expect(assignStatus(rec(-0.4), null)).toBe("unannounced");
  });
});

describe("parseArgs", () => {
  it("from·to는 필수다", () => {
    expect(() => parseArgs([])).toThrow(/--from/);
  });

  it("패치 형식을 강제한다", () => {
    expect(parseArgs(["--from", "18.1", "--to", "18.2"])).toMatchObject({ from: "18.1", to: "18.2" });
  });
});
