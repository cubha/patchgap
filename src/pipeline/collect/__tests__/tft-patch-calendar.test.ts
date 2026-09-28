import { describe, it, expect } from "vitest";

import {
  TFT_PATCH_WINDOWS,
  liveTftPatch,
  previousTftPatch,
  isOpenEnded,
} from "../tft-patch-calendar";

const D = (iso: string) => Date.parse(iso);

describe("TFT_PATCH_WINDOWS — 실측 발행 시각", () => {
  it("18.1·18.2가 실측값 그대로다 — 이 상수가 곧 패치 구분 기준이다(game_version이 비어 있어서)", () => {
    expect(TFT_PATCH_WINDOWS.map((w) => w.patch)).toEqual(["18.1", "18.2"]);
    expect(TFT_PATCH_WINDOWS[0].startMs).toBe(D("2026-08-25T18:00:00Z"));
    expect(TFT_PATCH_WINDOWS[1].startMs).toBe(D("2026-09-09T18:00:00Z"));
  });

  it("창이 시간순이고 끊기지 않는다 — 앞 창의 끝이 뒤 창의 시작이다", () => {
    for (let i = 1; i < TFT_PATCH_WINDOWS.length; i++) {
      expect(TFT_PATCH_WINDOWS[i - 1].endMs).toBe(TFT_PATCH_WINDOWS[i].startMs);
    }
  });

  it("열린 창(endMs=null)은 마지막 하나뿐이다", () => {
    const open = TFT_PATCH_WINDOWS.filter((w) => w.endMs === null);
    expect(open).toHaveLength(1);
    expect(open[0].patch).toBe(TFT_PATCH_WINDOWS[TFT_PATCH_WINDOWS.length - 1].patch);
  });
});

describe("liveTftPatch", () => {
  it("그 시각을 품는 창의 패치를 돌려준다", () => {
    expect(liveTftPatch(D("2026-09-01T00:00:00Z"))).toBe("18.1");
    expect(liveTftPatch(D("2026-09-20T00:00:00Z"))).toBe("18.2");
  });

  it("첫 창보다 이르면 null — 지어내지 않는다", () => {
    expect(liveTftPatch(D("2026-08-01T00:00:00Z"))).toBeNull();
  });

  it("경계는 시작 포함·끝 배제 — 한 시각이 두 패치에 속하지 않는다", () => {
    expect(liveTftPatch(D("2026-09-09T18:00:00Z"))).toBe("18.2");
    expect(liveTftPatch(D("2026-09-09T17:59:59Z"))).toBe("18.1");
  });
});

describe("previousTftPatch", () => {
  it("직전 패치를 돌려준다 — 판정은 쌍으로만 성립한다", () => {
    expect(previousTftPatch("18.2")).toBe("18.1");
  });

  it("첫 패치의 앞은 null — 비교 대상이 없으면 수집해도 판정할 수 없다", () => {
    expect(previousTftPatch("18.1")).toBeNull();
  });

  it("모르는 패치는 null", () => {
    expect(previousTftPatch("99.9")).toBeNull();
  });
});

describe("isOpenEnded — 캘린더 스테일 감지의 재료", () => {
  it("endMs가 null이면 열린 창이다", () => {
    expect(isOpenEnded("18.2")).toBe(true);
    expect(isOpenEnded("18.1")).toBe(false);
  });
});

// 「표본 대기(7일)」·`determineTftRun` 테스트는 2026-09-28 명세 변경으로 `tft-run-plan.test.ts`로 옮겼다
// (사용자 결정 D6 — 선언 축은 탐지 즉시, 관측은 세트 중간 3일·세트 개시 9일, 관측 시점 기록 기준).
