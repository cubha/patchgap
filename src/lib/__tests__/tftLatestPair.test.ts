import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { latestPatchId } from "@/pipeline/collect/staleness";

/**
 * `loadTft`이 고르는 「최신 쌍」 규칙 — **파일명 사전순이 아니라 숫자 비교**다.
 *
 * `loadTft` 자체는 `process.cwd()` 고정 경로를 읽어 테스트에서 갈아끼울 수 없으므로, 그 안의
 * 선택 규칙(패턴 매칭 + `latestPatchId`)을 같은 모양으로 재현해 고정한다. 규칙이 바뀌면
 * 여기가 먼저 깨진다.
 */
const PATTERN = /^deltas-(\d+\.\d+)-(\d+\.\d+)\.json$/;
const pick = (files: string[]): string | undefined => {
  const byTo = new Map<string, string>();
  for (const f of files) {
    const m = PATTERN.exec(f);
    if (m) byTo.set(m[2], f);
  }
  const latest = latestPatchId([...byTo.keys()]);
  return latest === null ? undefined : byTo.get(latest);
};

describe("TFT 최신 델타 쌍 선택", () => {
  it("지금 쌍을 고른다", () => {
    expect(pick(["deltas-18.1-18.2.json", "deltas-18.2-18.3.json"])).toBe("deltas-18.2-18.3.json");
  });

  it("마이너가 두 자리로 넘어가도 최신을 고른다", () => {
    // **이 케이스가 수정의 이유다.** 사전순이면 "deltas-18.10-…" < "deltas-18.9-…"이라
    // `.sort().at(-1)`이 18.9를 최신이라고 집는다 — 화면이 최신이라 말하며 옛 패치를 보여준다.
    expect(pick(["deltas-18.9-18.10.json", "deltas-18.8-18.9.json"])).toBe("deltas-18.9-18.10.json");
    expect(pick(["deltas-18.10-18.11.json", "deltas-18.9-18.10.json"])).toBe("deltas-18.10-18.11.json");
  });

  it("델타가 아닌 파일은 쌍으로 세지 않는다", () => {
    // 전송 로그가 같은 디렉토리에 남으면 `to`가 가짜가 되어 rows 없는 파일이 화면으로 올라간다
    // (LoL이 2026-09-09에 실제로 그렇게 죽었다).
    expect(pick(["deltas-18.1-18.2.json", "deltas-18.2-18.3.notify.json", "notes-18.3.json"])).toBe(
      "deltas-18.1-18.2.json",
    );
  });

  it("델타 파일이 없으면 undefined", () => {
    expect(pick(["notes-18.3.json", "assets.json"])).toBeUndefined();
  });

  it("실제 산출물 디렉토리도 이 규칙으로 최신을 집는다", () => {
    const dir = path.join(process.cwd(), "data", "aggregated", "tft");
    if (!fs.existsSync(dir)) return;
    const picked = pick(fs.readdirSync(dir));
    expect(picked).toBeDefined();
    expect(PATTERN.test(picked as string)).toBe(true);
  });
});
