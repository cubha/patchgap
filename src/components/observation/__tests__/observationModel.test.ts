// src/components/observation/__tests__/observationModel.test.ts
// 상세 공통 관측 섹션의 입력 모델(2026-10-06 사용자 확정 — PLAN-detail-observation-section-2026-10-06.md).
// 섹션은 「지표[] → 구간[] → 행」 하나를 받는다. 이 테스트가 고정하는 것:
//   ① 탭·선택지는 보고 자격 조합만(표본 부족·바닥 미달·변화 없음은 만들지 않는다 — 9/18 확정 규칙)
//   ② 순서(승률 → 픽률 → 밴률 · 전체 → 탑 → … → 서포터)
//   ③ 구 지표 별칭 URL이 그 탭·구간으로 열리고, 자격 없는 조합을 가리키면 기본 조합으로 떨어진다
// 마지막 블록은 커밋된 실데이터로 잰다 — 문자열 grep은 필터가 틀려도 통과하기 때문이다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DeltaRecord, MatchStatus } from "@/pipeline/types";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { displayStatus } from "@/pipeline/shared/display-status";
import {
  groupObservations,
  lolObservationModel,
  lolSelectionFromId,
  resolveSelection,
} from "../observationModel";

function rec(id: string, metric: DeltaRecord["metric"], over: Partial<DeltaRecord> = {}): DeltaRecord {
  const [entityType, entityKey] = id.split(":");
  return {
    id,
    entityType: entityType as DeltaRecord["entityType"],
    entityKey,
    entityName: entityKey,
    metric,
    before: 0.1,
    after: 0.2,
    delta: 0.1,
    ci: [0.05, 0.15],
    n: { before: 10000, after: 4000 },
    q: 0.0001,
    status: "unannounced" as MatchStatus,
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    ...over,
  };
}

describe("groupObservations — 지표 × 구간 묶음", () => {
  it("지표·구간을 주어진 순서로 세우고 모르는 키는 뒤로 보낸다", () => {
    const items = [
      { m: "pickRate", s: "TOP" },
      { m: "winRate", s: "all" },
      { m: "pickRate", s: "all" },
      { m: "zzz", s: "all" },
    ];
    const model = groupObservations(items, {
      metricOf: (t) => t.m,
      segmentOf: (t) => t.s,
      metricLabel: (k) => k,
      segmentLabel: (k) => k,
      metricOrder: ["winRate", "pickRate"],
      segmentOrder: ["all", "TOP"],
    });
    expect(model.metrics.map((m) => m.key)).toEqual(["winRate", "pickRate", "zzz"]);
    expect(model.metrics[1].segments.map((s) => s.key)).toEqual(["all", "TOP"]);
    expect(model.count).toBe(4);
  });

  it("빈 입력은 빈 모델이다", () => {
    const model = groupObservations([] as { m: string }[], {
      metricOf: (t) => t.m,
      segmentOf: () => "all",
      metricLabel: (k) => k,
      segmentLabel: (k) => k,
      metricOrder: [],
      segmentOrder: [],
    });
    expect(model).toEqual({ metrics: [], count: 0 });
  });
});

describe("lolObservationModel — 보고 자격 조합만", () => {
  it("노이즈 상태·비유의·바닥 미달 행은 탭도 선택지도 만들지 않는다", () => {
    const rows = [
      rec("champion:Aatrox:pickRate", "pickRate", { status: "announced-consistent" }),
      // 표본 부족 — 승률 탭 자체가 생기면 안 된다
      rec("champion:Aatrox:TOP:winRate", "winRate", { status: "insufficient-sample", n: { before: 316, after: 191 } }),
      // 공지됐지만 비유의(q=0.795) — 엔진이 announced-inconsistent로 적는 행(verdict.ts 3번 분기)
      rec("champion:Aatrox:BOTTOM:pickRate", "pickRate", {
        status: "announced-inconsistent",
        before: 0.0001,
        after: 0,
        delta: -0.0001,
        ci: [-0.0006, 0.0009],
        q: 0.795,
      }),
      rec("champion:Aatrox:MIDDLE:pickRate", "pickRate", { status: "below-threshold" }),
      rec("champion:Aatrox:banRate", "banRate", { status: "no-change", q: 0.9, ci: [-0.01, 0.01] }),
    ];
    const model = lolObservationModel(rows, 0.05);
    expect(model.count).toBe(1);
    expect(model.metrics.map((m) => m.key)).toEqual(["pickRate"]);
    expect(model.metrics[0].segments.map((s) => s.key)).toEqual(["all"]);
  });

  it("승률 → 픽률 → 밴률, 전체 → 탑 → 정글 → 미드 → 원딜 → 서포터 순이고 라벨은 한국어다", () => {
    const rows = [
      rec("champion:Ambessa:banRate", "banRate"),
      rec("champion:Ambessa:TOP:pickRate", "pickRate"),
      rec("champion:Ambessa:pickRate", "pickRate"),
      rec("champion:Ambessa:UTILITY:winRate", "winRate", { n: { before: 500, after: 400 } }),
      rec("champion:Ambessa:winRate", "winRate", { n: { before: 500, after: 400 } }),
    ];
    const model = lolObservationModel(rows, 0.05);
    expect(model.metrics.map((m) => m.label)).toEqual(["승률", "픽률", "밴률"]);
    expect(model.metrics[0].segments.map((s) => s.label)).toEqual(["전체", "서포터"]);
    expect(model.metrics[1].segments.map((s) => s.label)).toEqual(["전체", "탑"]);
  });

  it("아이템·오브젝트처럼 라인 축이 없는 id는 구간 하나(전체)다", () => {
    const rows = [
      rec("item:3124:adoptionRate", "adoptionRate"),
      rec("objective:dragon", "firstSec", { before: 400, after: 300, delta: -100, ci: [-150, -50] }),
    ];
    const model = lolObservationModel(rows, 0.05);
    for (const metric of model.metrics) {
      expect(metric.segments.map((s) => s.key)).toEqual(["all"]);
    }
  });
});

describe("초기 선택 — 구 지표 별칭 URL의 딥링크", () => {
  const model = () => lolObservationModel(
    [
      rec("champion:Ambessa:winRate", "winRate", { n: { before: 500, after: 400 } }),
      rec("champion:Ambessa:TOP:winRate", "winRate", { n: { before: 500, after: 400 } }),
      rec("champion:Ambessa:pickRate", "pickRate"),
    ],
    0.05
  );

  it("별칭 id를 지표·구간으로 푼다", () => {
    expect(lolSelectionFromId("champion:Ambessa:TOP:winRate")).toEqual({ metric: "winRate", segment: "TOP" });
    expect(lolSelectionFromId("champion:Ambessa:pickRate")).toEqual({ metric: "pickRate", segment: "all" });
    expect(lolSelectionFromId("item:3124:adoptionRate")).toEqual({ metric: "adoptionRate", segment: "all" });
    // 정준(대상) 슬러그는 지표를 말하지 않는다.
    expect(lolSelectionFromId("champion:Ambessa")).toBeNull();
  });

  it("자격 있는 조합이면 그 탭·구간으로 연다", () => {
    expect(resolveSelection(model(), { metric: "winRate", segment: "TOP" })).toEqual({ metric: "winRate", segment: "TOP" });
  });

  it("지표는 있지만 그 구간이 자격이 없으면 같은 지표의 첫 구간으로 연다 — 숨긴 행을 그리지 않는다", () => {
    expect(resolveSelection(model(), { metric: "pickRate", segment: "MIDDLE" })).toEqual({
      metric: "pickRate",
      segment: "all",
    });
  });

  it("지표 자체가 자격이 없으면 첫 탭·첫 구간으로 연다", () => {
    expect(resolveSelection(model(), { metric: "banRate", segment: "all" })).toEqual({ metric: "winRate", segment: "all" });
    expect(resolveSelection(model(), null)).toEqual({ metric: "winRate", segment: "all" });
  });

  it("빈 모델은 선택이 없다", () => {
    expect(resolveSelection({ metrics: [], count: 0 }, null)).toBeNull();
  });
});

describe("실데이터 — 커밋된 판정 산출물로 잰다", () => {
  const dir = path.resolve(__dirname, "../../../../data/aggregated/deltas");
  // 판정 파일만(`{from}_{to}.json`) — 같은 디렉터리에 알림 표식(`*.notify.json`, `run-notify`가 남긴다)이 생기면
  // `rows`가 없어 순회가 죽는다(2026-10-08 사전 결함 실측: "rows is not iterable").
  const files = fs.readdirSync(dir).filter((f) => /^\d+\.\d+_\d+\.\d+\.json$/.test(f));
  const load = (f: string) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { meta: { qAlpha?: number }; rows: DeltaRecord[] };

  it("모든 대상의 모든 탭·구간 행이 보고 자격을 통과한다", () => {
    let checked = 0;
    for (const f of files) {
      const { meta, rows } = load(f);
      const byEntity = new Map<string, DeltaRecord[]>();
      for (const row of rows) {
        const key = `${row.entityType}:${row.entityKey}`;
        byEntity.set(key, [...(byEntity.get(key) ?? []), row]);
      }
      for (const entityRows of byEntity.values()) {
        for (const metric of lolObservationModel(entityRows, meta.qAlpha).metrics) {
          for (const segment of metric.segments) {
            expect(isReportableRecord(segment.item, meta.qAlpha), segment.item.id).toBe(true);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  // 구현 항목 6(2026-10-06 조사): 아트록스 원딜 픽률 0.01%→0%가 엔진 상태 「announced-inconsistent」인 것은 **결함이 아니다**.
  // verdict.ts 3번 분기(노트 짝 있음 + 비유의 → announced-inconsistent)의 설계대로이고, 화면 표시 키는 비유의라 「공지」로
  // 접히며(displayStatus), 보고 자격도 없어 상세 관측에 오르지 않는다. 이 세 사실을 고정한다 — 하나가 바뀌면 그 행이
  // 「공지 · 이상 관측」으로 다시 보일 수 있다.
  it("0 근처 기준값의 공지-불일치 행은 설계된 엔진 값이고 화면에는 오르지 않는다", () => {
    const file = files.find((f) => f === "26.18_26.19.json");
    if (!file) return;
    const { meta, rows } = load(file);
    const row = rows.find((r) => r.id === "champion:Aatrox:BOTTOM:pickRate");
    expect(row, "아트록스 원딜 픽률 행").toBeDefined();
    if (!row) return;
    expect(row.status).toBe("announced-inconsistent");
    expect(row.matchedNoteIds.length).toBeGreaterThan(0);
    expect(displayStatus(row, meta.qAlpha)).toBe("announced");
    expect(isReportableRecord(row, meta.qAlpha)).toBe(false);
  });

  it("26.18 → 26.19: 아트록스는 1건(픽률·전체), 암베사는 4건(승률·픽률 × 전체·탑)", () => {
    const file = files.find((f) => f === "26.18_26.19.json");
    if (!file) return; // 그 쌍이 커밋에서 빠지면 이 실측 고정은 의미가 없다
    const { meta, rows } = load(file);
    const aatrox = lolObservationModel(rows.filter((r) => r.entityKey === "Aatrox"), meta.qAlpha);
    expect(aatrox.count).toBe(1);
    expect(aatrox.metrics.map((m) => [m.key, m.segments.map((s) => s.key)])).toEqual([["pickRate", ["all"]]]);
    const ambessa = lolObservationModel(rows.filter((r) => r.entityKey === "Ambessa"), meta.qAlpha);
    expect(ambessa.count).toBe(4);
    expect(ambessa.metrics.map((m) => [m.key, m.segments.map((s) => s.key)])).toEqual([
      ["winRate", ["all", "TOP"]],
      ["pickRate", ["all", "TOP"]],
    ]);
  });
});
