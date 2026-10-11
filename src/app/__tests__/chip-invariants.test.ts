// src/app/__tests__/chip-invariants.test.ts
// 대조표 상태 칩 불변식(트랙 B ST-24, 2026-10-11 site-review tft-S10·tft-S9). 리뷰 실측: TFT 칩 합이 전체와 맞지 않았다(8+2+21=31 vs
// 「전체 35」, 22+4+58=84 vs 111) — 빠진 몫은 잠수함·공지값 불일치 행인데 그것을 거르는 칩이 없었다. 그리고 「미공지 Gap ↗」 타일은
// 미공지 + 수치 축을 세는데 착지는 「미공지」 칩이라 타일 숫자와 착지 화면의 수가 달랐다.
//   ① 칩 합(전체 제외) = 전체 — 모든 표시 상태가 칩을 갖는다.
//   ② 타일 착지(`#gap`) 결과 수 = 타일 숫자.
// 커밋된 전 쌍 × 세 게임을 실데이터로 잰다(지금 데이터로 괜찮다는 근거가 아니라 구조로 — 쌍이 늘면 자동으로 대상이 된다).
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { COMPARE_FILTERS, GAP_FILTER, matchesFilter } from "@/components/compare/toolbarRules";
import { buildEntityRows } from "@/components/compare/entityRows";
import { listPatchPairs, loadDeltas } from "@/lib/data";
import { loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";
import { lolGapTotal, pubgGapTotal, tftGapTotal } from "@/lib/gapTotals";
import { tftDetailRows } from "@/lib/pairPages";
import { loadPubg } from "@/lib/pubgData";
import { listTftPairs, loadTft } from "@/lib/tftData";
import { buildNoteMismatchIndexFromChanges, buildSubmarineIndexFromChanges } from "@/pipeline/gamedata/submarine";
import type { DisplayStatus } from "@/pipeline/shared/display-status";
import { pubgDisplayStatus } from "@/pipeline/shared/pubg-status";
import { isReportable } from "@/lib/pubgData";

function check(label: string, statuses: readonly DisplayStatus[], gapTile: number) {
  it(`${label} — 칩 합 = 전체`, () => {
    const chips = COMPARE_FILTERS.filter((f) => f.key !== "all");
    const sum = chips.reduce((n, f) => n + statuses.filter((s) => matchesFilter(s, f.key)).length, 0);
    expect(sum).toBe(statuses.length);
  });
  it(`${label} — 타일 착지 결과 수 = 타일 숫자`, () => {
    expect(statuses.filter((s) => matchesFilter(s, GAP_FILTER)).length).toBe(gapTile);
  });
}

describe("LoL", () => {
  for (const pair of listPatchPairs()) {
    const deltas = loadDeltas(pair.from, pair.to);
    if (!deltas) continue;
    const changes = loadGameDataDiff("lol", pair.from, pair.to)?.changes ?? [];
    const rows = buildEntityRows(
      deltas.rows,
      "all",
      deltas.meta.qAlpha,
      buildSubmarineIndexFromChanges(changes),
      buildNoteMismatchIndexFromChanges(changes)
    );
    const tile = lolGapTotal(deltas.rows, summarizeGameData(loadGameDataDiff("lol", pair.from, pair.to)));
    check(`${pair.from}→${pair.to}`, rows.map((r) => r.status), tile);
  }
});

describe("TFT", () => {
  for (const pair of listTftPairs()) {
    const bundle = loadTft(pair);
    if (!bundle) continue;
    const rows = tftDetailRows(bundle);
    const tile = tftGapTotal(bundle.deltas.rows, bundle.deltas.meta.qAlpha, summarizeGameData(loadGameDataDiff("tft", pair.from, pair.to)));
    check(`${pair.from}→${pair.to}`, rows.map((r) => r.status), tile);
  }
});

describe("PUBG", () => {
  const bundle = loadPubg();
  if (bundle) {
    const { from, to } = bundle.deltas.meta;
    const summary = summarizeGameData(loadGameDataDiff("pubg", from, to));
    const subs = new Set((summary?.submarines ?? []).map((c) => c.entityKey));
    const statuses = bundle.deltas.rows.filter((r) => isReportable(r.status)).map((r) => pubgDisplayStatus(r.status, subs.has(r.weaponKey)));
    check(`${from}→${to}`, statuses, pubgGapTotal(bundle.deltas.rows, summary));
  }
});
