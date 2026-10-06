// 메트릭 표시 단일화(2026-10-06) 전의 출력 golden. home/logic·item/metricFormat 두 벌이 같은 질문(이 지표는 무슨
// 단위로 보이나)에 각자 답하던 것을 lib/format 하나로 모으면서, **지금 화면이 내는 문자열**을 지표 전수로 고정한다.
import { describe, expect, it } from "vitest";
import { METRIC_KIND } from "@/lib/format";
import { formatMetricValue as homeFormat, formatObservedSummary, metricKind as homeKind } from "@/components/home/logic";
import { formatMetricValue as itemFormat, metricKind as itemKind } from "@/components/item/metricFormat";
import type { DeltaMetric, DeltaRecord } from "@/pipeline/types";

const METRICS = [...(Object.keys(METRIC_KIND) as DeltaMetric[]), "unknownMetric"];
const VALUES = [0, 0.4567, 352.4, 10240.6, -0.0231, -11, null];

// 단일화 전 출력(2026-10-06 실측). avgPlacement는 home에서 kind가 undefined였고 표시는 정수로 떨어졌다.
const KIND_LOL = { pp: ["pickRate", "banRate", "winRate", "adoptionRate"], sec: ["firstSec", "avgDurationSec"] };

describe("메트릭 표시 golden — LoL 화면 경로", () => {
  for (const m of METRICS) {
    it(`${m}: 분류`, () => {
      const expected = KIND_LOL.pp.includes(m) ? "pp" : KIND_LOL.sec.includes(m) ? "sec" : "gold";
      // 명세 변경(2026-10-06, 사용자 보고): 단일화 전 item은 TFT 비율 지표(top4Rate·playRate)를 "gold"로, home은
      // "pp"로 답했다. 하나로 모으며 공유 METRIC_KIND를 따르는 "pp"로 맞췄다 — item 표기의 소비처는 LoL 항목 상세뿐이고
      // LoL 델타에는 이 두 지표가 없어 화면 출력은 바뀌지 않는다(비율을 정수로 보이던 쪽이 틀린 답이었다).
      const unified = m === "top4Rate" || m === "playRate" ? "pp" : expected;
      expect(itemKind(m)).toBe(unified);
      expect(homeKind(m)).toBe(unified);
    });
    for (const v of VALUES) {
      it(`${m} · ${v}: 값 표기`, () => {
        const k = itemKind(m);
        const expected = v === null ? "—" : k === "pp" ? `${(v * 100).toFixed(1)}%` : k === "sec" ? `${Math.floor(Math.round(Math.abs(v)) / 60)}:${String(Math.round(Math.abs(v)) % 60).padStart(2, "0")}` : new Intl.NumberFormat("en-US").format(Math.round(v));
        expect(itemFormat(v, k)).toBe(expected);
        if (m !== "top4Rate" && m !== "playRate") expect(homeFormat(v, m)).toBe(expected);
      });
    }
  }
  it("관측 요약 문구", () => {
    const rec = (metric: string, delta: number | null) => ({ metric, delta }) as unknown as DeltaRecord;
    expect(formatObservedSummary(rec("pickRate", -0.018))).toBe("픽률 −1.8%p");
    expect(formatObservedSummary(rec("firstSec", 22))).toBe("첫 처치 시각 +22s");
    expect(formatObservedSummary(rec("goldAt10", -120))).toBe("골드@10 −120");
    expect(formatObservedSummary(rec("avgPlacement", 0.12))).toMatch(/^.+ \+0$/);
    expect(formatObservedSummary(rec("pickRate", null))).toBe("픽률 관측 불가");
  });
});
