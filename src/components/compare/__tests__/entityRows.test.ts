// src/components/compare/__tests__/entityRows.test.ts
// 델타 테이블 **엔티티 1행** 조립(2026-09-18 라운드6, 사용자 L3·C1) — TDD RED 먼저.
// 사용자 지적: "델타테이블에 동일한 챔피언이 별도의 행으로 표기 … 지표 및 버전 col 제거 → 밴률 / 승률 /
// 픽률 / 채택률을 인라인으로 표시. 상승 하락 기호까지 cell데이터에 함께표시 (탑,미드,바텀 등 골드내용은
// 분명히 빼라고 몇번얘기함)" + "표본부족하고 수치에 유의미한 변화가 없는항목 최대한 배제(아얘 보여주지않도록)".
//
// 규칙: ① 챔피언·아이템만(라인 골드·오브젝트·매치 평균 행은 표에 없다) ② 라인 축이 일치하는 행만
// ("전체"=scope all 행, 특정 라인=그 라인의 position 행) ③ 셀은 **보고 가능**(노이즈 아님·유의·바닥
// 통과)한 지표만 ④ 보고 가능 셀이 0인 엔티티는 행 자체가 없다 ⑤ 대표 상태는 셀 중 최우선 ⑥ 정렬은
// 상태 우선순위 → |Δ| 내림차순.
import { describe, expect, it } from "vitest";
import type { DeltaRecord } from "@/pipeline/types";
import { buildEntityRows, isReportableRecord } from "../entityRows";

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:X:pickRate",
    entityType: "champion",
    entityKey: "X",
    entityName: "테스트챔프",
    metric: "pickRate",
    before: 0.1,
    after: 0.15,
    delta: 0.05,
    ci: [0.03, 0.07],
    n: { before: 1000, after: 1000 },
    q: 0.02,
    status: "announced-consistent",
    matchedNoteId: "note:x",
    matchedNoteIds: ["note:x"],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

const Q = 0.1;

describe("isReportableRecord", () => {
  it("유의 + 바닥 통과 + 노이즈 아님 → true", () => {
    expect(isReportableRecord(delta({}), Q)).toBe(true);
  });
  it("비유의(q≥α)면 false", () => {
    expect(isReportableRecord(delta({ q: 0.5 }), Q)).toBe(false);
  });
  it("유의해도 바닥 미달(픽률 1%p)이면 false", () => {
    expect(isReportableRecord(delta({ delta: 0.01, after: 0.11, ci: [0.005, 0.015] }), Q)).toBe(false);
  });
  it("노이즈 상태(표본 부족·바닥 미달·변화 없음)는 값과 무관하게 false", () => {
    expect(isReportableRecord(delta({ status: "insufficient-sample" }), Q)).toBe(false);
    expect(isReportableRecord(delta({ status: "below-threshold" }), Q)).toBe(false);
    expect(isReportableRecord(delta({ status: "no-change" }), Q)).toBe(false);
  });
});

describe("buildEntityRows — 엔티티 1행·인라인 지표", () => {
  const rows: DeltaRecord[] = [
    // 카시오페아: 픽률 유의·바닥 통과 / 승률 비유의 / 밴률 유의지만 바닥 미달 → 셀은 픽률 하나
    delta({ id: "champion:Cassiopeia:pickRate", entityKey: "Cassiopeia", entityName: "카시오페아", metric: "pickRate" }),
    delta({ id: "champion:Cassiopeia:winRate", entityKey: "Cassiopeia", entityName: "카시오페아", metric: "winRate", delta: 0.006, after: 0.106, ci: [-0.05, 0.06], q: 0.9 }),
    delta({ id: "champion:Cassiopeia:banRate", entityKey: "Cassiopeia", entityName: "카시오페아", metric: "banRate", delta: 0.01, after: 0.11, ci: [0.005, 0.015], q: 0.01 }),
    // 카시오페아 미드 position 행 — "전체"에서는 쓰지 않는다
    delta({ id: "champion:Cassiopeia:MIDDLE:pickRate", entityKey: "Cassiopeia", entityName: "카시오페아", metric: "pickRate", delta: 0.08, after: 0.18, ci: [0.05, 0.11] }),
    // 오공: 미공지 승률(정글) + 전체 픽률 공지
    delta({ id: "champion:MonkeyKing:JUNGLE:winRate", entityKey: "MonkeyKing", entityName: "오공", metric: "winRate", delta: -0.116, before: 0.57, after: 0.455, ci: [-0.2, -0.03], q: 0.05, status: "unannounced", matchedNoteId: null, matchedNoteIds: [] }),
    delta({ id: "champion:MonkeyKing:pickRate", entityKey: "MonkeyKing", entityName: "오공", metric: "pickRate", delta: 0.03, after: 0.13, ci: [0.02, 0.04] }),
    // 에코: 방향 반대·유의·바닥 통과 → 이상 관측
    delta({ id: "champion:Ekko:winRate", entityKey: "Ekko", entityName: "에코", metric: "winRate", delta: -0.096, before: 0.574, after: 0.478, ci: [-0.17, -0.02], q: 0.09, status: "announced-inconsistent" }),
    // 구인수: 아이템 채택률, 전부 비유의 → 행 없음
    delta({ id: "item:3124:adoptionRate", entityType: "item", entityKey: "3124", entityName: "구인수의 격노검", metric: "adoptionRate", delta: -0.0008, before: 0.05, after: 0.0492, ci: [-0.01, 0.008], q: 0.577, status: "announced-inconsistent" }),
    // 폭풍갈퀴: 아이템 채택률 유의(상대 25%↑·기저 1%↑) → 행 있음, 채택률 셀
    delta({ id: "item:3508:adoptionRate", entityType: "item", entityKey: "3508", entityName: "폭풍갈퀴", metric: "adoptionRate", delta: 0.02, before: 0.05, after: 0.07, ci: [0.01, 0.03], q: 0.001, status: "unannounced", matchedNoteId: null, matchedNoteIds: [] }),
    // 라인 골드·오브젝트·매치 평균 — 표에 없다
    delta({ id: "lane:TOP:goldAt14", entityType: "lane", entityKey: "TOP", entityName: "탑", metric: "goldAt14", delta: 300, before: 6000, after: 6300, ci: [200, 400], q: 0.001, status: "unannounced", matchedNoteIds: [] }),
    delta({ id: "objective:dragon", entityType: "objective", entityKey: "dragon", entityName: "첫 용", metric: "firstSec", delta: -40, before: 400, after: 360, ci: [-60, -20], q: 0.001, status: "unannounced", matchedNoteIds: [] }),
    delta({ id: "summary:avgDurationSec", entityType: "summary", entityKey: "avgDurationSec", entityName: "경기 시간", metric: "avgDurationSec", delta: -70, before: 1800, after: 1730, ci: [-90, -50], q: 0.001, status: "unannounced", matchedNoteIds: [] }),
  ];

  // 명세 변경(2026-09-20 사용자 지적): 전체 행과 라인 행은 **모집단이 다른 별개 관측**이라
  // 한 자리를 놓고 경쟁시키지 않는다. 셀이 둘을 나란히 들고 화면이 축을 명시한다.
  it("같은 챔피언은 한 행이고, 셀은 전체 관측과 라인 관측을 함께 든다", () => {
    const out = buildEntityRows(rows, "all", Q);
    const cass = out.find((r) => r.entityKey === "Cassiopeia");
    expect(cass).toBeDefined();
    expect(Object.keys(cass!.cells).sort()).toEqual(["pickRate"]);
    expect(cass!.cells.pickRate?.overall?.id).toBe("champion:Cassiopeia:pickRate");
    // 미드 픽률(+8%p)은 버려지지 않는다 — 라인 자리에 남는다.
    expect(cass!.cells.pickRate?.lane?.lane).toBe("MIDDLE");
    expect(cass!.cells.pickRate?.lane?.record.id).toBe("champion:Cassiopeia:MIDDLE:pickRate");
    // 대표(상세 링크)는 전체 관측이다.
    expect(cass!.cells.pickRate?.representative.id).toBe("champion:Cassiopeia:pickRate");
    expect(out.filter((r) => r.entityKey === "Cassiopeia")).toHaveLength(1);
  });

  it("보고 가능 셀이 0인 엔티티(구인수)는 행이 없고, 라인 골드·오브젝트·매치 평균도 없다", () => {
    const keys = buildEntityRows(rows, "all", Q).map((r) => r.key);
    expect(keys).not.toContain("item:3124");
    expect(keys.some((k) => k.startsWith("lane:") || k.startsWith("objective:") || k.startsWith("summary:"))).toBe(false);
  });

  it("아이템은 채택률 셀 하나로 한 행", () => {
    const item = buildEntityRows(rows, "all", Q).find((r) => r.key === "item:3508");
    expect(item?.entityType).toBe("item");
    expect(Object.keys(item!.cells)).toEqual(["adoptionRate"]);
  });

  // 명세 변경(2026-09-18 실렌더 실측): 에코의 유일한 이상 관측이 미드 승률이라 all 행만 보면 표에서
  // 사라지고 좌 내비 배지와 표가 서로를 반박했다. "전체"에서는 그 지표의 all 행이 보고 가능하지 않을 때
  // 보고 가능한 position 행(|Δ| 최대)이 셀을 대표하고 라인을 표기한다.
  it("'전체'에서 all 행이 보고 가능하지 않은 지표는 라인 관측만 든다 — 오공 정글 승률", () => {
    const wk = buildEntityRows(rows, "all", Q).find((r) => r.entityKey === "MonkeyKing");
    expect(Object.keys(wk!.cells).sort()).toEqual(["pickRate", "winRate"]);
    expect(wk!.cells.winRate?.overall).toBeNull();
    expect(wk!.cells.winRate?.lane?.lane).toBe("JUNGLE");
    expect(wk!.cells.pickRate?.overall?.id).toBe("champion:MonkeyKing:pickRate");
    expect(wk!.cells.pickRate?.lane).toBeNull();
    expect(wk!.status).toBe("unannounced");
  });

  // 라인 필터가 걸리면 그 라인만 본다 — 전체 자리는 비어 있어야 한다(화면도 라벨을 떼고 그린다).
  it("라인 필터에서는 전체 관측을 섞지 않는다", () => {
    const out = buildEntityRows(rows, "MIDDLE", Q);
    const cass = out.find((r) => r.entityKey === "Cassiopeia");
    expect(cass!.cells.pickRate?.overall).toBeNull();
    expect(cass!.cells.pickRate?.lane?.lane).toBe("MIDDLE");
  });

  it("라인 '정글'을 고르면 그 라인의 position 행으로 셀을 채우고 밴률·아이템은 없다", () => {
    const out = buildEntityRows(rows, "JUNGLE", Q);
    expect(out.map((r) => r.entityKey)).toEqual(["MonkeyKing"]);
    expect(Object.keys(out[0].cells)).toEqual(["winRate"]);
    expect(out[0].status).toBe("unannounced");
    expect(out[0].lane).toBe("JUNGLE");
  });

  it("대표 상태는 셀 중 최우선 — 이상 관측(에코)은 announced-anomaly", () => {
    const ekko = buildEntityRows(rows, "all", Q).find((r) => r.entityKey === "Ekko");
    expect(ekko?.status).toBe("announced-anomaly");
  });

  it("정렬: 미공지 → 이상 관측 → 공지, 같은 상태 안에서는 |Δ| 내림차순", () => {
    const out = buildEntityRows(rows, "all", Q);
    // 오공은 정글 승률(미공지, |Δ| 0.116)이 대표가 되어 폭풍갈퀴(0.02)보다 앞선다.
    expect(out.map((r) => r.entityName)).toEqual(["오공", "폭풍갈퀴", "에코", "카시오페아"]);
  });

  it("대표 델타는 |Δ| 최대 보고 셀이고 matchedNoteIds는 셀 합집합이다", () => {
    const rowsMulti = [
      delta({ id: "champion:A:pickRate", entityKey: "A", entityName: "A", metric: "pickRate", delta: 0.03, after: 0.13, ci: [0.02, 0.04], matchedNoteIds: ["n1"] }),
      delta({ id: "champion:A:banRate", entityKey: "A", entityName: "A", metric: "banRate", delta: 0.09, after: 0.19, ci: [0.06, 0.12], matchedNoteIds: ["n2"] }),
    ];
    const [a] = buildEntityRows(rowsMulti, "all", Q);
    expect(a.representative?.id).toBe("champion:A:banRate");
    expect(a.maxAbsDelta).toBeCloseTo(0.09);
    expect(a.matchedNoteIds.sort()).toEqual(["n1", "n2"]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(buildEntityRows([], "all", Q)).toEqual([]);
  });
});
