// src/app/tft/__tests__/verify-impl-regressions.test.tsx
// 2026-09-27 인수검증(축B) 발견 두 건의 회귀 게이트 — test-after(UI).
//  V1 방향 중립(동률 노트) 대상이 **홈**에서만 「공지 · 이상 관측」으로 떴다(대조표는 「공지」). 홈이 상태값만
//     보는 `displayStatusOf`를 썼기 때문 — 대조표와 같은 `displayStatus`를 써야 두 화면이 서로를 반박하지 않는다.
//  V2 상세 「표본 매치」 줄에 `break-all`이 걸려 매치 ID가 토큰 중간에서 끊겼다(LoL이 2026-09-05에 고친 결함).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AmbientProvider } from "@/components/AmbientContext";

vi.mock("server-only", () => ({}));
import TftPage from "../page";
import TftUnitPage from "../unit/[key]/page";
import { entitySlug } from "@/lib/tftRoutes";
import { loadTft } from "@/lib/tftData";
import { displayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";

describe("V1 — TFT 홈 배지가 방향 중립을 반영한다", () => {
  const bundle = loadTft();
  const rows = bundle?.deltas.rows ?? [];
  const neutralNames = new Set(
    rows
      .filter((r) => r.status === "announced-inconsistent" && r.directionAgreement === "neutral")
      .filter((r) => isReportableRecord(r, bundle?.deltas.meta.qAlpha))
      .map((r) => r.entityName)
  );
  const anomalyNames = new Set(
    rows.filter((r) => displayStatus(r, bundle?.deltas.meta.qAlpha) === "announced-anomaly").map((r) => r.entityName)
  );
  const onlyNeutral = [...neutralNames].filter((n) => !anomalyNames.has(n));

  it.runIf(onlyNeutral.length > 0)("방향 중립 대상은 홈에서 「공지 · 이상 관측」 배지를 달지 않는다", () => {
    const { container } = render(<AmbientProvider><TftPage /></AmbientProvider>);
    for (const name of onlyNeutral) {
      const rowsWithName = [...container.querySelectorAll("li, [role='row'], article")].filter((el) =>
        (el.textContent ?? "").includes(name)
      );
      for (const el of rowsWithName) {
        // 가장 안쪽 행만 본다 — 바깥 컨테이너는 다른 대상의 배지도 품는다.
        if ([...el.querySelectorAll("li, [role='row'], article")].some((inner) => (inner.textContent ?? "").includes(name))) continue;
        expect(el.textContent ?? "", name).not.toContain("공지 · 이상 관측");
      }
    }
  });
});

describe("V2 — 표본 매치 ID는 끊기지 않는다", () => {
  it("매치 ID마다 nowrap 단위이고, 그 줄에 break-all이 없다", async () => {
    const bundle = loadTft();
    const row = bundle?.deltas.rows.find((r) => r.entityType === "unit" && r.evidence.matchIds.length > 0);
    expect(row, "원천 매치가 있는 유닛 행").toBeDefined();
    if (!row) return;
    const el = await TftUnitPage({ params: Promise.resolve({ key: entitySlug(`unit:${row.entityKey}`) }) });
    // 상세는 레이아웃의 AmbientProvider 아래에서만 렌더된다(render.test.tsx와 같은 래퍼).
    const { container } = render(<AmbientProvider>{el}</AmbientProvider>);
    const line = [...container.querySelectorAll("span")].find((s) => (s.textContent ?? "").startsWith("표본 매치:"));
    expect(line, "표본 매치 줄").toBeDefined();
    expect(line?.className ?? "").not.toContain("break-all");
    const first = row.evidence.matchIds[0];
    const idSpan = [...(line?.querySelectorAll("span") ?? [])].find((s) => (s.textContent ?? "").includes(first));
    expect(idSpan?.className ?? "").toContain("whitespace-nowrap");
  });
});

// 라우트 키 규칙이 바뀌면 위 V2가 엉뚱한 페이지를 렌더할 수 있다 — 실제 산출물 경로로 한 번 교차 확인.
it("V2 전제: 상세 라우트 키 규칙이 빌드 산출물과 같다", () => {
  const dir = path.join(process.cwd(), "out", "tft", "unit");
  if (!fs.existsSync(dir)) return;
  expect(fs.readdirSync(dir).some((d) => d.startsWith("unit~"))).toBe(true);
});
