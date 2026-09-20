import { describe, it, expect } from "vitest";

import {
  TFT_PATCH_WINDOWS,
  liveTftPatch,
  previousTftPatch,
  isOpenEnded,
  windowAgeDays,
  determineTftRun,
  TFT_MIN_LIVE_DAYS,
  TFT_STALE_AFTER_DAYS,
  type TftRunDecision,
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

describe("표본 대기 — 패치 당일 수집은 빈 판정을 만든다", () => {
  // KR Master+ 래더는 하루 약 227매치다(18.2 = 11일에 2,496). LoL(하루 1만)과 달라서
  // 같은 cron 설계를 그대로 쓰면 TFT에서만 조용히 표본부족 판정이 쌓인다.
  const justLanded = { nowMs: D("2026-09-10T00:00:00Z"), hasOutputs: false, force: false };

  it("**라이브 직후엔 돌지 않는다**", () => {
    const d = determineTftRun(justLanded);
    expect(d.shouldRun).toBe(false);
    expect(d.reason).toMatch(/표본이 쌓일 시간/);
  });

  it(`${TFT_MIN_LIVE_DAYS}일이 지나면 돈다`, () => {
    const d = determineTftRun({ ...justLanded, nowMs: D("2026-09-09T18:00:00Z") + TFT_MIN_LIVE_DAYS * 864e5 });
    expect(d.shouldRun).toBe(true);
  });

  it("force는 대기를 넘는다 — 사람이 의도적으로 부른 것이다", () => {
    expect(determineTftRun({ ...justLanded, force: true }).shouldRun).toBe(true);
  });

  it("수동 패치 지정도 대기를 넘는다", () => {
    expect(determineTftRun({ ...justLanded, manualPatch: "18.2" }).shouldRun).toBe(true);
  });

  it("windowAgeDays가 창이 열린 뒤 경과일을 준다", () => {
    expect(windowAgeDays("18.2", D("2026-09-19T18:00:00Z"))).toBeCloseTo(10, 5);
    expect(windowAgeDays("99.9", D("2026-09-19T18:00:00Z"))).toBeNull();
  });
});

describe("determineTftRun — 워크플로 determine 스텝의 순수 두뇌", () => {
  const base = { nowMs: D("2026-09-20T00:00:00Z"), hasOutputs: false, manualPatch: undefined, force: false };

  it("라이브 패치 + 산출물 없음 + 대기 충족 → 실행", () => {
    const d: TftRunDecision = determineTftRun(base);
    expect(d.shouldRun).toBe(true);
    expect(d.patch).toBe("18.2");
    expect(d.from).toBe("18.1");
    expect(d.to).toBe("18.2");
  });

  it("산출물이 이미 있으면 스킵 — 같은 브리핑을 다시 보내지 않는다", () => {
    const d = determineTftRun({ ...base, hasOutputs: true });
    expect(d.shouldRun).toBe(false);
  });

  it("**정상 정상상태는 스테일이 아니다** — 이걸 틀리면 패치 주기 내내 매일 거짓 경보가 뜬다", () => {
    // 18.2는 지금 정상적으로 라이브이고 산출물도 있다. 그건 건강한 상태지 캘린더 누락이 아니다.
    const d = determineTftRun({ ...base, hasOutputs: true });
    expect(d.staleCalendar).toBe(false);
  });

  it(`**창이 ${TFT_STALE_AFTER_DAYS}일 넘게 열려 있으면 캘린더가 낡았다는 신호다**`, () => {
    // 관측 주기 15일의 1.5배. 다음 패치가 나왔는데 TFT_PATCH_WINDOWS를 아무도 안 고치면
    // 워크플로가 영원히 초록불로 스킵하고 사람은 정기 수집이 도는 줄 안다.
    const late = D("2026-09-09T18:00:00Z") + (TFT_STALE_AFTER_DAYS + 1) * 864e5;
    const d = determineTftRun({ ...base, nowMs: late, hasOutputs: true });
    expect(d.staleCalendar).toBe(true);
    expect(d.reason).toMatch(/캘린더/);
  });

  it("산출물이 없으면 오래된 창이어도 스테일이 아니다 — 아직 수집 안 한 것뿐", () => {
    const late = D("2026-09-09T18:00:00Z") + (TFT_STALE_AFTER_DAYS + 1) * 864e5;
    expect(determineTftRun({ ...base, nowMs: late }).staleCalendar).toBe(false);
  });

  it("force면 산출물이 있어도 실행한다", () => {
    const d = determineTftRun({ ...base, hasOutputs: true, force: true });
    expect(d.shouldRun).toBe(true);
  });

  it("수동 패치 지정이 캘린더 판정을 이긴다", () => {
    const d = determineTftRun({ ...base, manualPatch: "18.1" });
    expect(d.patch).toBe("18.1");
    expect(d.shouldRun).toBe(false); // 18.1은 from이 없다 → 판정 불가
    expect(d.reason).toMatch(/직전 패치/);
  });

  it("캘린더 밖 시각이면 조용히 no-op — 실패가 아니다", () => {
    const d = determineTftRun({ ...base, nowMs: D("2026-08-01T00:00:00Z") });
    expect(d.shouldRun).toBe(false);
    expect(d.patch).toBeNull();
  });
});
