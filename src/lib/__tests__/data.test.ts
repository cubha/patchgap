import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { writeDeltas } from "@/pipeline/match/verdict";

// data.ts는 "server-only"를 side-effect import한다(2026-09-05 후속 수정) — 실제 패키지의
// index.js는 Next RSC 번들 조건("react-server" export condition) 밖에서 항상 throw하도록
// 만들어져 있어(용도상 의도된 동작), Next 번들러를 거치지 않는 순수 vitest 단위 테스트에서는
// data.ts를 import하기만 해도 예외가 난다. vitest.config.ts(다른 SubTask 소유 공용 설정)를
// 건드리지 않고 이 테스트 파일 범위에서만 무해한 모듈로 교체한다 — Next 커뮤니티에서도 흔히
// 쓰는 패턴.
vi.mock("server-only", () => ({}));

import {
  getDefaultPair,
  listPatches,
  listPatchPairs,
  loadChampions,
  loadDeltas,
  loadItems,
  loadNotes,
  loadObjectives,
  loadSummary,
} from "../data";

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

const META = {
  patch: "26.17",
  generatedAt: "2026-09-05T08:11:31.329Z",
  nMatches: 1379,
  nParticipants: 13790,
  nTimelines: 0,
  source: "riot-match-v5",
};

/** ST-08 verdict.ts가 실제로 다루는 DeltaRecord 최소 유효 인스턴스. */
function makeDeltaRecord(overrides: Partial<DeltaRecord> = {}): DeltaRecord {
  return {
    id: "champion:Trundle:pickRate",
    entityType: "champion",
    entityKey: "Trundle",
    entityName: "트런들",
    metric: "pickRate",
    before: 0.021,
    after: 0.046,
    delta: 0.025,
    ci: [0.021, 0.029],
    n: { before: 10240, after: 10118 },
    q: 0.01,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: {
      matchIds: ["KR_1234567890"],
      aggregatePath: "data/aggregated/26.17/champions.json",
      noteAnchor: null,
    },
    ...overrides,
  };
}

describe("data.ts (dataRoot 주입 테스트)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "patchgap-lib-data-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("빈 데이터 빌드 보장 (파일/디렉토리 없음)", () => {
    it("listPatches: aggregated 디렉토리가 없으면 빈 배열", () => {
      expect(listPatches(tmpDir)).toEqual([]);
    });

    it("listPatchPairs: deltas 디렉토리가 없으면 빈 배열", () => {
      expect(listPatchPairs(tmpDir)).toEqual([]);
    });

    it("getDefaultPair: 쌍이 없으면 null", () => {
      expect(getDefaultPair(tmpDir)).toBeNull();
    });

    it("loadSummary/loadChampions/loadItems/loadObjectives/loadNotes: 파일 없으면 null", () => {
      expect(loadSummary("26.17", tmpDir)).toBeNull();
      expect(loadChampions("26.17", tmpDir)).toBeNull();
      expect(loadItems("26.17", tmpDir)).toBeNull();
      expect(loadObjectives("26.17", tmpDir)).toBeNull();
      expect(loadNotes("26.17", tmpDir)).toBeNull();
    });

    it("loadDeltas: 파일 없으면 null(ST-08 미착수 구간도 이 경로)", () => {
      expect(loadDeltas("26.16", "26.17", tmpDir)).toBeNull();
    });
  });

  describe("listPatches", () => {
    it("summary.json이 있는 패치만, 내림차순으로 반환한다", () => {
      writeJson(path.join(tmpDir, "aggregated", "26.16", "summary.json"), { meta: META, data: {} });
      writeJson(path.join(tmpDir, "aggregated", "26.17", "summary.json"), { meta: META, data: {} });
      // summary.json이 없는 디렉토리는 제외되어야 한다.
      fs.mkdirSync(path.join(tmpDir, "aggregated", "26.18"), { recursive: true });
      // deltas/notes 네임스페이스는 패치 디렉토리가 아니므로 제외되어야 한다.
      writeJson(path.join(tmpDir, "aggregated", "notes", "26.17.json"), {});

      expect(listPatches(tmpDir)).toEqual(["26.17", "26.16"]);
    });
  });

  describe("listPatchPairs / getDefaultPair", () => {
    it("deltas/{from}_{to}.json 파일명에서 쌍을 뽑아 최신순으로 정렬한다", () => {
      writeJson(path.join(tmpDir, "aggregated", "deltas", "26.15_26.16.json"), { meta: META, rows: [] });
      writeJson(path.join(tmpDir, "aggregated", "deltas", "26.16_26.17.json"), { meta: META, rows: [] });

      expect(listPatchPairs(tmpDir)).toEqual([
        { from: "26.16", to: "26.17" },
        { from: "26.15", to: "26.16" },
      ]);
      expect(getDefaultPair(tmpDir)).toEqual({ from: "26.16", to: "26.17" });
    });

    it("run-notify.ts 전송 로그({from}_{to}.notify.json)를 패치 쌍으로 오인하지 않는다", () => {
      // 실측 2026-09-09: 확장자만 검사하던 시절 to="26.17.notify" 가짜 쌍이 생겼고,
      // loadDeltas가 rows 없는 전송 로그를 반환해 /item/[id] 정적 생성이
      // `a.rows is not iterable`로 죽었다.
      writeJson(path.join(tmpDir, "aggregated", "deltas", "26.16_26.17.json"), { meta: META, rows: [] });
      writeJson(path.join(tmpDir, "aggregated", "deltas", "26.16_26.17.notify.json"), {
        sentAt: "2026-09-09T12:00:00.000Z",
        status: 204,
      });

      expect(listPatchPairs(tmpDir)).toEqual([{ from: "26.16", to: "26.17" }]);
    });

    it("델타 파일명 형식이 아닌 파일은 무시한다", () => {
      writeJson(path.join(tmpDir, "aggregated", "deltas", "README.json"), {});
      writeJson(path.join(tmpDir, "aggregated", "deltas", "26.16_.json"), {});
      writeJson(path.join(tmpDir, "aggregated", "deltas", "_26.17.json"), {});

      expect(listPatchPairs(tmpDir)).toEqual([]);
    });
  });

  describe("로더 — {meta, rows|data} 래퍼를 그대로 반환한다", () => {
    it("loadSummary", () => {
      const payload = { meta: META, data: { patch: "26.17", matches: 1379 } };
      writeJson(path.join(tmpDir, "aggregated", "26.17", "summary.json"), payload);
      expect(loadSummary("26.17", tmpDir)).toEqual(payload);
    });

    it("loadChampions", () => {
      const payload = { meta: META, rows: [{ championId: 1, championKey: "Annie" }] };
      writeJson(path.join(tmpDir, "aggregated", "26.17", "champions.json"), payload);
      expect(loadChampions("26.17", tmpDir)).toEqual(payload);
    });

    it("loadNotes", () => {
      const payload = {
        meta: { patch: "26.17", sourceUrl: "https://x", fetchedAt: "2026-09-05T00:00:00Z", itemCount: 1 },
        summary: "요약",
        sections: ["챔피언"],
        items: [],
      };
      writeJson(path.join(tmpDir, "aggregated", "notes", "26.17.json"), payload);
      expect(loadNotes("26.17", tmpDir)).toEqual(payload);
    });

    it("loadDeltas: 손수 만든 fixture가 아니라 verdict.ts writeDeltas의 실제 출력과 왕복한다", () => {
      // 2026-09-05 후속 수정(scope-critic): deltas 파일 meta는 다른 5개 집계 파일의 AggregateMeta와
      // 스키마가 다르다({from,to,generatedAt,n,counts,qAlpha,llm?} — verdict.ts writeDeltas 확정).
      // 손수 만든 fixture 대신 실제 writeDeltas()를 호출해 data.ts 로더와 스키마가 어긋나지 않음을
      // 함수 대 함수로 검증한다.
      const delta = makeDeltaRecord();
      const { filePath } = writeDeltas({ from: "26.16", to: "26.17", deltas: [delta], dataRoot: tmpDir });
      expect(filePath).toBe(path.join(tmpDir, "aggregated", "deltas", "26.16_26.17.json"));

      const loaded = loadDeltas("26.16", "26.17", tmpDir);
      expect(loaded).not.toBeNull();
      expect(loaded?.rows).toEqual([delta]);
      expect(loaded?.meta).toMatchObject({
        from: "26.16",
        to: "26.17",
        n: 1,
        counts: { unannounced: 1 },
      });
      expect(typeof loaded?.meta.qAlpha).toBe("number");
      expect(typeof loaded?.meta.generatedAt).toBe("string");
      expect(loaded?.meta.llm).toBeUndefined();
    });

    it("loadDeltas: meta.llm(ST-09 세션 요약)이 있으면 그대로 왕복한다", () => {
      const delta = makeDeltaRecord({ status: "no-change" });
      writeDeltas({
        from: "26.16",
        to: "26.17",
        deltas: [delta],
        dataRoot: tmpDir,
        llm: {
          calls: 3,
          cacheHits: 1,
          skipped: 0,
          usage: {
            inputTokens: 1200,
            cacheReadInputTokens: 400,
            cacheCreationInputTokens: 0,
            outputTokens: 300,
          },
        },
      });

      const loaded = loadDeltas("26.16", "26.17", tmpDir);
      expect(loaded?.meta.llm).toEqual({
        calls: 3,
        cacheHits: 1,
        skipped: 0,
        usage: {
          inputTokens: 1200,
          cacheReadInputTokens: 400,
          cacheCreationInputTokens: 0,
          outputTokens: 300,
        },
      });
    });
  });
});
