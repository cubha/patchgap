// src/components/__tests__/observation-notices.test.tsx
// 부분 수집(`collecting`) 안내(2026-10-11). 75분 마감 부분 수집 뒤 예정일이 지나자 배너가 날짜도 진척도 없이 「표본이 쌓이면」만 말해
// 수집 중과 고장을 가를 수 없었다(불변식 2건 실패·Discord 경보 반복, run 38057211872~). 커밋 데이터와 무관하게 두 안내 컴포넌트를
// 합성 사유로 고정한다 — home-observed-pair는 커밋 데이터에 선언만 쌍이 있을 때만 성립한다.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import NewerPatchNotice from "@/components/NewerPatchNotice";
import ObservationPendingNotice from "@/components/ObservationPendingNotice";
import type { ObservationFailure } from "@/pipeline/types";

const collecting: ObservationFailure = {
  reason: "collecting",
  detail: "",
  at: "2026-10-10T15:05:10Z",
  progress: [
    { patch: "18.3", stored: 2500, target: 2500 },
    { patch: "18.4", stored: 813, target: 2500 },
  ],
};
const next = { kind: "next" as const, label: "10/11(일) 06:00 KST" };

describe("부분 수집 안내 — 진척과 다음 수집을 말한다", () => {
  it("배너: 남은 패치의 적재/목표 + 다음 수집 시각, 「표본이 쌓이면」은 없다", () => {
    const { container } = render(
      <NewerPatchNotice patch="18.4" entityCount={67} reason="collecting" progress={collecting.progress} schedule={next} href="/tft/history/18_3-18_4/" />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("18.4 813/2,500매치");
    expect(text).toContain("다음 수집은 10/11(일) 06:00 KST 예정");
    expect(text).not.toContain("표본이 쌓이면");
    expect(text).not.toContain("18.3 2,500");
  });

  it("안내 문단: 수집 중 사유 + 진척 + 다음 수집", () => {
    const { container } = render(<ObservationPendingNotice failure={collecting} schedule={next} />);
    const p = container.querySelector("[data-observation]");
    expect(p?.getAttribute("data-observation")).toBe("collecting");
    expect(p?.textContent).toMatch(/수집 중/);
    expect(p?.textContent).toContain("18.4 813/2,500매치");
    expect(p?.textContent).toContain("다음 수집은 10/11(일) 06:00 KST 예정");
  });

  it("대기인데 예정이 지났으면(next) 「첫 관측」이 아니라 「다음 수집」을 말한다", () => {
    const awaiting: ObservationFailure = { reason: "awaiting-observation", detail: "", at: "2026-10-07T12:00:00Z" };
    const banner = render(<NewerPatchNotice patch="18.4" entityCount={67} reason="awaiting-observation" schedule={next} href={null} />);
    expect(banner.container.textContent).toContain("다음 수집(10/11(일) 06:00 KST)부터 시작");
    const notice = render(<ObservationPendingNotice failure={awaiting} schedule={next} />);
    expect(notice.container.textContent).toContain("다음 수집은 10/11(일) 06:00 KST 예정");
    expect(notice.container.textContent).not.toContain("첫 관측");
  });

  it("키 만료는 날짜 없이 조치를 말한다(일정이 와도 배너는 멈춤 문장)", () => {
    const { container } = render(<NewerPatchNotice patch="18.4" entityCount={67} reason="key-expired" schedule={null} href={null} />);
    expect(container.textContent).toContain("멈춰 있습니다");
  });
});

// TFT의 관측 전 안내는 브리핑·선언 뷰·대조표·상세·방법론이 같은 문장을 말한다(ST-16). 2026-10-11 검증에서 세 곳이 일정을 안 넘겨
// 날짜 없이 남았다 — TFT 쪽 호출은 전부 `schedule`을 넘겨야 한다(PUBG는 부분 수집 경로가 없어 대상 아님).
describe("TFT 관측 전 안내는 전부 일정을 넘긴다", () => {
  it("TFT 소스의 <ObservationPendingNotice …>·<TftUnavailable failure…>·<TftObservedRedirect …>에 schedule=", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const roots = ["src/components/tft", "src/app/tft"];
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory() && e.name !== "__tests__") walk(p);
        else if (e.isFile() && p.endsWith(".tsx")) files.push(p);
      }
    };
    roots.forEach(walk);
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      const tags = src.match(/<(ObservationPendingNotice|TftObservedRedirect)\b[\s\S]*?\/>|<TftUnavailable\s+failure[\s\S]*?\/>/g) ?? [];
      for (const t of tags) if (!t.includes("schedule=")) offenders.push(`${f}: ${t.slice(0, 60)}`);
    }
    expect(offenders).toEqual([]);
  });
});
