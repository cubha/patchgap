import { describe, it, expect } from "vitest";

import { buildPubgBriefingEmbeds, buildPubgField, signedPct, sharePct } from "../pubg-briefing";
import type { PubgDeltaRow } from "../../match/pubg-delta";
import type { MatchStatus } from "../../types";

const SITE = "https://patchgap.vercel.app";

function row(over: Partial<PubgDeltaRow> = {}): PubgDeltaRow {
  return {
    id: "pubg:weapon:Item_Weapon_Groza_C:pickupShare",
    weaponKey: "Item_Weapon_Groza_C",
    weaponName: "Groza",
    metric: "pickupShare",
    before: 0.00108,
    after: 0.00137,
    relChange: 0.263,
    relCi: [0.151, 0.386],
    n: { before: 1000, after: 1000 },
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    evidence: { aggregatePath: "data/aggregated/pubg/weapons-43.1.json", noteAnchor: null, matchIds: [] },
    ...over,
  };
}

function file(rows: PubgDeltaRow[]) {
  return { meta: { from: "42.3", to: "43.1", generatedAt: "2026-09-17T12:53:51.715Z" }, rows };
}

describe("relChange는 비율이지 %p가 아니다 — 이걸 틀리면 100배 어긋난다", () => {
  it("**+26.3%로 쓴다**. `delta` 자리에 꽂아 `fmtPp`를 태우면 '+2630.0%p'가 된다", () => {
    const f = buildPubgField(row(), SITE, false);
    expect(f.value).toContain("+26.3%");
    expect(f.value).not.toContain("%p");
    expect(f.value).not.toContain("2630");
  });

  it("점유율 자체(before/after)는 부호를 안 붙이고 변화량만 붙인다", () => {
    expect(sharePct(0.00108)).toBe("0.108%");
    expect(signedPct(0.263)).toBe("+26.3%");
    expect(signedPct(-0.139)).toBe("-13.9%");
  });

  it("초 단위 포맷터로 새지 않는다 — `pickupShare`는 DeltaMetric이 아니라 metricKind가 undefined다", () => {
    const f = buildPubgField(row(), SITE, false);
    expect(f.value).not.toMatch(/\d+초/);
  });
});

describe("게이트는 status만 본다 — PUBG에는 q가 없다", () => {
  const rows = [
    row({ id: "a", weaponKey: "A", status: "unannounced" }),
    row({ id: "b", weaponKey: "B", status: "announced-consistent" }),
    row({ id: "c", weaponKey: "C", status: "below-threshold" }),
    row({ id: "d", weaponKey: "D", status: "insufficient-sample" }),
    row({ id: "e", weaponKey: "E", status: "no-change" }),
  ];

  it("노이즈 3종은 헤드라인 수치에 안 들어간다 — 화면(isReportable)과 같은 답", () => {
    const [embed] = buildPubgBriefingEmbeds(file(rows), { siteUrl: SITE });
    expect(embed.description).toContain("통계는 2개 변화를 말합니다");
    expect(embed.description).toContain("미공지 1건");
  });

  it("미공지 N은 행이 아니라 무기 수다", () => {
    const two = [
      row({ id: "a1", weaponKey: "A", status: "unannounced" }),
      row({ id: "a2", weaponKey: "A", status: "unannounced" }),
    ];
    const [embed] = buildPubgBriefingEmbeds(file(two), { siteUrl: SITE });
    expect(embed.description).toContain("미공지 1건");
  });

  it("announced-inconsistent는 '이상 관측' 섹션으로 — classify()가 비율 밴드 밖을 이미 확정했다", () => {
    const [embed] = buildPubgBriefingEmbeds(
      file([row({ status: "announced-inconsistent" as MatchStatus })]),
      { siteUrl: SITE }
    );
    expect(embed.fields[0].name).toMatch(/^⚠ /);
  });
});

describe("링크·문구는 LoL·TFT와 같은 조립을 탄다", () => {
  it("무기 상세로 건다 — 내부 키가 URL에 노출되지 않는다", () => {
    const f = buildPubgField(row(), SITE, false);
    expect(f.value).toContain(`${SITE}/pubg/weapon/groza/`);
    expect(f.value).not.toContain("Item_Weapon");
  });

  it("제목·푸터 형식이 공용 조립부에서 나온다", () => {
    const [embed] = buildPubgBriefingEmbeds(file([row()]), { siteUrl: SITE, matchCounts: { from: 1715, to: 1614 } });
    expect(embed.title).toBe("patchgap · 42.3 → 43.1");
    expect(embed.footer.text).toContain("n=1,715/1,614");
  });

  it("before/after가 없으면 지어내지 않고 '데이터 없음'", () => {
    const f = buildPubgField(row({ before: null, after: null, relChange: null }), SITE, false);
    expect(f.value).toContain("데이터 없음");
  });
});
