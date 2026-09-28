// src/pipeline/match/__tests__/combined-note-split-local.test.ts
// C2 로컬 배선의 실패 경로(2026-09-28, /verify-impl A-V4). 로드맵 B4 원안은 「from DDragon 부재 시 크게 실패」였고
// PR-B Phase 3(scope-critic)에서 **경보 + 원문 유지**로 바꿨다 — 합친 이름 노트 분해는 부가 교정이라, DDragon이 없다고
// 패치노트 선언 축(노트·F9)까지 막지 않는다. 「크게」는 GitHub Actions `::warning::` 주석으로 잡 요약에 남는 것이다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { splitCombinedWithLocalDdragon } from "../combined-note-split-local";
import type { PatchNoteItem } from "../../types";

const combined: PatchNoteItem = {
  id: "note:26.19:item:세계-지도집과-룬-나침반:x", patch: "26.19", section: "item", entity: "세계 지도집과 룬 나침반",
  skill: null, stat: "체력", before: "30/100/200", after: "0/60/200", direction: "nerf", summary: "체력: 30/100/200 ⇒ 0/60/200",
  anchorUrl: "https://x/#patch-items", anchorKind: "section", modeScope: "core",
};

describe("splitCombinedWithLocalDdragon — DDragon이 없을 때", () => {
  const dirs: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });
  const emptyRoot = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "ddragon-none-"));
    fs.mkdirSync(path.join(d, "ddragon"));
    dirs.push(d);
    return d;
  };

  it("버전 쌍이 없으면 ::warning::을 남기고 원문을 그대로 돌려준다", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const out = splitCombinedWithLocalDdragon([combined], "26.19", { dataRoot: emptyRoot() });
    expect(out).toEqual([combined]);
    expect(log.mock.calls.flat().join("\n")).toMatch(/::warning::\[C2\]/);
  });

  it("버전 폴더는 있는데 item.json이 없으면 ::warning::을 남기고 원문을 그대로 돌려준다", () => {
    const root = emptyRoot();
    fs.mkdirSync(path.join(root, "ddragon", "16.18.1"));
    fs.mkdirSync(path.join(root, "ddragon", "16.19.1"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const out = splitCombinedWithLocalDdragon([combined], "26.19", { dataRoot: root });
    expect(out).toEqual([combined]);
    expect(log.mock.calls.flat().join("\n")).toMatch(/::warning::\[C2\] DDragon 아이템 표를 읽지 못했다/);
  });
});
