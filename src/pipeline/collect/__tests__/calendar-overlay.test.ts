// src/pipeline/collect/__tests__/calendar-overlay.test.ts
// RED 먼저 — **캘린더 갱신을 무인화**한다(2026-09-21 사용자 결정: "무인으로 하는 게 맞는 것 같은데").
//
// 지금은 세 게임 다 사람이 상수에 한 줄씩 적어야 다음 패치가 수집된다. 안 적으면 cron이
// 초록불로 아무것도 안 한다(LoL은 경보조차 없다). 감시자가 새 패치를 찾아 **오버레이 파일에**
// append하고, 각 캘린더는 기저 상수 + 오버레이를 합쳐 읽는다.
//
// **봇이 TypeScript를 고치지 않는 이유**: 소스를 쓰면 롤백이 diff 되돌리기가 되고, 잘못 쓰면
// 타입 오류로 파이프라인 전체가 선다. 오버레이는 데이터 파일이라 롤백이 "파일 비우기"다.
//
// 병합 규칙의 핵심은 **단조성**이다 — 마지막 항목보다 확실히 뒤인 것만 받는다. 감시자가
// 오탐하거나 같은 패치를 두 번 봐도 캘린더가 흔들리지 않는다.
import { describe, it, expect } from "vitest";

import {
  mergeLolCalendar,
  mergeTftWindows,
  mergePubgWindows,
} from "../calendar-overlay";

const D = (iso: string): number => Date.parse(iso);

describe("mergeLolCalendar — 기저 + 오버레이", () => {
  const base = { "26.18": { liveKst: "2026-09-10" }, "26.19": { liveKst: "2026-09-24" } };

  it("오버레이가 비면 기저 그대로다 — 평상시가 무변화여야 한다", () => {
    expect(mergeLolCalendar(base, {})).toEqual(base);
  });

  it("뒤 패치를 더한다", () => {
    const merged = mergeLolCalendar(base, { "26.20": { liveKst: "2026-10-08" } });
    expect(Object.keys(merged).sort()).toEqual(["26.18", "26.19", "26.20"]);
    expect(merged["26.20"].liveKst).toBe("2026-10-08");
  });

  it("★ 기저에 이미 있는 패치는 오버레이가 못 덮는다 — 손으로 적은 값이 이긴다", () => {
    const merged = mergeLolCalendar(base, { "26.19": { liveKst: "2099-01-01" } });
    expect(merged["26.19"].liveKst).toBe("2026-09-24");
  });

  it("★ 마지막보다 앞선 패치는 거부한다 — 과거를 소급해 수집 구간을 흔들지 않는다", () => {
    expect(() => mergeLolCalendar(base, { "26.17": { liveKst: "2026-08-27" } })).toThrow(/단조/);
  });

  it("패치 ID 형식이 아니면 거부한다", () => {
    expect(() => mergeLolCalendar(base, { "; rm -rf /": { liveKst: "2026-10-08" } })).toThrow();
  });

  it("날짜 형식이 아니면 거부한다", () => {
    expect(() => mergeLolCalendar(base, { "26.20": { liveKst: "10/8" } })).toThrow();
  });
});

describe("mergeTftWindows — 열린 창을 닫으면서 잇는다", () => {
  const base = [
    { patch: "18.1", startMs: D("2026-08-25T18:00:00Z"), endMs: D("2026-09-09T18:00:00Z") },
    { patch: "18.2", startMs: D("2026-09-09T18:00:00Z"), endMs: null },
  ];

  it("오버레이가 비면 기저 그대로다", () => {
    expect(mergeTftWindows(base, [])).toEqual(base);
  });

  it("★ 새 창을 더하면 직전 창의 endMs가 자동으로 닫힌다 — 손으로 두 줄 고칠 일을 없앤다", () => {
    const merged = mergeTftWindows(base, [
      { patch: "18.3", startMs: D("2026-09-24T18:00:00Z"), endMs: null },
    ]);
    expect(merged.map((w) => w.patch)).toEqual(["18.1", "18.2", "18.3"]);
    expect(merged[1].endMs).toBe(D("2026-09-24T18:00:00Z"));
    expect(merged[2].endMs).toBeNull();
  });

  it("★ 창은 끊기지 않는다 — 앞 창의 끝이 뒤 창의 시작이다", () => {
    const merged = mergeTftWindows(base, [
      { patch: "18.3", startMs: D("2026-09-24T18:00:00Z"), endMs: null },
    ]);
    for (let i = 1; i < merged.length; i += 1) {
      expect(merged[i - 1].endMs).toBe(merged[i].startMs);
    }
  });

  it("마지막 창보다 이른 시작은 거부한다", () => {
    expect(() =>
      mergeTftWindows(base, [{ patch: "18.3", startMs: D("2026-09-01T00:00:00Z"), endMs: null }])
    ).toThrow(/단조/);
  });

  it("이미 있는 패치는 거부한다", () => {
    expect(() =>
      mergeTftWindows(base, [{ patch: "18.2", startMs: D("2026-10-01T00:00:00Z"), endMs: null }])
    ).toThrow();
  });
});

describe("mergePubgWindows — 텔레메트리 라벨까지 검사한다", () => {
  const base = [
    { patch: "42.3", telemetryPatch: "pc-2018-42", liveFrom: "2026-08-11" },
    { patch: "43.1", telemetryPatch: "pc-2018-43", liveFrom: "2026-09-09" },
  ];

  it("오버레이가 비면 기저 그대로다", () => {
    expect(mergePubgWindows(base, [])).toEqual(base);
  });

  it("메이저가 오른 패치를 더한다", () => {
    const merged = mergePubgWindows(base, [
      { patch: "44.1", telemetryPatch: "pc-2018-44", liveFrom: "2026-12-08" },
    ]);
    expect(merged.map((w) => w.patch)).toEqual(["42.3", "43.1", "44.1"]);
  });

  it("★ 직전과 같은 라벨은 거부한다 — 마이너 쌍은 격자가 붕괴해 0건을 낸다", () => {
    expect(() =>
      mergePubgWindows(base, [
        { patch: "43.2", telemetryPatch: "pc-2018-43", liveFrom: "2026-10-08" },
      ])
    ).toThrow(/라벨/);
  });

  it("라벨 형식이 아니면 거부한다", () => {
    expect(() =>
      mergePubgWindows(base, [{ patch: "44.1", telemetryPatch: "44", liveFrom: "2026-12-08" }])
    ).toThrow();
  });

  it("날짜가 뒤로 가면 거부한다", () => {
    expect(() =>
      mergePubgWindows(base, [
        { patch: "44.1", telemetryPatch: "pc-2018-44", liveFrom: "2026-01-01" },
      ])
    ).toThrow(/단조/);
  });
});
