// src/lib/pubgData.ts
// PUBG 집계 산출물의 빌드 타임 로더 — data.ts(LoL)와 같은 역할이되 네임스페이스가 분리돼 있다.
// 런타임 외부 호출 0 원칙에 따라 여기서 읽는 것은 전부 커밋된 정적 JSON이다.
//
// **출하 게이트**(SCOPE 2026-09-16 해제 조건): 파일이 없거나 근거 딸린 판정이 0건이면
// `loadPubg()`가 null을 반환하고, 그 경우 페이지·네비 링크를 렌더하지 않는다. 빈 껍데기 탭이
// 배포되면 LoL 본편 신뢰도까지 깎이므로 "데이터가 없으면 아예 없다"가 기본값이다.
import fs from "node:fs";
import path from "node:path";
import type { MatchStatus } from "@/pipeline/types";
import type { PubgPatchAggregate } from "@/pipeline/aggregate/pubg-weapons";
import type { PubgAccuracyStat } from "@/pipeline/aggregate/pubg-accuracy";
import type { PubgDeltaRow, PubgNoteItem } from "@/pipeline/match/pubg-delta";

const PUBG_DIR = path.resolve(process.cwd(), "data", "aggregated", "pubg");

export interface PubgDeltasFile {
  meta: {
    game: "pubg";
    from: string;
    to: string;
    generatedAt: string;
    n: number;
    counts: Partial<Record<MatchStatus, number>>;
    effectFloor: number;
    sampleScope: string;
    window: { before: string[]; after: string[] };
  };
  rows: PubgDeltaRow[];
}

export interface PubgAccuracyComparisonRow {
  weaponKey: string;
  weaponName: string;
  nerfed: boolean;
  before: Pick<PubgAccuracyStat, "accuracy" | "attacks">;
  after: Pick<PubgAccuracyStat, "accuracy" | "attacks">;
  relChangePct: number | null;
}

export interface PubgAccuracyComparisonFile {
  meta: { generatedAt: string; note: string };
  rows: PubgAccuracyComparisonRow[];
}

export interface PubgBundle {
  deltas: PubgDeltasFile;
  before: PubgPatchAggregate;
  after: PubgPatchAggregate;
  notes: PubgNoteItem[];
  /**
   * §8 반증표 재현(ST-4) — **출하 축이 아니다**, 없어도 `loadPubg`는 정상 반환한다
   * (출하 게이트는 무기 획득 점유율 판정 건수만 본다). "버린 축" 섹션에서만 쓰인다.
   */
  accuracyComparison: PubgAccuracyComparisonRow[] | null;
}

function readJson<T>(file: string): T | null {
  const full = path.join(PUBG_DIR, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

/**
 * 네 파일이 모두 있고 **판정이 1건 이상 근거를 가질 때만** 번들을 반환한다.
 * 하나라도 없으면 null — 호출부는 null이면 PUBG를 화면에서 완전히 뺀다.
 */
export function loadPubg(): PubgBundle | null {
  const deltas = readJson<PubgDeltasFile>("deltas.json");
  const before = readJson<PubgPatchAggregate>("weapons-42.3.json");
  const after = readJson<PubgPatchAggregate>("weapons-43.1.json");
  const notesFile = readJson<{ items: PubgNoteItem[] }>("notes-43.1.json");
  if (!deltas || !before || !after || !notesFile) return null;

  const verdicts = deltas.rows.filter((row) => isReportable(row.status)).length;
  if (verdicts === 0) return null;

  const accuracyFile = readJson<PubgAccuracyComparisonFile>("accuracy-comparison.json");

  return {
    deltas,
    before,
    after,
    notes: notesFile.items,
    accuracyComparison: accuracyFile?.rows ?? null,
  };
}

/** 화면 상단 "발견" 영역에 올릴 자격이 있는 판정 — 근거가 실제로 선 것만. */
export function isReportable(status: MatchStatus): boolean {
  return (
    status === "announced-consistent" ||
    status === "announced-inconsistent" ||
    status === "unannounced"
  );
}
