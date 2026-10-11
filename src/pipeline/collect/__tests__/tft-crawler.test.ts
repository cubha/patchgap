import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { crawlProgress, crawlTft, rawTftFile, selectTftWindows, spanOf, windowOf, type TftPatchWindow } from "../tft-crawler";
import type { TftClient, TftMatchEnvelope } from "../tft-client";

const D = (iso: string) => Date.parse(iso);

// 실측 발행일(2026-09-20 확인): 18.1 = 8/25 18:00Z, 18.2 = 9/9 18:00Z.
const WINDOWS: TftPatchWindow[] = [
  { patch: "18.1", startMs: D("2026-08-25T18:00:00Z"), endMs: D("2026-09-09T18:00:00Z") },
  { patch: "18.2", startMs: D("2026-09-09T18:00:00Z"), endMs: null },
];

describe("windowOf", () => {
  it("경계는 시작 포함·끝 제외 — 한 매치가 두 패치에 들어가면 안 된다", () => {
    expect(windowOf(WINDOWS, D("2026-09-09T18:00:00Z"))?.patch).toBe("18.2");
    expect(windowOf(WINDOWS, D("2026-09-09T17:59:59Z"))?.patch).toBe("18.1");
  });

  it("창 밖은 null — 철 지난 매치를 아무 패치에나 넣지 않는다", () => {
    expect(windowOf(WINDOWS, D("2026-08-01T00:00:00Z"))).toBeNull();
  });

  it("열린 창(endMs=null)은 이후 전부를 받는다", () => {
    expect(windowOf(WINDOWS, D("2027-01-01T00:00:00Z"))?.patch).toBe("18.2");
  });
});

describe("spanOf", () => {
  it("열린 창이 하나라도 있으면 전체도 열린다", () => {
    expect(spanOf(WINDOWS)).toEqual({ startMs: D("2026-08-25T18:00:00Z"), endMs: null });
  });

  it("전부 닫혀 있으면 최대 끝을 쓴다", () => {
    const closed: TftPatchWindow[] = [
      { patch: "a", startMs: 100, endMs: 200 },
      { patch: "b", startMs: 200, endMs: 300 },
    ];
    expect(spanOf(closed)).toEqual({ startMs: 100, endMs: 300 });
  });
});

function fakeClient(matches: Record<string, { at: number; version?: string; queue?: number }>): TftClient {
  return {
    async getLeagueEntries() {
      return [
        { puuid: "p1", leaguePoints: 1, wins: 0, losses: 0 },
        { puuid: "p2", leaguePoints: 1, wins: 0, losses: 0 },
      ];
    },
    async getMatchIdsByPuuid(puuid) {
      return puuid === "p1" ? Object.keys(matches).slice(0, 3) : Object.keys(matches);
    },
    async getMatch(matchId): Promise<TftMatchEnvelope | null> {
      const m = matches[matchId];
      if (!m) return null;
      return {
        matchId,
        gameDatetime: m.at,
        gameVersion: m.version ?? "TFT Unreal Version ?.?.?.?",
        raw: {
          metadata: { match_id: matchId },
          info: { game_datetime: m.at, queue_id: m.queue ?? 1100, participants: [{ placement: 1 }] },
        },
      };
    },
    async dispose() {},
  };
}

describe("crawlTft", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tftcrawl-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const MATCHES = {
    KR_A: { at: D("2026-09-01T00:00:00Z") }, // 18.1
    KR_B: { at: D("2026-09-02T00:00:00Z") }, // 18.1
    KR_C: { at: D("2026-09-12T00:00:00Z") }, // 18.2
    KR_OLD: { at: D("2026-07-01T00:00:00Z") }, // 창 밖
  };

  it("랭크(1100) 외 큐는 버린다 — 실측 스모크에서 일반전이 섞여 들어왔다", async () => {
    const mixed = {
      KR_R: { at: D("2026-09-12T00:00:00Z"), queue: 1100 },
      KR_N: { at: D("2026-09-12T00:00:00Z"), queue: 1090 },
      KR_H: { at: D("2026-09-12T00:00:00Z"), queue: 1130 },
    };
    const r = await crawlTft({ client: fakeClient(mixed), windows: WINDOWS, targetPerPatch: 10, outDir: dir });
    expect(r.storedByPatch["18.2"]).toBe(1);
    expect(r.skipped).toBe(2);
  });

  it("큐 허용 집합은 주입할 수 있다", async () => {
    const mixed = { KR_N: { at: D("2026-09-12T00:00:00Z"), queue: 1090 } };
    const r = await crawlTft({
      client: fakeClient(mixed), windows: WINDOWS, targetPerPatch: 10, outDir: dir, queueIds: [1090],
    });
    expect(r.storedByPatch["18.2"]).toBe(1);
  });

  it("매치를 패치 창별 파일로 가른다", async () => {
    const r = await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir });
    expect(r.storedByPatch).toEqual({ "18.1": 2, "18.2": 1 });
    expect(fs.readFileSync(rawTftFile("18.1", dir), "utf8").trim().split("\n")).toHaveLength(2);
  });

  it("창 밖 매치는 버리고 그 수를 보고한다 — 조용히 삼키지 않는다", async () => {
    const r = await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir });
    expect(r.skipped).toBe(1);
  });

  it("원본 JSON을 그대로 적재한다 — 슬림 변환을 수집 시점에 굳히지 않는다", async () => {
    await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir });
    const line = JSON.parse(fs.readFileSync(rawTftFile("18.2", dir), "utf8").trim()) as {
      raw: { info: { participants: unknown[] } };
    };
    expect(line.raw.info.participants).toHaveLength(1);
  });

  it("못 읽는 버전 문자열도 그대로 기록한다 — 빈 필드로 삼키지 않는다", async () => {
    // 실측(2026-09-20): TFT는 `game_version`에 "TFT Unreal Version ?.?.?.?"를 준다. 파싱을
    // 시도하고 실패한 사실 자체가 「시각 기준 분류가 유일한 방법」이라는 근거이므로 남긴다.
    const r = await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir });
    expect(r.versionHistogram["TFT Unreal Version ?.?.?.?"]).toBeGreaterThan(0);
  });

  it("재실행하면 이미 받은 매치를 다시 받지 않는다 — 중단 후 재개", async () => {
    await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir });
    const second = await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir });
    expect(second.requested).toBe(0);
    expect(second.storedByPatch).toEqual({ "18.1": 2, "18.2": 1 });
    expect(fs.readFileSync(rawTftFile("18.1", dir), "utf8").trim().split("\n")).toHaveLength(2);
  });

  it("목표치를 채우면 더 받지 않는다", async () => {
    const r = await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 1, outDir: dir });
    expect(r.storedByPatch["18.1"]).toBe(1);
  });

  // 2026-09-28 R3 실측: Actions 첫 실제 수집(run 36424128722)이 120분 잡 제한에 걸려 취소됐고, 캐시 저장
  // (post 스텝)도 건너뛰어 모은 매치가 전부 사라졌다. 마감 시각을 받으면 **루프를 정상 종료**하고 그 사실을 돌려준다.
  it("마감 시각이 지나면 남은 매치를 받지 않고 멈추며 stoppedAtDeadline을 알린다 — 받은 것은 파일에 남는다", async () => {
    let t = 0;
    const r = await crawlTft({
      client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir,
      deadlineAt: 2, now: () => t++,
    });
    expect(r.stoppedAtDeadline).toBe(true);
    const stored = Object.values(r.storedByPatch).reduce((a, b) => a + b, 0);
    expect(stored).toBeLessThan(3);
    const lines = WINDOWS.flatMap((w) => {
      const f = rawTftFile(w.patch, dir);
      return fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter((l) => l.trim()) : [];
    });
    expect(lines.length).toBe(stored);
  });

  it("마감이 없거나 안 지났으면 stoppedAtDeadline은 false", async () => {
    const r = await crawlTft({ client: fakeClient(MATCHES), windows: WINDOWS, targetPerPatch: 10, outDir: dir, deadlineAt: Number.MAX_SAFE_INTEGER });
    expect(r.stoppedAtDeadline).toBe(false);
    expect(r.storedByPatch["18.1"]).toBe(2);
  });
});

// 2026-10-11 실측(run 38062267855): raw 캐시가 휘발된 뒤 18.3→18.4 관측을 모으는데 ID 조회가 18.1 시작부터라
// 조회 3,571건 중 18.4 적재는 423건뿐이었다(18.1·18.2 1,200여 건 + 창 밖 1,270건). 조회 범위는 **아직 목표에 못 미친 창**만 덮는다.
describe("crawlTft — 조회 범위는 목표 미달 창만", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tftcrawl-span-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function capturingClient(calls: { startTime?: number; endTime?: number }[]): TftClient {
    const base = fakeClient({ KR_C: { at: D("2026-09-12T00:00:00Z") } });
    return {
      ...base,
      async getMatchIdsByPuuid(puuid, opts) {
        calls.push({ startTime: opts?.startTime, endTime: opts?.endTime });
        return base.getMatchIdsByPuuid(puuid, opts);
      },
    };
  }

  it("이미 목표를 채운 창(재개된 raw)은 ID 조회 범위에서 빠진다 — startTime이 미달 창의 시작이다", async () => {
    fs.writeFileSync(rawTftFile("18.1", dir), `${JSON.stringify({ matchId: "KR_OLD1" })}\n`);
    const calls: { startTime?: number; endTime?: number }[] = [];
    const r = await crawlTft({ client: capturingClient(calls), windows: WINDOWS, targetPerPatch: 1, outDir: dir });
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.startTime).toBe(D("2026-09-09T18:00:00Z"));
    expect(r.storedByPatch).toEqual({ "18.1": 1, "18.2": 1 });
  });

  it("모든 창이 이미 목표를 채웠으면 ID 조회를 아예 하지 않는다", async () => {
    fs.writeFileSync(rawTftFile("18.1", dir), `${JSON.stringify({ matchId: "KR_X1" })}\n`);
    fs.writeFileSync(rawTftFile("18.2", dir), `${JSON.stringify({ matchId: "KR_X2" })}\n`);
    const calls: { startTime?: number; endTime?: number }[] = [];
    const r = await crawlTft({ client: capturingClient(calls), windows: WINDOWS, targetPerPatch: 1, outDir: dir });
    expect(calls).toHaveLength(0);
    expect(r.requested).toBe(0);
  });
});

describe("selectTftWindows — 이번 쌍의 창만", () => {
  const THREE: TftPatchWindow[] = [
    { patch: "18.2", startMs: 1, endMs: 2 },
    { patch: "18.3", startMs: 2, endMs: 3 },
    { patch: "18.4", startMs: 3, endMs: null },
  ];
  it("지정한 패치만 남긴다(순서는 캘린더 순)", () => {
    expect(selectTftWindows(THREE, ["18.4", "18.3"]).map((w) => w.patch)).toEqual(["18.3", "18.4"]);
  });
  it("지정이 없으면 전부 — 로컬 수동 수집은 그대로", () => {
    expect(selectTftWindows(THREE, undefined)).toHaveLength(3);
  });
  it("캘린더에 없는 패치를 지정하면 던진다 — 조용히 0개 창을 돌지 않는다", () => {
    expect(() => selectTftWindows(THREE, ["18.9"])).toThrow(/18\.9/);
  });
});

describe("crawlProgress — 부분 수집 진행", () => {
  it("창마다 적재·목표를 돌려준다(목표 초과는 목표로 자른다)", () => {
    expect(crawlProgress({ "18.3": 2600, "18.4": 813 }, 2500)).toEqual([
      { patch: "18.3", stored: 2500, target: 2500 },
      { patch: "18.4", stored: 813, target: 2500 },
    ]);
  });
});
